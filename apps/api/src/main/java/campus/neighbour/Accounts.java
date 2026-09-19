package campus.neighbour;

import java.util.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Accounts {

  final Db db;
  final PasswordEncoder passwords;

  Accounts(Db db, PasswordEncoder p) {
    this.db = db;
    this.passwords = p;
  }

  public boolean matches(String raw, String encoded) {
    return passwords.matches(raw, encoded);
  }

  public String actor() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    Problem.require(a != null && !a.getName().equals("anonymousUser"), 401, "UNAUTHENTICATED");
    db.one("select id from users where id=?", a.getName());
    return a.getName();
  }

  public String maybe() {
    var a = SecurityContextHolder.getContext().getAuthentication();
    return a == null || a.getName().equals("anonymousUser") ? "" : a.getName();
  }

  public String active() {
    String id = actor();
    Problem.require(
      "ACTIVE".equals(db.one("select status from users where id=?", id).get("status")),
      403,
      "ACCOUNT_RESTRICTED"
    );
    return id;
  }

  public String admin() {
    String id = active();
    Problem.require(
      "ADMIN".equals(db.one("select role from users where id=?", id).get("role")),
      403,
      "FORBIDDEN"
    );
    return id;
  }

  @Transactional
  public Map<String, Object> register(Map<String, Object> b) {
    Input.only(b, "email", "password", "nickname");
    String email = Input.text(b, "email", 254).trim().toLowerCase(Locale.ROOT);
    Problem.field(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"), "email", "INVALID_FORMAT");
    String password = Input.text(b, "password", 128);
    Problem.field(password.length() >= 12, "password", "TOO_SHORT");
    String id = Db.id();
    db.exec(
      "insert into users(id,email,password_hash,nickname) values(?,?,?,?)",
      id,
      email,
      passwords.encode(password),
      Input.text(b, "nickname", 40)
    );
    return self(id);
  }

  public Map<String, Object> self(String id) {
    var u = db.one("select id,email,nickname,role,status from users where id=?", id);
    u.put("verified", false);
    u.put("profile", profile(id));
    return u;
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> profile(String id) {
    var u = db.one("select id,nickname,profile from users where id=?", id);
    var p = new LinkedHashMap<String, Object>((Map<String, Object>) u.get("profile"));
    p.put("userId", id);
    p.put("nickname", u.get("nickname"));
    return p;
  }

  @Transactional
  public Map<String, Object> update(Map<String, Object> b) {
    String id = active();
    Input.only(b, "nickname", "college", "major", "year", "bio", "courses");
    var p = profile(id);
    p.remove("userId");
    String nickname = b.containsKey("nickname")
      ? Input.text(b, "nickname", 40)
      : (String) p.get("nickname");
    p.remove("nickname");
    for (var key : List.of("college", "major", "year", "bio"))
      if (b.containsKey(key)) p.put(
        key,
        Input.optional(b, key, key.equals("bio") ? 500 : key.equals("year") ? 20 : 100)
      );
    if (b.containsKey("courses")) {
      Problem.require(b.get("courses") instanceof List<?>, 422, "VALIDATION_ERROR");
      var list = (List<?>) b.get("courses");
      Problem.require(list.size() <= 20, 422, "VALIDATION_ERROR");
      for (Object o : list) {
        Problem.require(o instanceof Map<?, ?>, 422, "VALIDATION_ERROR");
        var c = (Map<String, Object>) o;
        Input.only(c, "courseId", "teacher", "description");
        db.one(
          "select id from dictionaries where id=? and kind='courses' and active",
          Input.id(c, "courseId")
        );
        Input.optional(c, "teacher", 100);
        Input.optional(c, "description", 500);
      }
      p.put("courses", list);
    }
    db.exec("update users set nickname=?,profile=?::jsonb where id=?", nickname, db.encode(p), id);
    return profile(id);
  }
}
