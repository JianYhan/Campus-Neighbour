package campus.neighbour;

import java.util.*;
import java.util.regex.Pattern;

final class ChatRules {

  static final Pattern GRAPHEME = Pattern.compile("\\X");

  static String text(String text) {
    if (
      text == null || text.isBlank() || GRAPHEME.matcher(text).results().count() > 20
    ) throw new IllegalArgumentException("MESSAGE_TOO_LONG");
    return text;
  }

  static String template(String code, String locale) {
    if (!Set.of("en", "zh-CN").contains(locale)) throw new IllegalArgumentException(
      "INVALID_LOCALE"
    );
    return switch (code) {
      case "ASK_PRICE" -> locale.equals("en") ? "What is the price?" : "请问价格是多少？";
      case "ASK_CONDITION" -> locale.equals("en")
        ? "What condition is the item in?"
        : "请问物品现在是什么状态？";
      case "ASK_LOCATION" -> locale.equals("en") ? "Where can we meet?" : "请问在哪里交易？";
      default -> throw new IllegalArgumentException("INVALID_TEMPLATE");
    };
  }
}
