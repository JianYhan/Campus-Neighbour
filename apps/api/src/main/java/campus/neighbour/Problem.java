package campus.neighbour;

import java.util.Map;

public class Problem extends RuntimeException {

  final int status;
  final String code;
  final Map<String, String> fieldErrors;

  public Problem(int status, String code) {
    this(status, code, Map.of());
  }

  Problem(int status, String code, Map<String, String> fieldErrors) {
    super(code);
    this.status = status;
    this.code = code;
    this.fieldErrors = Map.copyOf(fieldErrors);
  }

  static Problem field(String field, String code) {
    return new Problem(422, "VALIDATION_ERROR", Map.of(field, code));
  }

  static void field(boolean condition, String field, String code) {
    if (!condition) throw field(field, code);
  }

  static void require(boolean condition, int status, String code) {
    if (!condition) throw new Problem(status, code);
  }
}
