package campus.neighbour;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.function.UnaryOperator;

/** Keyset pagination. SQL identifiers are supplied only by server code. */
final class Pages {

  static int limit(Map<String, String> q) {
    try {
      int limit = Integer.parseInt(q.getOrDefault("limit", "20"));
      Problem.field(limit > 0 && limit <= 100, "limit", "OUT_OF_RANGE");
      return limit;
    } catch (NumberFormatException e) {
      throw Problem.field("limit", "INVALID_FORMAT");
    }
  }

  static String choice(Map<String, String> q, String name, String... allowed) {
    String value = q.get(name);
    if (value == null || value.isBlank()) return null;
    Problem.field(Set.of(allowed).contains(value), name, "INVALID_FORMAT");
    return value;
  }

  static Map<String, Object> of(
    Db db,
    Map<String, String> q,
    String scope,
    String sql,
    List<Object> params,
    String column,
    String property,
    String cast,
    boolean ascending
  ) {
    int limit = limit(q);
    var filters = new TreeMap<>(q);
    filters.remove("cursor");
    filters.remove("limit");
    String context = scope + ":" + db.encode(filters);
    var args = new ArrayList<>(params);
    String cursor = q.get("cursor");
    if (cursor != null && !cursor.isBlank()) {
      Map<String, Object> boundary;
      try {
        Problem.field(cursor.length() <= 4096, "cursor", "INVALID_FORMAT");
        boundary = db.decode(
          new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8)
        );
        Problem.field(
          context.equals(boundary.get("context")) &&
            boundary.get("value") instanceof String &&
            boundary.get("id") instanceof String,
          "cursor",
          "INVALID_FORMAT"
        );
        UUID.fromString((String) boundary.get("id"));
        if (cast.equals("::timestamptz")) Instant.parse((String) boundary.get("value"));
      } catch (RuntimeException e) {
        throw Problem.field("cursor", "INVALID_FORMAT");
      }
      sql += " and (" + column + ",id) " + (ascending ? ">" : "<") + " (?" + cast + ",?)";
      args.add(boundary.get("value"));
      args.add(boundary.get("id"));
    }
    String direction = ascending ? " asc" : " desc";
    sql += " order by " + column + direction + ",id" + direction + " limit ?";
    args.add(limit + 1);
    var rows = db.rows(sql, args.toArray());
    var result = new LinkedHashMap<String, Object>();
    result.put("items", new ArrayList<>(rows.subList(0, Math.min(limit, rows.size()))));
    String next = null;
    if (rows.size() > limit) {
      var last = rows.get(limit - 1);
      next = Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(
          db
            .encode(
              Map.of(
                "context",
                context,
                "value",
                last.get(property).toString(),
                "id",
                last.get("id")
              )
            )
            .getBytes(StandardCharsets.UTF_8)
        );
    }
    result.put("nextCursor", next);
    return result;
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> map(
    Map<String, Object> page,
    UnaryOperator<Map<String, Object>> enrich
  ) {
    page.put(
      "items",
      ((List<Map<String, Object>>) page.get("items")).stream().map(enrich).toList()
    );
    return page;
  }
}
