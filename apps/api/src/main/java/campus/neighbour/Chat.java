package campus.neighbour;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class Chat {

  final Db db;
  final Accounts a;
  final Catalog catalog;
  final Events events;

  Chat(Db d, Accounts a, Catalog c, Events e) {
    db = d;
    this.a = a;
    catalog = c;
    events = e;
  }

  Map<String, Object> conversation(String id, boolean lock) {
    String actor = a.actor();
    return db.one(
      "select * from conversations where id=? and (buyer_id=? or seller_id=?)" +
        (lock ? " for update" : ""),
      id,
      actor,
      actor
    );
  }

  @Transactional
  Map<String, Object> create(String listing) {
    String actor = a.active();
    var l = catalog.detail(listing);
    Problem.require(!actor.equals(l.get("ownerId")), 422, "VALIDATION_ERROR");
    Problem.require("AVAILABLE".equals(l.get("status")), 409, "ITEM_UNAVAILABLE");
    String id = Db.id();
    db.exec(
      "insert into conversations(id,listing_id,buyer_id,seller_id) values(?,?,?,?) on conflict(listing_id,buyer_id,seller_id) do nothing",
      id,
      listing,
      actor,
      l.get("ownerId")
    );
    return db.one(
      "select * from conversations where listing_id=? and buyer_id=? and seller_id=?",
      listing,
      actor,
      l.get("ownerId")
    );
  }

  Map<String, Object> detail(String id) {
    return enrich(conversation(id, false));
  }

  Map<String, Object> enrich(Map<String, Object> c) {
    String actor = a.actor();
    var l = catalog.raw((String) c.get("listingId"), false);
    c.put("listingSummary", Map.of("title", l.get("title"), "priceMinor", l.get("priceMinor")));
    String other = (String) (actor.equals(c.get("buyerId")) ? c.get("sellerId") : c.get("buyerId"));
    c.put("otherUser", a.profile(other));
    c.put(
      "lastMessage",
      db.optional(
        "select * from messages where conversation_id=? order by sequence desc limit 1",
        c.get("id")
      )
    );
    c.put(
      "unreadCount",
      db
        .one(
          "select count(*) as count from messages where conversation_id=? and sender_id<>? and sequence>coalesce((select sequence from conversation_reads where conversation_id=? and user_id=?),0)",
          c.get("id"),
          actor,
          c.get("id"),
          actor
        )
        .get("count")
    );
    return c;
  }

  Map<String, Object> list(Map<String, String> q) {
    String actor = a.actor();
    return Pages.map(
      Pages.of(
        db,
        q,
        "conversations:" + actor,
        "select * from conversations where (buyer_id=? or seller_id=?)",
        List.of(actor, actor),
        "updated_at",
        "updatedAt",
        "::timestamptz",
        false
      ),
      this::enrich
    );
  }

  Map<String, Object> history(String id, Map<String, String> q) {
    conversation(id, false);
    Problem.require(
      !(q.containsKey("beforeCursor") && q.containsKey("afterCursor")),
      422,
      "VALIDATION_ERROR"
    );
    boolean after = q.containsKey("afterCursor");
    String cursorName = after ? "afterCursor" : "beforeCursor";
    long cursor;
    try {
      cursor = Long.parseLong(
        q.getOrDefault(cursorName, after ? "0" : String.valueOf(Long.MAX_VALUE))
      );
    } catch (NumberFormatException e) {
      throw Problem.field(cursorName, "INVALID_FORMAT");
    }
    Problem.field(cursor >= 0, cursorName, "OUT_OF_RANGE");

    int limit = Pages.limit(q);
    var rows = new ArrayList<>(
      db.rows(
        "select * from messages where conversation_id=? and sequence" +
          (after ? ">" : "<") +
          "? order by sequence " +
          (after ? "asc" : "desc") +
          " limit ?",
        id,
        cursor,
        limit + 1
      )
    );
    boolean more = rows.size() > limit;
    if (more) rows.removeLast();
    Object next = rows.isEmpty() ? null : rows.getLast().get("sequence");
    if (!after) Collections.reverse(rows);
    var result = new LinkedHashMap<String, Object>();
    result.put("items", rows);
    result.put("nextCursor", more ? String.valueOf(next) : null);
    return result;
  }

  @Transactional
  Map<String, Object> send(String id, Map<String, Object> b) {
    String actor = a.active();
    Input.only(b, "clientMessageId", "kind", "text", "templateCode", "locale");
    var c = conversation(id, true);
    String client = Input.id(b, "clientMessageId"),
      kind = Input.text(b, "kind", 20),
      text;
    String code = null,
      locale = null;
    try {
      if (kind.equals("TEXT")) {
        Problem.require(
          !b.containsKey("templateCode") && !b.containsKey("locale"),
          422,
          "VALIDATION_ERROR"
        );
        text = ChatRules.text(Input.text(b, "text", 1000));
      } else {
        Problem.require(kind.equals("TEMPLATE") && !b.containsKey("text"), 422, "VALIDATION_ERROR");
        code = Input.text(b, "templateCode", 30);
        locale = Input.text(b, "locale", 10);
        text = ChatRules.template(code, locale);
      }
    } catch (IllegalArgumentException e) {
      throw new Problem(422, "MESSAGE_TOO_LONG");
    }
    var old = db.optional(
      "select * from messages where sender_id=? and client_message_id=?",
      actor,
      client
    );
    if (old != null) {
      Problem.require(
        id.equals(old.get("conversationId")) &&
          text.equals(old.get("body")) &&
          kind.equals(old.get("kind")),
        409,
        "IDEMPOTENCY_CONFLICT"
      );
      old.put("replayed", true);
      return old;
    }
    long sequence = ((Number) c.get("sequence")).longValue() + 1;
    String mid = Db.id();
    db.exec(
      "insert into messages(id,conversation_id,sender_id,client_message_id,sequence,kind,body,template_code,locale) values(?,?,?,?,?,?,?,?,?)",
      mid,
      id,
      actor,
      client,
      sequence,
      kind,
      text,
      code,
      locale
    );
    db.exec("update conversations set sequence=?,updated_at=now() where id=?", sequence, id);
    String other = (String) (actor.equals(c.get("buyerId")) ? c.get("sellerId") : c.get("buyerId"));
    events.notify(other, "MESSAGE_CREATED", "conversation", id);
    return db.one("select * from messages where id=?", mid);
  }

  @Transactional
  Map<String, Object> read(String id, String mid) {
    String actor = a.actor();
    conversation(id, false);
    var m = db.one("select sequence from messages where id=? and conversation_id=?", mid, id);
    db.exec(
      "insert into conversation_reads values(?,?,?) on conflict(conversation_id,user_id) do update set sequence=greatest(conversation_reads.sequence,excluded.sequence)",
      id,
      actor,
      m.get("sequence")
    );
    return Map.of(
      "unreadCount",
      db
        .one(
          "select count(*) as count from messages where conversation_id=? and sender_id<>? and sequence>coalesce((select sequence from conversation_reads where conversation_id=? and user_id=?),0)",
          id,
          actor,
          id,
          actor
        )
        .get("count")
    );
  }
}
