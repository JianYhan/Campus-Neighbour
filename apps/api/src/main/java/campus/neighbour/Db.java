package campus.neighbour;

import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class Db {

  final DbMapper mapper;
  final JsonMapper json = new JsonMapper();

  public Db(DbMapper mapper) {
    this.mapper = mapper;
  }

  String bind(String sql) {
    int i = 0;
    StringBuilder b = new StringBuilder();
    for (char c : sql.toCharArray()) b.append(c == '?' ? "#{p[" + i++ + "]}" : String.valueOf(c));
    return b.toString();
  }

  public List<Map<String, Object>> rows(String sql, Object... p) {
    return mapper.query(bind(sql), p).stream().map(this::normalize).toList();
  }

  public Map<String, Object> one(String sql, Object... p) {
    var rows = rows(sql, p);
    if (rows.isEmpty()) throw new Problem(404, "NOT_FOUND");
    return rows.getFirst();
  }

  public Map<String, Object> optional(String sql, Object... p) {
    var rows = rows(sql, p);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  public int exec(String sql, Object... p) {
    return mapper.execute(bind(sql), p);
  }

  public String encode(Object value) {
    return json.writeValueAsString(value);
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> decode(String value) {
    return json.readValue(value, Map.class);
  }

  Map<String, Object> normalize(Map<String, Object> row) {
    var out = new LinkedHashMap<String, Object>();
    row.forEach((k, v) -> {
      StringBuilder name = new StringBuilder();
      boolean upper = false;
      for (char c : k.toCharArray()) {
        if (c == '_') {
          upper = true;
          continue;
        }
        name.append(upper ? Character.toUpperCase(c) : c);
        upper = false;
      }
      if (v != null && v.getClass().getName().equals("org.postgresql.util.PGobject")) v =
        json.readValue(v.toString(), Object.class);
      if (v instanceof java.sql.Timestamp t) v = t.toInstant().toString();
      out.put(name.toString(), v);
    });
    return out;
  }

  static String id() {
    return UUID.randomUUID().toString();
  }
}
