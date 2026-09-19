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

  @SuppressWarnings("unchecked")
  List<Map<String, Object>> items(Map<String, Object> page) {
    return (List<Map<String, Object>>) page.get("items");
  }

  Map<String, Object> fields(Map<String, Object> failure) {
    return (Map<String, Object>) ((Map<?, ?>) failure.get("error")).get("fieldErrors");
  }

  String seededTrade(Client seller, Client buyer, String kind, String status) {
    String id = Db.id();
    db.exec(
      "insert into trades(id,kind,initiator_id,counterparty_id,status,meeting_location,meeting_at,created_at) values(?,?,?,?,?,'Library',now()+interval '1 day','2026-01-01T00:00:00Z')",
      id,
      kind,
      seller.id,
      buyer.id,
      status
    );
    return id;
  }

  @Test
  void round2TradePagesRespectRoleStatusAndStableBoundary() throws Exception {
    var me = user();
    var other = user();
    var stranger = user();
    var firstId = seededTrade(me, other, "SALE", "WAITING_MEETUP");
    var secondId = seededTrade(me, other, "SALE", "WAITING_MEETUP");
    seededTrade(me, other, "SALE", "COMPLETED");
    var boughtId = seededTrade(other, me, "SALE", "WAITING_MEETUP");
    var swapId = seededTrade(me, other, "SWAP", "WAITING_MEETUP");
    seededTrade(other, stranger, "SALE", "WAITING_MEETUP");
    var first = me.request("GET", "/trades?role=seller&status=WAITING_MEETUP&limit=1", null, 200);
    assertEquals(1, items(first).size());
    assertNotNull(first.get("nextCursor"));
    String newer = seededTrade(me, other, "SALE", "WAITING_MEETUP");
    db.exec("update trades set created_at=now() where id=?", newer);
    var second = me.request(
      "GET",
      "/trades?role=seller&status=WAITING_MEETUP&limit=1&cursor=" + first.get("nextCursor"),
      null,
      200
    );
    assertEquals(1, items(second).size());
    assertEquals(
      Set.of(firstId, secondId),
      Set.of(items(first).getFirst().get("id"), items(second).getFirst().get("id"))
    );
    assertTrue(second.containsKey("nextCursor"));
    assertNull(second.get("nextCursor"));
    assertEquals(
      boughtId,
      items(me.request("GET", "/trades?role=buyer", null, 200))
        .getFirst()
        .get("id")
    );
    assertEquals(
      swapId,
      items(me.request("GET", "/trades?role=swap", null, 200))
        .getFirst()
        .get("id")
    );
    me.request("GET", "/trades?role=invalid", null, 422);
    me.request("GET", "/trades?limit=101", null, 422);
    me.request("GET", "/trades?cursor=invalid", null, 422);
    me.request("GET", "/trades?role=buyer&cursor=" + first.get("nextCursor"), null, 422);
  }

  @Test
  void round2ConversationDetailIsEnrichedAndPrivate() throws Exception {
    var seller = user();
    var buyer = user();
    var outsider = user();
    String first = null;
    for (int n = 0; n < 3; n++) {
      String cid = (String) buyer
        .request("POST", "/conversations", Map.of("listingId", listing(seller).get("id")), 201)
        .get("id");
      if (first == null) first = cid;
    }
    buyer.request(
      "POST",
      "/conversations/" + first + "/messages",
      Map.of("clientMessageId", Db.id(), "kind", "TEXT", "text", "hello"),
      201
    );
    var detail = seller.request("GET", "/conversations/" + first, null, 200);
    assertEquals("hello", ((Map<?, ?>) detail.get("lastMessage")).get("body"));
    assertEquals(buyer.id, ((Map<?, ?>) detail.get("otherUser")).get("userId"));
    assertNotNull(detail.get("listingSummary"));
    assertEquals(1, ((Number) detail.get("unreadCount")).intValue());
    outsider.request("GET", "/conversations/" + first, null, 404);
    var page = seller.request("GET", "/conversations?limit=2", null, 200);
    assertEquals(2, items(page).size());
    assertNotNull(page.get("nextCursor"));
    var next = seller.request(
      "GET",
      "/conversations?limit=2&cursor=" + page.get("nextCursor"),
      null,
      200
    );
    assertEquals(1, items(next).size());
    assertNull(next.get("nextCursor"));
  }

  @Test
  void round2NotificationsSwapsAndPublicReviewsPaginate() throws Exception {
    var me = user();
    var other = user();
    var stranger = user();
    String mine = (String) listing(me).get("id"),
      theirs = (String) listing(other).get("id");
    for (int n = 0; n < 3; n++) {
      String tid = seededTrade(me, other, "SALE", "COMPLETED");
      db.exec(
        "insert into reviews(id,trade_id,author_id,recipient_id,rating,comment) values(?,?,?,?,5,'Good')",
        Db.id(),
        tid,
        other.id,
        me.id
      );
      db.exec(
        "insert into notifications(id,user_id,type,resource_type,resource_id,read_at) values(?,?,'TRADE_CHANGED','trade',?,case when ? then now() else null end)",
        Db.id(),
        me.id,
        tid,
        n == 2
      );
      db.exec(
        "insert into swap_requests(id,proposer_id,recipient_id,offered_listing_id,requested_listing_id,offered_version,requested_version,meeting_location,meeting_at,status) values(?,?,?,?,?,1,1,'Library',now()+interval '1 day',?)",
        Db.id(),
        me.id,
        other.id,
        mine,
        theirs,
        n == 2 ? "WITHDRAWN" : "PENDING"
      );
    }
    var notifications = me.request("GET", "/notifications?unreadOnly=true&limit=1", null, 200);
    assertEquals(1, items(notifications).size());
    assertNotNull(notifications.get("nextCursor"));
    var next = me.request(
      "GET",
      "/notifications?unreadOnly=true&limit=1&cursor=" + notifications.get("nextCursor"),
      null,
      200
    );
    assertEquals(1, items(next).size());
    assertNull(next.get("nextCursor"));
    assertEquals(0, items(stranger.request("GET", "/notifications", null, 200)).size());
    assertEquals(
      0,
      items(me.request("GET", "/swap-requests?direction=received", null, 200)).size()
    );
    var swaps = me.request(
      "GET",
      "/swap-requests?direction=sent&status=PENDING&limit=1",
      null,
      200
    );
    assertEquals(1, items(swaps).size());
    assertNotNull(swaps.get("nextCursor"));
    other.request(
      "GET",
      "/swap-requests?direction=received&status=PENDING&limit=1&cursor=" + swaps.get("nextCursor"),
      null,
      422
    );
  }

  @Test
  void round2ReviewsAndAdminListsHaveBoundariesAndFilters() throws Exception {
    var admin = user();
    var student = user();
    var other = user();
    db.exec("update users set role='ADMIN' where id=?", admin.id);
    db.exec(
      "update users set nickname='UniqueRoundTwo',status='RESTRICTED' where id=?",
      student.id
    );
    for (int n = 0; n < 3; n++) {
      String tid = seededTrade(student, other, "SALE", "COMPLETED");
      db.exec(
        "insert into reviews(id,trade_id,author_id,recipient_id,rating,comment) values(?,?,?,?,5,'Good')",
        Db.id(),
        tid,
        other.id,
        student.id
      );
      db.exec(
        "insert into moderation_logs(id,actor_id,target_type,target_id,action,reason) values(?,?,'user',?,'true','test')",
        Db.id(),
        admin.id,
        student.id
      );
      db.exec(
        "insert into seasonal_zones(id,title_zh,title_en,starts_at,ends_at,enabled) values(?,'专区','Collection','2026-01-01T00:00:00Z','2027-01-01T00:00:00Z',false)",
        Db.id()
      );
    }
    var reviews = new Client().request(
      "GET",
      "/users/" + student.id + "/reviews?limit=2",
      null,
      200
    );
    assertEquals(2, items(reviews).size());
    assertNotNull(reviews.get("nextCursor"));
    assertFalse(items(reviews).getFirst().containsKey("tradeId"));
    var last = new Client().request(
      "GET",
      "/users/" + student.id + "/reviews?limit=2&cursor=" + reviews.get("nextCursor"),
      null,
      200
    );
    assertEquals(1, items(last).size());
    assertNull(last.get("nextCursor"));
    assertEquals(
      student.id,
      items(admin.request("GET", "/admin/users?q=UniqueRoundTwo&status=RESTRICTED", null, 200))
        .getFirst()
        .get("id")
    );
    assertEquals(
      0,
      items(admin.request("GET", "/admin/users?q=UniqueRoundTwo&status=ACTIVE", null, 200)).size()
    );
    for (String path : List.of(
      "/admin/users",
      "/admin/dictionaries/categories",
      "/admin/zones",
      "/admin/audit-logs?targetType=user&targetId=" + student.id
    )) {
      String separator = path.contains("?") ? "&" : "?";
      var page = admin.request("GET", path + separator + "limit=1", null, 200);
      assertEquals(1, items(page).size(), path);
      assertNotNull(page.get("nextCursor"), path);
      var next = admin.request(
        "GET",
        path + separator + "limit=1&cursor=" + page.get("nextCursor"),
        null,
        200
      );
      assertNotEquals(items(page).getFirst().get("id"), items(next).getFirst().get("id"), path);
    }
    student.request("GET", "/admin/zones?limit=1", null, 403);
  }

  @Test
  void round2RestrictedBuyerCannotBeReservedButCanFinishExistingTrade() throws Exception {
    var seller = user();
    var buyer = user();
    String existing = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", listing(seller).get("id")), 201)
      .get("id");
    String pending = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", listing(seller).get("id")), 201)
      .get("id");
    String tid = (String) seller.request("POST", "/trades", meeting(existing), 201).get("id");
    db.exec("update users set status='RESTRICTED' where id=?", buyer.id);
    seller.request("POST", "/trades", meeting(pending), 403);
    assertEquals(
      "COMPLETED",
      buyer.request("POST", "/trades/" + tid + "/confirm-receipt", Map.of(), 200).get("status")
    );
  }

  @Test
  void round2ValidationIdentifiesFieldsAndRejectsInvalidZoneReferences() throws Exception {
    var visitor = new Client();
    visitor.token();
    assertEquals(
      "INVALID_FORMAT",
      fields(
        visitor.request(
          "POST",
          "/auth/register",
          Map.of("email", "not-an-email", "nickname", "A", "password", "Campus-test-123!"),
          422
        )
      ).get("email")
    );
    assertEquals(
      "TOO_SHORT",
      fields(
        visitor.request(
          "POST",
          "/auth/register",
          Map.of("email", Db.id() + "@example.test", "nickname", "A", "password", "short"),
          422
        )
      ).get("password")
    );
    var seller = user();
    var buyer = user();
    var admin = user();
    db.exec("update users set role='ADMIN' where id=?", admin.id);
    assertEquals(
      "REQUIRED",
      fields(seller.request("POST", "/listings", Map.of(), 422)).get("title")
    );
    String cid = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", listing(seller).get("id")), 201)
      .get("id");
    var body = new HashMap<String, Object>(meeting(cid));
    body.put("meetingAt", "2020-01-01T00:00:00Z");
    assertEquals(
      "MUST_BE_FUTURE",
      fields(seller.request("POST", "/trades", body, 422)).get("meetingAt")
    );
    body.put("meetingAt", "not-a-date");
    assertEquals(
      "INVALID_FORMAT",
      fields(seller.request("POST", "/trades", body, 422)).get("meetingAt")
    );
    var zone = new HashMap<String, Object>(
      Map.of(
        "titleZh",
        "专区",
        "titleEn",
        "Collection",
        "startsAt",
        "2026-01-01T00:00:00Z",
        "endsAt",
        "2027-01-01T00:00:00Z",
        "categoryId",
        "22222222-2222-4222-8222-222222222221"
      )
    );
    assertEquals(
      "INVALID_REFERENCE",
      fields(admin.request("POST", "/admin/zones", zone, 422)).get("categoryId")
    );
    zone.remove("categoryId");
    zone.put("buildingId", Db.id());
    assertEquals(
      "INVALID_REFERENCE",
      fields(admin.request("POST", "/admin/zones", zone, 422)).get("buildingId")
    );
  }

  @Test
  void round2AdminPartialUpdatesPreserveZoneCriteriaAndDictionaryNames() throws Exception {
    var admin = user();
    db.exec("update users set role='ADMIN' where id=?", admin.id);
    var zone = admin.request(
      "POST",
      "/admin/zones",
      Map.of(
        "titleZh",
        "专区",
        "titleEn",
        "Collection",
        "descriptionZh",
        "旧说明",
        "descriptionEn",
        "Original description",
        "startsAt",
        "2026-01-01T00:00:00Z",
        "endsAt",
        "2027-01-01T00:00:00Z",
        "categoryId",
        "11111111-1111-4111-8111-111111111111",
        "buildingId",
        "22222222-2222-4222-8222-222222222221"
      ),
      201
    );
    var edited = admin.request(
      "PATCH",
      "/admin/zones/" + zone.get("id"),
      Map.of("enabled", false),
      200
    );
    assertEquals(zone.get("categoryId"), edited.get("categoryId"));
    assertEquals(zone.get("buildingId"), edited.get("buildingId"));
    assertEquals("Original description", edited.get("descriptionEn"));
    assertEquals(false, edited.get("enabled"));
    var dictionary = admin.request(
      "POST",
      "/admin/dictionaries/categories",
      Map.of("nameZh", "新分类", "nameEn", "New category"),
      201
    );
    var changed = admin.request(
      "PATCH",
      "/admin/dictionaries/categories/" + dictionary.get("id"),
      Map.of("active", false),
      200
    );
    assertEquals("New category", changed.get("nameEn"));
    assertEquals(false, changed.get("active"));
    admin.request(
      "PATCH",
      "/admin/dictionaries/buildings/" + dictionary.get("id"),
      Map.of("active", true),
      404
    );
  }

  @Test
  void round2ChatReadLeavesNewerMessagesUnreadAndHistoryValidatesCursor() throws Exception {
    var seller = user();
    var buyer = user();
    String cid = (String) buyer
      .request("POST", "/conversations", Map.of("listingId", listing(seller).get("id")), 201)
      .get("id");
    String first = null,
      last = null;
    for (int n = 0; n < 3; n++) {
      last = (String) buyer
        .request(
          "POST",
          "/conversations/" + cid + "/messages",
          Map.of("clientMessageId", Db.id(), "kind", "TEXT", "text", "hello " + n),
          201
        )
        .get("id");
      if (first == null) first = last;
    }
    assertEquals(
      2,
      (
        (Number) seller
          .request(
            "POST",
            "/conversations/" + cid + "/read",
            Map.of("lastReadMessageId", first),
            200
          )
          .get("unreadCount")
      ).intValue()
    );
    var page = seller.request("GET", "/conversations/" + cid + "/messages?limit=2", null, 200);
    assertEquals(
      List.of(2, 3),
      items(page)
        .stream()
        .map(m -> ((Number) m.get("sequence")).intValue())
        .toList()
    );
    var earlier = seller.request(
      "GET",
      "/conversations/" + cid + "/messages?limit=2&beforeCursor=" + page.get("nextCursor"),
      null,
      200
    );
    assertEquals(1, items(earlier).size());
    assertNull(earlier.get("nextCursor"));
    var later = seller.request(
      "GET",
      "/conversations/" + cid + "/messages?limit=1&afterCursor=1",
      null,
      200
    );
    assertEquals(2, ((Number) items(later).getFirst().get("sequence")).intValue());
    seller.request("GET", "/conversations/" + cid + "/messages?beforeCursor=-1", null, 422);
    seller.request("GET", "/conversations/" + cid + "/messages?afterCursor=abc", null, 422);
    seller.request(
      "POST",
      "/conversations/" + cid + "/read",
      Map.of("lastReadMessageId", last),
      200
    );
    assertEquals(
      0,
      (
        (Number) seller
          .request(
            "POST",
            "/conversations/" + cid + "/read",
            Map.of("lastReadMessageId", first),
            200
          )
          .get("unreadCount")
      ).intValue()
    );
  }

  @Test
  void round2PublishingProvidesFieldErrorsForInvalidTypesAndRanges() throws Exception {
    var seller = user();
    var body = new HashMap<String, Object>(
      Map.of(
        "title",
        "Book",
        "description",
        "Book",
        "priceMinor",
        -1,
        "categoryId",
        "11111111-1111-4111-8111-111111111111",
        "buildingId",
        "22222222-2222-4222-8222-222222222221",
        "conditionCode",
        "GOOD",
        "imageIds",
        List.of(123)
      )
    );
    assertEquals(
      "OUT_OF_RANGE",
      fields(seller.request("POST", "/listings", body, 422)).get("priceMinor")
    );
    body.put("priceMinor", 100);
    assertEquals(
      "INVALID_FORMAT",
      fields(seller.request("POST", "/listings", body, 422)).get("imageIds")
    );
    body.put("title", "x".repeat(81));
    assertEquals("TOO_LONG", fields(seller.request("POST", "/listings", body, 422)).get("title"));
    body.put("title", "Book");
    body.put("categoryId", "bad-id");
    assertEquals(
      "INVALID_FORMAT",
      fields(seller.request("POST", "/listings", body, 422)).get("categoryId")
    );
  }

  @Test
  void round2DefaultLimitDoesNotSilentlyTruncateAfterFirstPage() throws Exception {
    var me = user();
    for (int n = 0; n < 25; n++) db.exec(
      "insert into notifications(id,user_id,type,resource_type,resource_id) values(?,?,'TRADE_CHANGED','trade',?)",
      Db.id(),
      me.id,
      Db.id()
    );
    var first = me.request("GET", "/notifications", null, 200);
    assertEquals(20, items(first).size());
    assertNotNull(first.get("nextCursor"));
    var last = me.request("GET", "/notifications?cursor=" + first.get("nextCursor"), null, 200);
    assertEquals(5, items(last).size());
    assertNull(last.get("nextCursor"));
    assertEquals(
      25,
      java.util.stream.Stream.concat(items(first).stream(), items(last).stream())
        .map(row -> row.get("id"))
        .distinct()
        .count()
    );
    assertEquals(
      "INVALID_FORMAT",
      fields(me.request("GET", "/notifications?cursor=not-json", null, 422)).get("cursor")
    );
  }

  @Test
  void round2ZonesRetainExistingInactiveCriteriaButCannotChooseNewInactiveCriteria()
    throws Exception {
    var admin = user();
    db.exec("update users set role='ADMIN' where id=?", admin.id);
    var category = admin.request(
      "POST",
      "/admin/dictionaries/categories",
      Map.of("nameZh", "旧分类", "nameEn", "Original category"),
      201
    );
    var another = admin.request(
      "POST",
      "/admin/dictionaries/categories",
      Map.of("nameZh", "另一分类", "nameEn", "Other category", "active", false),
      201
    );
    var zone = admin.request(
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
        "2027-01-01T00:00:00Z",
        "categoryId",
        category.get("id")
      ),
      201
    );
    admin.request(
      "PATCH",
      "/admin/dictionaries/categories/" + category.get("id"),
      Map.of("active", false),
      200
    );
    var disabled = admin.request(
      "PATCH",
      "/admin/zones/" + zone.get("id"),
      Map.of("enabled", false),
      200
    );
    assertEquals(category.get("id"), disabled.get("categoryId"));
    assertEquals(false, disabled.get("enabled"));
    var described = admin.request(
      "PATCH",
      "/admin/zones/" + zone.get("id"),
      Map.of("descriptionEn", "Updated description", "categoryId", category.get("id")),
      200
    );
    assertEquals("Updated description", described.get("descriptionEn"));
    assertEquals(
      "INVALID_REFERENCE",
      fields(
        admin.request(
          "PATCH",
          "/admin/zones/" + zone.get("id"),
          Map.of("categoryId", another.get("id")),
          422
        )
      ).get("categoryId")
    );
    assertEquals(
      "INVALID_REFERENCE",
      fields(
        admin.request(
          "POST",
          "/admin/zones",
          Map.of(
            "titleZh",
            "新专区",
            "titleEn",
            "New collection",
            "startsAt",
            "2026-01-01T00:00:00Z",
            "endsAt",
            "2027-01-01T00:00:00Z",
            "categoryId",
            category.get("id")
          ),
          422
        )
      ).get("categoryId")
    );
  }
}
