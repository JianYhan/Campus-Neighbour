package campus.neighbour;

import java.util.*;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

@Component
class Idempotency {

  final Db db;

  Idempotency(Db d) {
    db = d;
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> run(
    String actor,
    String op,
    String key,
    Object body,
    Supplier<Map<String, Object>> work
  ) {
    UUID.fromString(key);
    String payload = db.encode(body);
    db.rows("select pg_advisory_xact_lock(hashtextextended(?,0))", actor + op + key);
    var old = db.optional(
      "select * from idempotency_records where actor_id=? and operation=? and request_key=?",
      actor,
      op,
      key
    );
    if (old != null) {
      Problem.require(payload.equals(old.get("requestHash")), 409, "IDEMPOTENCY_CONFLICT");
      return (Map<String, Object>) old.get("response");
    }
    var result = work.get();
    db.exec(
      "insert into idempotency_records values(?,?,?,?,?::jsonb)",
      actor,
      op,
      key,
      payload,
      db.encode(result)
    );
    return result;
  }
}
