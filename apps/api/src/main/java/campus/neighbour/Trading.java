package campus.neighbour;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class Trading {

  final Db db;
  final Accounts a;
  final Catalog catalog;
  final Chat chat;
  final Idempotency idem;
  final Events events;

  Trading(Db d, Accounts a, Catalog c, Chat h, Idempotency i, Events e) {
    db = d;
    this.a = a;
    catalog = c;
    chat = h;
    idem = i;
    events = e;
  }

  Map<String, Object> trade(String id, boolean lock) {
    String actor = a.actor();
    return db.one(
      "select * from trades where id=? and (initiator_id=? or counterparty_id=?)" +
        (lock ? " for update" : ""),
      id,
      actor,
      actor
    );
  }

  Map<String, Object> detail(String id) {
    var t = trade(id, false);
    t.put("items", db.rows("select * from trade_items where trade_id=?", id));
    t.put("confirmations", db.rows("select * from trade_confirmations where trade_id=?", id));
    t.put(
      "reviews",
      db.rows(
        "select r.*,u.nickname from reviews r join users u on u.id=r.author_id where trade_id=?",
        id
      )
    );
    return t;
  }

  Map<String, Object> list(Map<String, String> q) {
    String actor = a.actor();
    String role = Pages.choice(q, "role", "buyer", "seller", "swap");
    String status = Pages.choice(
      q,
      "status",
      "WAITING_MEETUP",
      "PARTIALLY_CONFIRMED",
      "COMPLETED",
      "CANCELLED"
    );
    String sql = "select * from trades where (initiator_id=? or counterparty_id=?)";
    var p = new ArrayList<Object>(List.of(actor, actor));
    if (role != null) {
      if (role.equals("swap")) sql += " and kind='SWAP'";
      else {
        sql +=
          " and kind='SALE' and " +
          (role.equals("buyer") ? "counterparty_id" : "initiator_id") +
          "=?";
        p.add(actor);
      }
    }
    if (status != null) {
      sql += " and status=?";
      p.add(status);
    }
    return Pages.map(
      Pages.of(db, q, "trades:" + actor, sql, p, "created_at", "createdAt", "::timestamptz", false),
      row -> detail((String) row.get("id"))
    );
  }

  void available(Map<String, Object> l) {
    Problem.require(
      "AVAILABLE".equals(l.get("status")) && "VISIBLE".equals(l.get("moderationStatus")),
      409,
      "ITEM_UNAVAILABLE"
    );
    Problem.require(
      "ACTIVE".equals(
        db.one("select status from users where id=?", l.get("ownerId")).get("status")
      ),
      409,
      "ITEM_UNAVAILABLE"
    );
  }

  String create(
    String kind,
    String one,
    String two,
    String location,
    String time,
    List<Map<String, Object>> items
  ) {
    String tid = Db.id();
    db.exec(
      "insert into trades(id,kind,initiator_id,counterparty_id,meeting_location,meeting_at) values(?,?,?,?,?,?::timestamptz)",
      tid,
      kind,
      one,
      two,
      location,
      time
    );
    for (var item : items) {
      available(item);
      String owner = (String) item.get("ownerId");
      var snapshot = catalog.enrich(new LinkedHashMap<>(item));
      snapshot.remove("seller");
      db.exec(
        "insert into trade_items values(?,?,?,?,?::jsonb)",
        tid,
        item.get("id"),
        owner,
        owner.equals(one) ? two : one,
        db.encode(snapshot)
      );
      db.exec("insert into listing_reservations values(?,?)", item.get("id"), tid);
      db.exec("update listings set status='RESERVED',updated_at=now() where id=?", item.get("id"));
    }
    events.notify(one, "TRADE_CHANGED", "trade", tid);
    events.notify(two, "TRADE_CHANGED", "trade", tid);
    return tid;
  }

  @Transactional
  Map<String, Object> reserve(Map<String, Object> b, String key) {
    String actor = a.active();
    return idem.run(actor, "reserve", key, b, () -> {
      Input.only(b, "conversationId", "meetingLocation", "meetingAt", "expectedListingVersion");
      var c = chat.conversation(Input.id(b, "conversationId"), false);
      Problem.require(actor.equals(c.get("sellerId")), 403, "FORBIDDEN");
      Problem.require(
        "ACTIVE".equals(
          db.one("select status from users where id=? for share", c.get("buyerId")).get("status")
        ),
        403,
        "ACCOUNT_RESTRICTED"
      );
      var l = catalog.raw((String) c.get("listingId"), true);
      available(l);
      Problem.require(
        ((Number) l.get("contentVersion")).longValue() ==
          Input.number(b, "expectedListingVersion", 1, Integer.MAX_VALUE),
        409,
        "VERSION_CONFLICT"
      );
      return detail(
        create(
          "SALE",
          actor,
          (String) c.get("buyerId"),
          Input.text(b, "meetingLocation", 200),
          Input.meeting(b),
          List.of(l)
        )
      );
    });
  }

  @Transactional
  Map<String, Object> action(String id, boolean confirm, Map<String, Object> b, String key) {
    String actor = a.actor();
    return idem.run(actor, id + (confirm ? "confirm" : "cancel"), key, b, () -> {
      var t = trade(id, true);
      String status = (String) t.get("status");
      var items = db.rows("select * from trade_items where trade_id=? order by listing_id", id);
      if (confirm) {
        Problem.require(
          items.stream().anyMatch(i -> actor.equals(i.get("receiverId"))),
          403,
          "FORBIDDEN"
        );
        Problem.require(!status.equals("CANCELLED"), 409, "STATE_CONFLICT");
        if (
          status.equals("COMPLETED") ||
          db.optional(
            "select user_id from trade_confirmations where trade_id=? and user_id=?",
            id,
            actor
          ) != null
        ) return detail(id);
        db.exec(
          "insert into trade_confirmations(trade_id,user_id) values(?,?) on conflict do nothing",
          id,
          actor
        );
        boolean done =
          db.rows("select * from trade_confirmations where trade_id=?", id).size() == items.size();
        db.exec(
          "update trades set status=?,completed_at=case when ? then now() else null end where id=?",
          done ? "COMPLETED" : "PARTIALLY_CONFIRMED",
          done,
          id
        );
        if (done) {
          for (var item : items) {
            catalog.raw((String) item.get("listingId"), true);
            db.exec(
              "update listings set status=?,updated_at=now() where id=?",
              t.get("kind").equals("SALE") ? "SOLD" : "EXCHANGED",
              item.get("listingId")
            );
          }
          db.exec("delete from listing_reservations where trade_id=?", id);
        }
      } else {
        if (status.equals("CANCELLED")) return detail(id);
        Problem.require(status.equals("WAITING_MEETUP"), 409, "STATE_CONFLICT");
        String reason = Input.text(b, "reason", 300);
        db.exec(
          "update trades set status='CANCELLED',cancel_reason=?,cancelled_at=now() where id=?",
          reason,
          id
        );
        for (var item : items) {
          var l = catalog.raw((String) item.get("listingId"), true);
          db.exec(
            "update listings set status=?,updated_at=now() where id=?",
            "VISIBLE".equals(l.get("moderationStatus")) ? "AVAILABLE" : "WITHDRAWN",
            item.get("listingId")
          );
        }
        db.exec("delete from listing_reservations where trade_id=?", id);
      }
      events.notify((String) t.get("initiatorId"), "TRADE_CHANGED", "trade", id);
      events.notify((String) t.get("counterpartyId"), "TRADE_CHANGED", "trade", id);
      return detail(id);
    });
  }

  @Transactional
  Map<String, Object> review(String id, Map<String, Object> b, String key) {
    String actor = a.active();
    return idem.run(actor, id + "review", key, b, () -> {
      var t = trade(id, true);
      Problem.require("COMPLETED".equals(t.get("status")), 409, "STATE_CONFLICT");
      String recipient = (String) (
        actor.equals(t.get("initiatorId")) ? t.get("counterpartyId") : t.get("initiatorId")
      );
      String rid = Db.id();
      db.exec(
        "insert into reviews(id,trade_id,author_id,recipient_id,rating,comment) values(?,?,?,?,?,?)",
        rid,
        id,
        actor,
        recipient,
        Input.number(b, "rating", 1, 5),
        Input.optional(b, "comment", 300)
      );
      return db.one("select * from reviews where id=?", rid);
    });
  }

  @Transactional
  Map<String, Object> requestSwap(Map<String, Object> b) {
    String actor = a.active();
    Input.only(
      b,
      "offeredListingId",
      "requestedListingId",
      "offeredVersion",
      "requestedVersion",
      "meetingLocation",
      "meetingAt"
    );
    var own = catalog.raw(Input.id(b, "offeredListingId"), false);
    var other = catalog.raw(Input.id(b, "requestedListingId"), false);
    Problem.require(
      actor.equals(own.get("ownerId")) && !actor.equals(other.get("ownerId")),
      403,
      "FORBIDDEN"
    );
    available(own);
    available(other);
    Problem.require(
      Boolean.TRUE.equals(own.get("swapEnabled")) && Boolean.TRUE.equals(other.get("swapEnabled")),
      409,
      "STATE_CONFLICT"
    );
    long v1 = Input.number(b, "offeredVersion", 1, Integer.MAX_VALUE),
      v2 = Input.number(b, "requestedVersion", 1, Integer.MAX_VALUE);
    Problem.require(
      v1 == ((Number) own.get("contentVersion")).longValue() &&
        v2 == ((Number) other.get("contentVersion")).longValue(),
      409,
      "VERSION_CONFLICT"
    );
    String id = Db.id();
    db.exec(
      "insert into swap_requests(id,proposer_id,recipient_id,offered_listing_id,requested_listing_id,offered_version,requested_version,meeting_location,meeting_at) values(?,?,?,?,?,?,?,?,?::timestamptz)",
      id,
      actor,
      other.get("ownerId"),
      own.get("id"),
      other.get("id"),
      v1,
      v2,
      Input.text(b, "meetingLocation", 200),
      Input.meeting(b)
    );
    events.notify((String) other.get("ownerId"), "SWAP_REQUESTED", "swap", id);
    return swap(id, false);
  }

  Map<String, Object> swap(String id, boolean lock) {
    String actor = a.actor();
    return db.one(
      "select * from swap_requests where id=? and (proposer_id=? or recipient_id=?)" +
        (lock ? " for update" : ""),
      id,
      actor,
      actor
    );
  }

  Map<String, Object> swaps(Map<String, String> q) {
    String actor = a.actor();
    String direction = Pages.choice(q, "direction", "sent", "received");
    String status = Pages.choice(q, "status", "PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN");
    String sql = "select * from swap_requests where (proposer_id=? or recipient_id=?)";
    var p = new ArrayList<Object>(List.of(actor, actor));
    if (direction != null) {
      sql += " and " + (direction.equals("sent") ? "proposer_id" : "recipient_id") + "=?";
      p.add(actor);
    }
    if (status != null) {
      sql += " and status=?";
      p.add(status);
    }
    return Pages.of(
      db,
      q,
      "swaps:" + actor,
      sql,
      p,
      "created_at",
      "createdAt",
      "::timestamptz",
      false
    );
  }

  @Transactional
  Map<String, Object> swapAction(String id, String action, String key) {
    String actor = a.active();
    return idem.run(actor, id + action, key, Map.of(), () -> {
      var req = swap(id, true);
      Problem.require(
        actor.equals(req.get(action.equals("withdraw") ? "proposerId" : "recipientId")),
        403,
        "FORBIDDEN"
      );
      if (action.equals("accept") && "ACCEPTED".equals(req.get("status"))) return Map.of(
        "request",
        req,
        "trade",
        detail((String) req.get("tradeId"))
      );
      Problem.require("PENDING".equals(req.get("status")), 409, "STATE_CONFLICT");
      if (!action.equals("accept")) {
        Problem.require(Set.of("reject", "withdraw").contains(action), 404, "NOT_FOUND");
        db.exec(
          "update swap_requests set status=? where id=?",
          action.equals("reject") ? "REJECTED" : "WITHDRAWN",
          id
        );
        return swap(id, false);
      }
      List<String> ids = new ArrayList<>(
        List.of((String) req.get("offeredListingId"), (String) req.get("requestedListingId"))
      );
      Collections.sort(ids);
      Map<String, Map<String, Object>> locked = new HashMap<>();
      for (String lid : ids) locked.put(lid, catalog.raw(lid, true));
      var own = locked.get(req.get("offeredListingId"));
      var other = locked.get(req.get("requestedListingId"));
      available(own);
      available(other);
      Problem.require(
        Objects.equals(own.get("contentVersion"), req.get("offeredVersion")) &&
          Objects.equals(other.get("contentVersion"), req.get("requestedVersion")),
        409,
        "VERSION_CONFLICT"
      );
      Problem.require(
        java.time.Instant.parse(req.get("meetingAt").toString()).isAfter(java.time.Instant.now()),
        409,
        "STATE_CONFLICT"
      );
      String tid = create(
        "SWAP",
        (String) req.get("proposerId"),
        (String) req.get("recipientId"),
        (String) req.get("meetingLocation"),
        req.get("meetingAt").toString(),
        List.of(own, other)
      );
      db.exec("update swap_requests set status='ACCEPTED',trade_id=? where id=?", tid, id);
      return Map.of("request", swap(id, false), "trade", detail(tid));
    });
  }
}
