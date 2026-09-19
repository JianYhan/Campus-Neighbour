package campus.neighbour;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class Administration {

  final Db db;
  final Accounts a;
  final Catalog catalog;

  Administration(Db d, Accounts a, Catalog c) {
    db = d;
    this.a = a;
    catalog = c;
  }

  @Transactional
  Map<String, Object> moderate(String id, Map<String, Object> b, boolean user) {
    String actor = a.admin();
    String reason = Input.text(b, "reason", 300);
    if (user) {
      Problem.require(b.get("restricted") instanceof Boolean, 422, "VALIDATION_ERROR");
      var target = db.one("select role from users where id=? for update", id);
      Problem.require(!"ADMIN".equals(target.get("role")), 403, "FORBIDDEN");
      db.exec(
        "update users set status=? where id=?",
        Boolean.TRUE.equals(b.get("restricted")) ? "RESTRICTED" : "ACTIVE",
        id
      );
    } else {
      String action = Input.text(b, "action", 20);
      Problem.require(Set.of("HIDE", "RESTORE").contains(action), 422, "VALIDATION_ERROR");
      catalog.raw(id, true);
      db.exec(
        "update listings set moderation_status=? where id=?",
        action.equals("HIDE") ? "HIDDEN" : "VISIBLE",
        id
      );
    }
    db.exec(
      "insert into moderation_logs(id,actor_id,target_type,target_id,action,reason) values(?,?,?,?,?,?)",
      Db.id(),
      actor,
      user ? "user" : "listing",
      id,
      user ? String.valueOf(b.get("restricted")) : b.get("action"),
      reason
    );
    return db.one(
      user
        ? "select id,status from users where id=?"
        : "select id,moderation_status from listings where id=?",
      id
    );
  }

  @Transactional
  Map<String, Object> dictionary(String kind, String id, Map<String, Object> b) {
    a.admin();
    Problem.require(Set.of("categories", "courses", "buildings").contains(kind), 404, "NOT_FOUND");
    Input.only(b, "nameZh", "nameEn", "active");
    if (id != null) {
      var merged = new LinkedHashMap<>(
        db.one("select * from dictionaries where id=? and kind=?", id, kind)
      );
      merged.putAll(b);
      b = merged;
    }
    String zh = Input.text(b, "nameZh", 100),
      en = Input.text(b, "nameEn", 100);
    boolean active = Input.bool(b, "active", true);
    if (id == null) {
      id = Db.id();
      db.exec("insert into dictionaries values(?,?,?,?,?)", id, kind, zh, en, active);
    } else db.exec(
      "update dictionaries set name_zh=?,name_en=?,active=? where id=? and kind=?",
      zh,
      en,
      active,
      id,
      kind
    );
    return db.one("select * from dictionaries where id=?", id);
  }

  @Transactional
  Map<String, Object> zone(String id, Map<String, Object> b) {
    a.admin();
    Input.only(
      b,
      "titleZh",
      "titleEn",
      "descriptionZh",
      "descriptionEn",
      "startsAt",
      "endsAt",
      "enabled",
      "categoryId",
      "buildingId"
    );
    Map<String, Object> previous =
      id == null ? Map.of() : db.one("select * from seasonal_zones where id=? for update", id);
    if (id != null) {
      var merged = new LinkedHashMap<>(previous);
      merged.putAll(b);
      b = merged;
    }
    String zh = Input.text(b, "titleZh", 100),
      en = Input.text(b, "titleEn", 100),
      start = Input.instant(b, "startsAt"),
      end = Input.instant(b, "endsAt");
    Problem.field(
      java.time.Instant.parse(end).isAfter(java.time.Instant.parse(start)),
      "endsAt",
      "OUT_OF_RANGE"
    );
    String category = Input.optionalId(b, "categoryId"),
      building = Input.optionalId(b, "buildingId");
    if (category != null) catalog.dictionary(
      category,
      "categories",
      category.equals(previous.get("categoryId"))
    );
    if (building != null) catalog.dictionary(
      building,
      "buildings",
      building.equals(previous.get("buildingId"))
    );
    if (id == null) {
      id = Db.id();
      db.exec(
        "insert into seasonal_zones(id,title_zh,title_en,description_zh,description_en,starts_at,ends_at,enabled,category_id,building_id) values(?,?,?,?,?,?::timestamptz,?::timestamptz,?,?,?)",
        id,
        zh,
        en,
        Input.optional(b, "descriptionZh", 1000),
        Input.optional(b, "descriptionEn", 1000),
        start,
        end,
        Input.bool(b, "enabled", true),
        category,
        building
      );
    } else db.exec(
      "update seasonal_zones set title_zh=?,title_en=?,description_zh=?,description_en=?,starts_at=?::timestamptz,ends_at=?::timestamptz,enabled=?,category_id=?,building_id=? where id=?",
      zh,
      en,
      Input.optional(b, "descriptionZh", 1000),
      Input.optional(b, "descriptionEn", 1000),
      start,
      end,
      Input.bool(b, "enabled", true),
      category,
      building,
      id
    );
    return db.one("select * from seasonal_zones where id=?", id);
  }

  Map<String, Object> zoneItems(String id, Map<String, String> q) {
    var z = db.one(
      "select * from seasonal_zones where id=? and enabled and now()>=starts_at and now()<ends_at",
      id
    );
    var filter = new HashMap<>(q);
    if (z.get("categoryId") != null) filter.put("categoryId", z.get("categoryId").toString());
    if (z.get("buildingId") != null) filter.put("buildingId", z.get("buildingId").toString());
    return catalog.page(filter, false, false);
  }
}
