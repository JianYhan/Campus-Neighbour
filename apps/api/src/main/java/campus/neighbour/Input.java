package campus.neighbour;

import java.util.*;

class Input {

  static String text(Map<String, Object> b, String key, int max) {
    Object v = b.get(key);
    Problem.require(v instanceof String, 422, "VALIDATION_ERROR");
    String s = (String) v;
    Problem.require(
      !s.isBlank() && s.codePointCount(0, s.length()) <= max,
      422,
      "VALIDATION_ERROR"
    );
    return s;
  }

  static String optional(Map<String, Object> b, String key, int max) {
    if (b.get(key) == null || "".equals(b.get(key))) return null;
    return text(b, key, max);
  }

  static String id(Map<String, Object> b, String key) {
    String s = text(b, key, 36);
    UUID.fromString(s);
    return s;
  }

  static long number(Map<String, Object> b, String key, long min, long max) {
    Object v = b.get(key);
    Problem.require(v instanceof Number, 422, "VALIDATION_ERROR");
    double d = ((Number) v).doubleValue();
    long n = ((Number) v).longValue();
    Problem.require(d == n && n >= min && n <= max, 422, "VALIDATION_ERROR");
    return n;
  }

  static void only(Map<String, Object> b, String... keys) {
    Problem.require(Set.of(keys).containsAll(b.keySet()), 400, "VALIDATION_ERROR");
  }

  static String meeting(Map<String, Object> b) {
    String s = text(b, "meetingAt", 60);
    Problem.require(
      java.time.Instant.parse(s).isAfter(java.time.Instant.now()),
      422,
      "VALIDATION_ERROR"
    );
    return s;
  }
}
