package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;

import java.net.*;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FlowsTest {

  static final PostgreSQLContainer pg = new PostgreSQLContainer("postgres:18.3");
  static final GenericContainer<?> redis = new GenericContainer<>(
    "redis:8.6.1-alpine"
  ).withExposedPorts(6379);

  static {
    pg.start();
    redis.start();
  }

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", pg::getJdbcUrl);
    r.add("spring.datasource.username", pg::getUsername);
    r.add("spring.datasource.password", pg::getPassword);
    r.add("spring.data.redis.host", redis::getHost);
    r.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
  }

  @LocalServerPort
  int port;

  @Autowired
  Db db;

  final JsonMapper json = new JsonMapper();

  class Client {

    HttpClient client = HttpClient.newBuilder()
      .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
      .build();
    String csrf;
    String id;

    @SuppressWarnings("unchecked")
    Map<String, Object> request(String method, String path, Object body, int expected)
      throws Exception {
      var req = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path))
        .header("Content-Type", "application/json")
        .header("Idempotency-Key", UUID.randomUUID().toString());
      if (csrf != null) req.header("X-CSRF-TOKEN", csrf);
      var response = client.send(
        req
          .method(
            method,
            body == null
              ? HttpRequest.BodyPublishers.noBody()
              : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))
          )
          .build(),
        HttpResponse.BodyHandlers.ofString()
      );
      if (expected != 0) assertEquals(
        expected,
        response.statusCode(),
        path + " " + response.body()
      );
      if (response.body().isBlank()) return Map.of();
      var root = json.readValue(response.body(), Map.class);
      var result = (Map<String, Object>) root.getOrDefault("data", root);
      if (expected == 0) result.put("httpStatus", response.statusCode());
      return result;
    }

    void token() throws Exception {
      csrf = (String) request("GET", "/auth/csrf", null, 200).get("token");
    }
  }

  Client user() throws Exception {
    Client c = new Client();
    c.token();
    String email = UUID.randomUUID() + "@example.test";
    var body = Map.of("email", email, "nickname", "Student", "password", "Campus-test-123!");
    c.id = (String) c.request("POST", "/auth/register", body, 201).get("id");
    c.request("POST", "/auth/login", Map.of("email", email, "password", "Campus-test-123!"), 200);
    c.token();
    return c;
  }

  Map<String, Object> listing(Client c) throws Exception {
    String image = UUID.randomUUID().toString();
    db.exec(
      "insert into images(id,owner_id,storage_key,mime_type,size_bytes) values(?,?,?,'image/png',10)",
      image,
      c.id,
      image + ".png"
    );
    return c.request(
      "POST",
      "/listings",
      Map.of(
        "title",
        "教材",
        "description",
        "一本教材",
        "priceMinor",
        2500,
        "categoryId",
        "11111111-1111-4111-8111-111111111111",
        "buildingId",
        "22222222-2222-4222-8222-222222222221",
        "conditionCode",
        "GOOD",
        "imageIds",
        List.of(image),
        "swapEnabled",
        true
      ),
      201
    );
  }

  Map<String, Object> meeting(String conversation) {
    return Map.of(
      "conversationId",
      conversation,
      "meetingLocation",
      "Library",
      "meetingAt",
      "2027-01-01T08:00:00Z",
      "expectedListingVersion",
      1
    );
  }

  @Test
  void salePrivacyReceiptAndReview() throws Exception {
    var seller = user();
    var buyer = user();
    var outsider = user();
    var l = listing(seller);
    String cid = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", l.get("id")), 201)
      .get("id");
    outsider.request("GET", "/conversations/" + cid + "/messages", null, 404);
    buyer.request(
      "POST",
      "/conversations/" + cid + "/messages",
      Map.of(
        "clientMessageId",
        UUID.randomUUID().toString(),
        "kind",
        "TEXT",
        "text",
        "字".repeat(21)
      ),
      422
    );
    var msg = Map.of(
      "clientMessageId",
      UUID.randomUUID().toString(),
      "kind",
      "TEXT",
      "text",
      "可以吗？"
    );
    var m = buyer.request("POST", "/conversations/" + cid + "/messages", msg, 201);
    assertEquals(
      m.get("id"),
      buyer.request("POST", "/conversations/" + cid + "/messages", msg, 200).get("id")
    );
    String tid = (String) seller.request("POST", "/trades", meeting(cid), 201).get("id");
    seller.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 403);
    assertEquals(
      "COMPLETED",
      buyer.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200).get("status")
    );
    buyer.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200);
    buyer.request(
      "POST",
      "/trades/" + tid + "/reviews",
      Map.of("rating", 5, "comment", "很好"),
      201
    );
    assertEquals(1, db.rows("select * from reviews where trade_id=?", tid).size());
    outsider.request("GET", "/trades/" + tid, null, 404);
  }

  @Test
  void swapRequiresBothAndDoesNotAllowCancellationAfterOne() throws Exception {
    var a = user();
    var b = user();
    var la = listing(a);
    var lb = listing(b);
    var req = a.request(
      "POST",
      "/swap-requests",
      Map.of(
        "offeredListingId",
        la.get("id"),
        "requestedListingId",
        lb.get("id"),
        "offeredVersion",
        1,
        "requestedVersion",
        1,
        "meetingLocation",
        "Library",
        "meetingAt",
        "2027-01-01T08:00:00Z"
      ),
      201
    );
    var accepted = b.request("POST", "/swap-requests/" + req.get("id") + "/accept", Map.of(), 200);
    String tid = (String) ((Map<?, ?>) accepted.get("trade")).get("id");
    assertEquals(
      "PARTIALLY_CONFIRMED",
      a.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200).get("status")
    );
    a.request("POST", "/trades/" + tid + "/cancel", Map.of("reason", "cancel"), 409);
    assertEquals(
      "COMPLETED",
      b.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200).get("status")
    );
    assertEquals(0, db.rows("select * from listing_reservations where trade_id=?", tid).size());
  }

  @Test
  void csrfIsRequiredAndStudentsCannotAdmin() throws Exception {
    var c = user();
    c.request("GET", "/admin/users", null, 403);
    c.csrf = null;
    c.request("POST", "/auth/logout", null, 403);
  }

  @Test
  void concurrentReservationsAllowOnlyOne() throws Exception {
    var seller = user();
    var b = user();
    var c = user();
    var l = listing(seller);
    String cb = (String) b
      .request("POST", "/conversations", Map.of("listingId", l.get("id")), 201)
      .get("id");
    String cc = (String) c
      .request("POST", "/conversations", Map.of("listingId", l.get("id")), 201)
      .get("id");
    var barrier = new java.util.concurrent.CyclicBarrier(2);
    try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var first = pool.submit(() -> {
        barrier.await();
        return seller.request("POST", "/trades", meeting(cb), 0);
      });
      var second = pool.submit(() -> {
        barrier.await();
        return seller.request("POST", "/trades", meeting(cc), 0);
      });
      var codes = new ArrayList<Integer>();
      codes.add((Integer) first.get(15, java.util.concurrent.TimeUnit.SECONDS).get("httpStatus"));
      codes.add((Integer) second.get(15, java.util.concurrent.TimeUnit.SECONDS).get("httpStatus"));
      Collections.sort(codes);
      assertEquals(List.of(201, 409), codes);
    }
    assertEquals(
      1,
      db.rows("select * from listing_reservations where listing_id=?", l.get("id")).size()
    );
    assertEquals(1, db.rows("select * from trade_items where listing_id=?", l.get("id")).size());
  }

  @Test
  void hiddenReservedItemStaysReservedAndCancellationRestoresWithdrawal() throws Exception {
    var seller = user();
    var buyer = user();
    var administrator = user();
    db.exec("update users set role='ADMIN' where id=?", administrator.id);
    var l = listing(seller);
    String cid = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", l.get("id")), 201)
      .get("id");
    String tid = (String) seller.request("POST", "/trades", meeting(cid), 201).get("id");
    administrator.request(
      "POST",
      "/admin/listings/" + l.get("id") + "/moderation",
      Map.of("action", "HIDE", "reason", "test"),
      200
    );
    buyer.request("GET", "/listings/" + l.get("id"), null, 404);
    buyer.request("GET", "/trades/" + tid, null, 200);
    assertEquals(1, db.rows("select * from listing_reservations where trade_id=?", tid).size());
    buyer.request("POST", "/trades/" + tid + "/cancel", Map.of("reason", "test"), 200);
    assertEquals(
      "WITHDRAWN",
      db.one("select status from listings where id=?", l.get("id")).get("status")
    );
  }

  @Test
  void repeatedPartialConfirmationDoesNotDuplicateEvents() throws Exception {
    var a = user();
    var b = user();
    var la = listing(a);
    var lb = listing(b);
    var req = a.request(
      "POST",
      "/swap-requests",
      Map.of(
        "offeredListingId",
        la.get("id"),
        "requestedListingId",
        lb.get("id"),
        "offeredVersion",
        1,
        "requestedVersion",
        1,
        "meetingLocation",
        "Library",
        "meetingAt",
        "2027-01-01T08:00:00Z"
      ),
      201
    );
    var accepted = b.request("POST", "/swap-requests/" + req.get("id") + "/accept", Map.of(), 200);
    String tid = (String) ((Map<?, ?>) accepted.get("trade")).get("id");
    a.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200);
    int count = db.rows("select * from notifications where resource_id=?", tid).size();
    a.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200);
    assertEquals(count, db.rows("select * from notifications where resource_id=?", tid).size());
  }

  @Test
  void websocketDeliversOnlyToAuthenticatedParticipant() throws Exception {
    var seller = user();
    var buyer = user();
    var l = listing(seller);
    String cid = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", l.get("id")), 201)
      .get("id");
    var connected = new java.util.concurrent.CompletableFuture<String>();
    var delivered = new java.util.concurrent.CompletableFuture<String>();
    String cookies = ((CookieManager) seller.client.cookieHandler().orElseThrow())
      .getCookieStore()
      .getCookies()
      .stream()
      .map(HttpCookie::toString)
      .collect(java.util.stream.Collectors.joining("; "));
    WebSocket socket = seller.client
      .newWebSocketBuilder()
      .header("Cookie", cookies)
      .header("Origin", "http://localhost:5173")
      .buildAsync(
        URI.create("ws://localhost:" + port + "/ws"),
        new WebSocket.Listener() {
          final StringBuilder buffer = new StringBuilder();

          public void onOpen(WebSocket ws) {
            ws.request(1);
            ws.sendText(
              "CONNECT\naccept-version:1.2\nhost:localhost\nX-CSRF-TOKEN:" +
                seller.csrf +
                "\n\n\u0000",
              true
            );
          }

          public java.util.concurrent.CompletionStage<?> onText(
            WebSocket ws,
            CharSequence chars,
            boolean last
          ) {
            buffer.append(chars);
            if (last) {
              String frame = buffer.toString();
              buffer.setLength(0);
              if (frame.startsWith("CONNECTED")) connected.complete(frame);
              if (frame.startsWith("MESSAGE")) delivered.complete(frame);
              if (frame.startsWith("ERROR")) {
                connected.completeExceptionally(new AssertionError(frame));
                delivered.completeExceptionally(new AssertionError(frame));
              }
            }
            ws.request(1);
            return null;
          }

          public void onError(WebSocket ws, Throwable e) {
            connected.completeExceptionally(e);
            delivered.completeExceptionally(e);
          }
        }
      )
      .get(10, java.util.concurrent.TimeUnit.SECONDS);
    try {
      connected.get(10, java.util.concurrent.TimeUnit.SECONDS);
      socket
        .sendText("SUBSCRIBE\nid:events\ndestination:/user/queue/events\n\n\u0000", true)
        .join();
      buyer.request(
        "POST",
        "/conversations/" + cid + "/messages",
        Map.of("kind", "TEXT", "text", "hello", "clientMessageId", UUID.randomUUID().toString()),
        201
      );
      assertTrue(delivered.get(10, java.util.concurrent.TimeUnit.SECONDS).contains(cid));
    } finally {
      socket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join();
    }
  }

  @Test
  void filtersUseStableCursorWhenNewListingsArrive() throws Exception {
    var a = user();
    listing(a);
    listing(a);
    listing(a);
    var first = a.request("GET", "/me/listings?limit=2", null, 200);
    assertNotNull(first.get("nextCursor"));
    listing(a);
    var second = a.request(
      "GET",
      "/me/listings?limit=2&cursor=" + first.get("nextCursor"),
      null,
      200
    );
    var firstIds = ((List<Map<String, Object>>) first.get("items"))
      .stream()
      .map(row -> row.get("id"))
      .toList();
    var secondItems = (List<Map<String, Object>>) second.get("items");
    assertEquals(1, secondItems.size());
    assertFalse(firstIds.contains(secondItems.getFirst().get("id")));
  }

  @Test
  void validImageUploadsAndForeignOwnershipIsRejected() throws Exception {
    var owner = user();
    var other = user();
    var out = new java.io.ByteArrayOutputStream();
    javax.imageio.ImageIO.write(
      new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB),
      "png",
      out
    );
    String boundary = "CampusBoundary";
    var multipart = new java.io.ByteArrayOutputStream();
    multipart.write(
      (
        "--" +
        boundary +
        "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n"
      ).getBytes(java.nio.charset.StandardCharsets.UTF_8)
    );
    multipart.write(out.toByteArray());
    multipart.write(
      ("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8)
    );
    var response = owner.client.send(
      HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/images"))
        .header("X-CSRF-TOKEN", owner.csrf)
        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
        .POST(HttpRequest.BodyPublishers.ofByteArray(multipart.toByteArray()))
        .build(),
      HttpResponse.BodyHandlers.ofString()
    );
    assertEquals(201, response.statusCode(), response.body());
    String imageId = (String) (
      (Map<?, ?>) json.readValue(response.body(), Map.class).get("data")
    ).get("id");
    other.request(
      "POST",
      "/listings",
      Map.of(
        "title",
        "Book",
        "description",
        "Book",
        "priceMinor",
        100,
        "categoryId",
        "11111111-1111-4111-8111-111111111111",
        "buildingId",
        "22222222-2222-4222-8222-222222222221",
        "conditionCode",
        "GOOD",
        "imageIds",
        List.of(imageId)
      ),
      404
    );
    var privateImage = other.client.send(
      HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1/images/" + imageId))
        .GET()
        .build(),
      HttpResponse.BodyHandlers.ofString()
    );
    assertEquals(404, privateImage.statusCode());
  }

  @Test
  void disabledZonesAndRestrictedUsersCannotCreateNewBusiness() throws Exception {
    var administrator = user();
    var student = user();
    db.exec("update users set role='ADMIN' where id=?", administrator.id);
    var zone = administrator.request(
      "POST",
      "/admin/zones",
      Map.of(
        "titleZh",
        "专区",
        "titleEn",
        "Collection",
        "startsAt",
        "2026-01-01T00:00:00Z",
        "endsAt",
        "2027-12-31T00:00:00Z",
        "enabled",
        false
      ),
      201
    );
    student.request("GET", "/zones/" + zone.get("id") + "/listings", null, 404);
    administrator.request(
      "POST",
      "/admin/users/" + student.id + "/restriction",
      Map.of("restricted", true, "reason", "test"),
      200
    );
    student.request("POST", "/listings", Map.of(), 403);
    assertTrue(db.rows("select * from moderation_logs where target_id=?", student.id).size() > 0);
  }
}
