package campus.neighbour;

import jakarta.servlet.http.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.*;
import org.springframework.security.web.context.*;
import org.springframework.security.web.csrf.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class Api {

  final Db db;
  final Accounts a;
  final Catalog c;
  final Chat chat;
  final Trading t;
  final Administration admin;
  final Images images;
  final SecurityContextRepository contexts;

  Api(
    Db d,
    Accounts a,
    Catalog c,
    Chat h,
    Trading t,
    Administration admin,
    Images images,
    SecurityContextRepository contexts
  ) {
    db = d;
    this.a = a;
    this.c = c;
    chat = h;
    this.t = t;
    this.admin = admin;
    this.images = images;
    this.contexts = contexts;
  }

  Map<String, Object> data(Object value) {
    return Map.of("data", value);
  }

  Map<String, Object> page(Object list) {
    return data(Collections.singletonMap("items", list));
  }

  @GetMapping("/auth/csrf")
  Object csrf(CsrfToken token, HttpServletResponse res) {
    res.setHeader("Cache-Control", "no-store");
    return data(Map.of("token", token.getToken(), "headerName", token.getHeaderName()));
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  Object register(@RequestBody Map<String, Object> b) {
    return data(a.register(b));
  }

  @PostMapping("/auth/login")
  Object login(
    @RequestBody Map<String, Object> b,
    HttpServletRequest req,
    HttpServletResponse res
  ) {
    Input.only(b, "email", "password");
    var u = db.optional(
      "select * from users where email=?",
      Input.text(b, "email", 254).trim().toLowerCase(Locale.ROOT)
    );
    String password = Input.text(b, "password", 128);
    Problem.require(
      u != null && a.matches(password, (String) u.get("passwordHash")),
      401,
      "INVALID_CREDENTIALS"
    );
    if (req.getSession(false) != null) req.changeSessionId();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
      new UsernamePasswordAuthenticationToken(
        u.get("id"),
        null,
        List.of(new SimpleGrantedAuthority("ROLE_" + u.get("role")))
      )
    );
    SecurityContextHolder.setContext(context);
    contexts.saveContext(context, req, res);
    new HttpSessionCsrfTokenRepository().saveToken(null, req, res);
    return data(a.self((String) u.get("id")));
  }

  @PostMapping("/auth/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void logout(HttpServletRequest req, HttpServletResponse res) {
    a.actor();
    if (req.getSession(false) != null) req.getSession(false).invalidate();
    SecurityContextHolder.clearContext();
  }

  @GetMapping("/me")
  Object me() {
    return data(a.self(a.actor()));
  }

  @PatchMapping("/me/profile")
  Object updateProfile(@RequestBody Map<String, Object> b) {
    return data(a.update(b));
  }

  @GetMapping("/users/{id}/profile")
  Object profile(@PathVariable String id) {
    return data(a.profile(id));
  }

  @GetMapping("/dictionaries/{kind}")
  Object dictionaries(@PathVariable String kind) {
    return page(
      db.rows("select * from dictionaries where kind=? and active order by name_zh", kind)
    );
  }

  @GetMapping("/listings")
  Object listings(@RequestParam Map<String, String> q) {
    return data(c.page(q, false, false));
  }

  @GetMapping("/me/listings")
  Object mine(@RequestParam Map<String, String> q) {
    return data(c.page(q, true, false));
  }

  @GetMapping("/listings/{id}")
  Object listing(@PathVariable String id) {
    return data(c.detail(id));
  }

  @PostMapping("/listings")
  @ResponseStatus(HttpStatus.CREATED)
  Object publish(@RequestBody Map<String, Object> b) {
    return data(c.save(null, b));
  }

  @PatchMapping("/listings/{id}")
  Object edit(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(c.save(id, b));
  }

  @PostMapping("/listings/{id}/withdraw")
  Object withdraw(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(c.state(id, false, b));
  }

  @PostMapping("/listings/{id}/relist")
  Object relist(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(c.state(id, true, b));
  }

  @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  Object upload(@RequestParam MultipartFile file) throws IOException {
    return data(images.upload(file));
  }

  @GetMapping("/images/{id}")
  ResponseEntity<?> image(@PathVariable String id) {
    var i = images.accessible(id);
    Path path = images.root.resolve((String) i.get("storageKey")).normalize();
    Problem.require(path.startsWith(images.root) && Files.exists(path), 404, "NOT_FOUND");
    return ResponseEntity.ok()
      .header("Cache-Control", "private, no-store")
      .contentType(MediaType.parseMediaType((String) i.get("mimeType")))
      .body(new FileSystemResource(path));
  }

  @PostMapping("/conversations")
  @ResponseStatus(HttpStatus.CREATED)
  Object conversation(@RequestBody Map<String, Object> b) {
    return data(chat.create(Input.id(b, "listingId")));
  }

  @GetMapping("/conversations")
  Object conversations() {
    return page(chat.list());
  }

  @GetMapping("/conversations/{id}/messages")
  Object messages(@PathVariable String id, @RequestParam Map<String, String> q) {
    return data(chat.history(id, q));
  }

  @PostMapping("/conversations/{id}/messages")
  ResponseEntity<?> send(@PathVariable String id, @RequestBody Map<String, Object> b) {
    var m = chat.send(id, b);
    boolean replay = Boolean.TRUE.equals(m.remove("replayed"));
    return ResponseEntity.status(replay ? 200 : 201).body(data(m));
  }

  @PostMapping("/conversations/{id}/read")
  Object read(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(chat.read(id, Input.id(b, "lastReadMessageId")));
  }

  @GetMapping("/chat/templates")
  Object templates(@RequestParam(defaultValue = "zh-CN") String locale) {
    a.actor();
    return page(
      List.of("ASK_PRICE", "ASK_CONDITION", "ASK_LOCATION")
        .stream()
        .map(code -> Map.of("code", code, "text", ChatRules.template(code, locale)))
        .toList()
    );
  }

  @GetMapping("/trades")
  Object trades() {
    return page(t.list());
  }

  @GetMapping("/trades/{id}")
  Object trade(@PathVariable String id) {
    return data(t.detail(id));
  }

  @PostMapping("/trades")
  @ResponseStatus(HttpStatus.CREATED)
  Object reserve(@RequestBody Map<String, Object> b, @RequestHeader("Idempotency-Key") String key) {
    return data(t.reserve(b, key));
  }

  @PostMapping("/trades/{id}/cancel")
  Object cancel(
    @PathVariable String id,
    @RequestBody Map<String, Object> b,
    @RequestHeader("Idempotency-Key") String key
  ) {
    return data(t.action(id, false, b, key));
  }

  @PostMapping("/trades/{id}/confirm-receipt")
  Object confirm(@PathVariable String id, @RequestHeader("Idempotency-Key") String key) {
    return data(t.action(id, true, Map.of(), key));
  }

  @PostMapping("/trades/{id}/reviews")
  @ResponseStatus(HttpStatus.CREATED)
  Object review(
    @PathVariable String id,
    @RequestBody Map<String, Object> b,
    @RequestHeader("Idempotency-Key") String key
  ) {
    return data(t.review(id, b, key));
  }

  @GetMapping("/trades/{id}/reviews")
  Object reviews(@PathVariable String id) {
    t.trade(id, false);
    return page(db.rows("select * from reviews where trade_id=?", id));
  }

  @GetMapping("/users/{id}/reviews")
  Object userReviews(@PathVariable String id) {
    return page(
      db.rows(
        "select r.id,r.rating,r.comment,r.created_at,u.nickname from reviews r join users u on u.id=r.author_id where recipient_id=? order by r.created_at desc limit 100",
        id
      )
    );
  }

  @PostMapping("/swap-requests")
  @ResponseStatus(HttpStatus.CREATED)
  Object swap(@RequestBody Map<String, Object> b) {
    return data(t.requestSwap(b));
  }

  @GetMapping("/swap-requests")
  Object swaps() {
    return page(t.swaps());
  }

  @GetMapping("/swap-requests/{id}")
  Object swap(@PathVariable String id) {
    return data(t.swap(id, false));
  }

  @PostMapping("/swap-requests/{id}/{action}")
  Object swapAction(
    @PathVariable String id,
    @PathVariable String action,
    @RequestHeader("Idempotency-Key") String key
  ) {
    return data(t.swapAction(id, action, key));
  }

  @GetMapping("/notifications")
  Object notifications() {
    return page(
      db.rows(
        "select * from notifications where user_id=? order by created_at desc limit 100",
        a.actor()
      )
    );
  }

  @PostMapping("/notifications/{id}/read")
  Object notificationRead(@PathVariable String id) {
    String actor = a.actor();
    db.one("select id from notifications where id=? and user_id=?", id, actor);
    db.exec("update notifications set read_at=coalesce(read_at,now()) where id=?", id);
    return data(db.one("select * from notifications where id=?", id));
  }

  @GetMapping("/zones")
  Object zones() {
    return page(
      db.rows(
        "select *, (enabled and now()>=starts_at and now()<ends_at) as active_now from seasonal_zones where enabled order by starts_at desc"
      )
    );
  }

  @GetMapping("/zones/{id}")
  Object zone(@PathVariable String id) {
    return data(
      db.one(
        "select *, (enabled and now()>=starts_at and now()<ends_at) as active_now from seasonal_zones where id=? and enabled",
        id
      )
    );
  }

  @GetMapping("/zones/{id}/listings")
  Object zoneItems(@PathVariable String id, @RequestParam Map<String, String> q) {
    return data(admin.zoneItems(id, q));
  }

  @GetMapping("/admin/listings")
  Object adminListings(@RequestParam Map<String, String> q) {
    return data(c.page(q, false, true));
  }

  @GetMapping("/admin/users")
  Object users() {
    a.admin();
    return page(
      db.rows("select id,nickname,status,role from users order by created_at desc limit 100")
    );
  }

  @PostMapping("/admin/listings/{id}/moderation")
  Object moderate(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(admin.moderate(id, b, false));
  }

  @PostMapping("/admin/users/{id}/restriction")
  Object restrict(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(admin.moderate(id, b, true));
  }

  @GetMapping("/admin/dictionaries/{kind}")
  Object adminDictionaries(@PathVariable String kind) {
    a.admin();
    return page(db.rows("select * from dictionaries where kind=? order by name_zh", kind));
  }

  @PostMapping("/admin/dictionaries/{kind}")
  @ResponseStatus(HttpStatus.CREATED)
  Object addDictionary(@PathVariable String kind, @RequestBody Map<String, Object> b) {
    return data(admin.dictionary(kind, null, b));
  }

  @PatchMapping("/admin/dictionaries/{kind}/{id}")
  Object editDictionary(
    @PathVariable String kind,
    @PathVariable String id,
    @RequestBody Map<String, Object> b
  ) {
    return data(admin.dictionary(kind, id, b));
  }

  @GetMapping("/admin/zones")
  Object adminZones() {
    a.admin();
    return page(db.rows("select * from seasonal_zones order by starts_at desc"));
  }

  @PostMapping("/admin/zones")
  @ResponseStatus(HttpStatus.CREATED)
  Object createZone(@RequestBody Map<String, Object> b) {
    return data(admin.zone(null, b));
  }

  @PatchMapping("/admin/zones/{id}")
  Object editZone(@PathVariable String id, @RequestBody Map<String, Object> b) {
    return data(admin.zone(id, b));
  }

  @GetMapping("/admin/audit-logs")
  Object audit() {
    a.admin();
    return page(db.rows("select * from moderation_logs order by created_at desc limit 100"));
  }
}
