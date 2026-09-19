package campus.neighbour;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class Catalog {

  final Db db;
  final Accounts accounts;

  Catalog(Db db, Accounts a) {
    this.db = db;
    accounts = a;
  }

  public Map<String, Object> raw(String id, boolean lock) {
    return db.one("select * from listings where id=?" + (lock ? " for update" : ""), id);
  }

  public Map<String, Object> detail(String id) {
    var l = raw(id, false);
    String viewer = accounts.maybe();
    boolean owner = viewer.equals(l.get("ownerId"));
    boolean publicView =
      "VISIBLE".equals(l.get("moderationStatus")) && !"WITHDRAWN".equals(l.get("status"));
    Problem.require(owner || publicView, 404, "NOT_FOUND");
    return enrich(l);
  }

  public Map<String, Object> enrich(Map<String, Object> l) {
    String id = (String) l.get("id");
    l.put(
      "images",
      db
        .rows(
          "select i.id,li.position from listing_images li join images i on i.id=li.image_id where li.listing_id=? order by li.position",
          id
        )
        .stream()
        .map(i -> {
          i.put("url", "/api/v1/images/" + i.get("id"));
          return i;
        })
        .toList()
    );
    var imgs = (List<?>) l.get("images");
    l.put("coverUrl", imgs.isEmpty() ? null : ((Map<?, ?>) imgs.getFirst()).get("url"));
    l.put("currency", "CNY");
    l.put("seller", accounts.profile((String) l.get("ownerId")));
    for (String f : List.of("category", "building", "course")) {
      Object key = l.get(f + "Id");
      l.put(f, key == null ? null : db.one("select * from dictionaries where id=?", key));
    }
    return l;
  }

  public Map<String, Object> page(Map<String, String> q, boolean mine, boolean admin) {
    StringBuilder sql = new StringBuilder("select * from listings where 1=1");
    List<Object> p = new ArrayList<>();
    if (mine) {
      sql.append(" and owner_id=?");
      p.add(accounts.actor());
    } else if (!admin) sql.append(" and status='AVAILABLE' and moderation_status='VISIBLE'");
    else accounts.admin();
    for (String key : List.of(
      "categoryId",
      "buildingId",
      "courseId",
      "status",
      "moderationStatus"
    )) {
      if (q.containsKey(key) && !q.get(key).isBlank()) {
        if (!mine && !admin && (key.equals("status") || key.equals("moderationStatus"))) continue;
        String column = key.replaceAll("([A-Z])", "_$1").toLowerCase();
        sql.append(" and " + column + "=?");
        p.add(q.get(key));
      }
    }
    if (q.containsKey("q") && !q.get("q").isBlank()) {
      Problem.require(q.get("q").length() <= 100, 422, "VALIDATION_ERROR");
      sql.append(" and (title ilike ? or description ilike ?)");
      String pattern =
        "%" + q.get("q").replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      p.add(pattern);
      p.add(pattern);
    }
    long min = Long.parseLong(q.getOrDefault("minPriceMinor", "0")),
      max = Long.parseLong(q.getOrDefault("maxPriceMinor", "999999999"));
    Problem.require(min >= 0 && max >= min, 422, "VALIDATION_ERROR");
    sql.append(" and price_minor between ? and ?");
    p.add(min);
    p.add(max);
    if ("true".equals(q.get("swapEnabled"))) sql.append(" and swap_enabled");
    String sort = q.getOrDefault("sort", "NEWEST");
    Problem.require(
      Set.of("NEWEST", "PRICE_ASC", "PRICE_DESC").contains(sort),
      422,
      "VALIDATION_ERROR"
    );
    String field = sort.equals("NEWEST") ? "created_at" : "price_minor";
    String direction = sort.equals("PRICE_ASC") ? "asc" : "desc";
    String comparator = direction.equals("asc") ? ">" : "<";
    String cursor = q.getOrDefault("cursor", "0");
    if (!cursor.equals("0") && !cursor.isBlank()) {
      Map<String, Object> boundary = db.decode(
        new String(Base64.getUrlDecoder().decode(cursor), java.nio.charset.StandardCharsets.UTF_8)
      );
      Problem.require(sort.equals(boundary.get("sort")), 422, "VALIDATION_ERROR");
      String cast = sort.equals("NEWEST") ? "::timestamptz" : "::bigint";
      sql.append(" and (" + field + ",id) " + comparator + " (?" + cast + ",?)");
      p.add(boundary.get("value").toString());
      p.add(boundary.get("id"));
    }
    int limit = Integer.parseInt(q.getOrDefault("limit", "20"));
    Problem.require(limit > 0 && limit <= 100, 422, "VALIDATION_ERROR");
    sql.append(" order by " + field + " " + direction + ",id " + direction + " limit ?");
    p.add(limit + 1);
    var rows = db.rows(sql.toString(), p.toArray());
    boolean more = rows.size() > limit;
    var result = new LinkedHashMap<String, Object>();
    result.put("items", rows.stream().limit(limit).map(this::enrich).toList());
    String next = null;
    if (more) {
      var last = rows.get(limit - 1);
      next = Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
          db
            .encode(
              Map.of(
                "sort",
                sort,
                "value",
                last.get(sort.equals("NEWEST") ? "createdAt" : "priceMinor"),
                "id",
                last.get("id")
              )
            )
            .getBytes(java.nio.charset.StandardCharsets.UTF_8)
        );
    }
    result.put("nextCursor", next);
    return result;
  }

  void dictionary(Object id, String kind) {
    dictionary(id, kind, false);
  }

  void dictionary(Object id, String kind, boolean allowInactive) {
    String field = switch (kind) {
      case "categories" -> "categoryId";
      case "buildings" -> "buildingId";
      default -> "courseId";
    };
    Problem.field(
      db.optional(
        "select id from dictionaries where id=? and kind=? and (? or active)",
        id,
        kind,
        allowInactive
      ) != null,
      field,
      "INVALID_REFERENCE"
    );
  }

  @SuppressWarnings("unchecked")
  @Transactional
  public Map<String, Object> save(String id, Map<String, Object> b) {
    String owner = accounts.active();
    Input.only(
      b,
      "title",
      "description",
      "priceMinor",
      "categoryId",
      "buildingId",
      "courseId",
      "conditionCode",
      "bookAuthor",
      "bookEdition",
      "swapEnabled",
      "wantedDescription",
      "imageIds",
      "expectedVersion"
    );
    if (id != null) {
      var l = raw(id, true);
      Problem.require(owner.equals(l.get("ownerId")), 403, "FORBIDDEN");
      Problem.require(
        Set.of("AVAILABLE", "WITHDRAWN").contains(l.get("status")),
        409,
        "STATE_CONFLICT"
      );
      Problem.require(
        Input.number(b, "expectedVersion", 1, Integer.MAX_VALUE) ==
          ((Number) l.get("contentVersion")).longValue(),
        409,
        "VERSION_CONFLICT"
      );
    }
    String title = Input.text(b, "title", 80),
      description = Input.text(b, "description", 2000),
      category = Input.id(b, "categoryId"),
      building = Input.id(b, "buildingId"),
      course = Input.optionalId(b, "courseId"),
      condition = Input.text(b, "conditionCode", 20);
    dictionary(category, "categories");
    dictionary(building, "buildings");
    if (course != null) dictionary(course, "courses");
    Problem.field(
      Set.of("NEW", "LIKE_NEW", "GOOD", "FAIR").contains(condition),
      "conditionCode",
      "INVALID_FORMAT"
    );
    long price = Input.number(b, "priceMinor", 0, 999999999);
    Problem.field(b.get("imageIds") != null, "imageIds", "REQUIRED");
    Problem.field(b.get("imageIds") instanceof List<?>, "imageIds", "INVALID_FORMAT");
    List<?> rawImages = (List<?>) b.get("imageIds");
    Problem.field(rawImages.size() >= 1 && rawImages.size() <= 6, "imageIds", "OUT_OF_RANGE");
    Problem.field(
      new HashSet<>(rawImages).size() == rawImages.size() &&
        rawImages.stream().allMatch(i -> i instanceof String),
      "imageIds",
      "INVALID_FORMAT"
    );
    List<String> images = (List<String>) rawImages;
    for (String image : images) {
      db.one("select id from images where id=? and owner_id=? for update", image, owner);
      var used = db.optional("select listing_id from listing_images where image_id=?", image);
      Problem.require(
        used == null || Objects.equals(used.get("listingId"), id),
        409,
        "STATE_CONFLICT"
      );
    }
    boolean swap = Input.bool(b, "swapEnabled", false);
    if (id == null) {
      id = Db.id();
      db.exec(
        "insert into listings(id,owner_id,title,description,price_minor,category_id,building_id,course_id,condition_code,book_author,book_edition,swap_enabled,wanted_description) values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        owner,
        title,
        description,
        price,
        category,
        building,
        course,
        condition,
        Input.optional(b, "bookAuthor", 100),
        Input.optional(b, "bookEdition", 100),
        swap,
        Input.optional(b, "wantedDescription", 500)
      );
    } else {
      db.exec(
        "update listings set title=?,description=?,price_minor=?,category_id=?,building_id=?,course_id=?,condition_code=?,book_author=?,book_edition=?,swap_enabled=?,wanted_description=?,content_version=content_version+1,updated_at=now() where id=?",
        title,
        description,
        price,
        category,
        building,
        course,
        condition,
        Input.optional(b, "bookAuthor", 100),
        Input.optional(b, "bookEdition", 100),
        swap,
        Input.optional(b, "wantedDescription", 500),
        id
      );
      db.exec("delete from listing_images where listing_id=?", id);
    }
    for (int n = 0; n < images.size(); n++) db.exec(
      "insert into listing_images values(?,?,?)",
      id,
      images.get(n),
      n
    );
    return detail(id);
  }

  @Transactional
  public Map<String, Object> state(String id, boolean relist, Map<String, Object> b) {
    String owner = accounts.active();
    var l = raw(id, true);
    Problem.require(owner.equals(l.get("ownerId")), 403, "FORBIDDEN");
    Problem.require(
      ((Number) l.get("contentVersion")).longValue() ==
        Input.number(b, "expectedVersion", 1, Integer.MAX_VALUE),
      409,
      "VERSION_CONFLICT"
    );
    Problem.require(
      (relist ? "WITHDRAWN" : "AVAILABLE").equals(l.get("status")) &&
        "VISIBLE".equals(l.get("moderationStatus")),
      409,
      "STATE_CONFLICT"
    );
    db.exec(
      "update listings set status=?,content_version=content_version+1,updated_at=now() where id=?",
      relist ? "AVAILABLE" : "WITHDRAWN",
      id
    );
    return detail(id);
  }
}
