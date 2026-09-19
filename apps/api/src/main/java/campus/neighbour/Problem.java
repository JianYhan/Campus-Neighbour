package campus.neighbour;

public class Problem extends RuntimeException {

  final int status;
  final String code;

  public Problem(int status, String code) {
    super(code);
    this.status = status;
    this.code = code;
  }

  static void require(boolean condition, int status, String code) {
    if (!condition) throw new Problem(status, code);
  }
}
