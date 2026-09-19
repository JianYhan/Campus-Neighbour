package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ChatRulesTest {

  @Test
  void permitsTwentyGraphemesButRejectsTwentyOne() {
    assertEquals("书".repeat(20), ChatRules.text("书".repeat(20)));
    assertThrows(IllegalArgumentException.class, () -> ChatRules.text("书".repeat(21)));
  }

  @Test
  void countsEmojiFamiliesAsOne() {
    assertEquals(
      "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66".repeat(20),
      ChatRules.text(
        "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66".repeat(20)
      )
    );
  }

  @Test
  void rejectsBlank() {
    assertThrows(IllegalArgumentException.class, () -> ChatRules.text("  "));
  }

  @Test
  void templatesAreWhitelistedAndPreserveEnglish() {
    assertEquals("Where can we meet?", ChatRules.template("ASK_LOCATION", "en"));
    assertThrows(IllegalArgumentException.class, () -> ChatRules.template("CUSTOM", "en"));
  }
}
