package campus.neighbour;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.*;

class Input {

  static String text(Map<String, Object> b, String key, int max) {
    Object value = b.get(key);
    Problem.field(value != null, key, "REQUIRED");
    Problem.field(value instanceof String, key, "INVALID_FORMAT");
    String text = (String) value;
    Problem.field(!text.isBlank(), key, "REQUIRED");
    Problem.field(text.codePointCount(0, text.length()) <= max, key, "TOO_LONG");
    return text;
  }

  static String optional(Map<String, Object> b, String key, int max) {
    if (b.get(key) == null || "".equals(b.get(key))) return null;
    return text(b, key, max);
  }

  static String id(Map<String, Object> b, String key) {
    String value = text(b, key, 36);
    try {
      Problem.field(
        UUID.fromString(value).toString().equalsIgnoreCase(value),
        key,
        "INVALID_FORMAT"
      );
    } catch (IllegalArgumentException e) {
      throw Problem.field(key, "INVALID_FORMAT");
    }
    return value;
  }

  static String optionalId(Map<String, Object> b, String key) {
    return b.get(key) == null || "".equals(b.get(key)) ? null : id(b, key);
  }

  static long number(Map<String, Object> b, String key, long min, long max) {
    Object value = b.get(key);
    Problem.field(value != null, key, "REQUIRED");
    Problem.field(value instanceof Number, key, "INVALID_FORMAT");
    double d = ((Number) value).doubleValue();
    long n = ((Number) value).longValue();
    Problem.field(Double.isFinite(d) && d == n, key, "INVALID_FORMAT");
    Problem.field(n >= min && n <= max, key, "OUT_OF_RANGE");
    return n;
  }

  static boolean bool(Map<String, Object> b, String key, boolean fallback) {
    if (!b.containsKey(key)) return fallback;
    Problem.field(b.get(key) instanceof Boolean, key, "INVALID_FORMAT");
    return (Boolean) b.get(key);
  }

  static void only(Map<String, Object> b, String... keys) {
    Problem.require(Set.of(keys).containsAll(b.keySet()), 400, "VALIDATION_ERROR");
  }

  static String instant(Map<String, Object> b, String key) {
    String value = text(b, key, 60);
    try {
      Instant.parse(value);
    } catch (DateTimeParseException e) {
      throw Problem.field(key, "INVALID_FORMAT");
    }
    return value;
  }

  static String meeting(Map<String, Object> b) {
    String value = instant(b, "meetingAt");
    Problem.field(Instant.parse(value).isAfter(Instant.now()), "meetingAt", "MUST_BE_FUTURE");
    return value;
  }
}
