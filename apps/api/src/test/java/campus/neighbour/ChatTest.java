package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ChatTest {

  Db db = mock(Db.class);
  Accounts accounts = mock(Accounts.class);
  Catalog catalog = mock(Catalog.class);
  Events events = mock(Events.class);
  Chat chat = spy(new Chat(db, accounts, catalog, events));
  String client = "00000000-0000-4000-8000-000000000001";

  @BeforeEach
  void identity() {
    when(accounts.active()).thenReturn("buyer");
  }

  @ParameterizedTest
  @ValueSource(strings = { "", " ", "123456789012345678901" })
  void rejectsInvalidText(String text) {
    doReturn(Map.of()).when(chat).conversation("chat", true);
    assertEquals(
      422,
      assertThrows(Problem.class, () ->
        chat.send("chat", Map.of("clientMessageId", client, "kind", "TEXT", "text", text))
      ).status
    );
    verifyNoInteractions(events);
  }

  @Test
  void replayDoesNotNotifyOrWrite() {
    doReturn(Map.of()).when(chat).conversation("chat", true);
    var old = new HashMap<String, Object>(
      Map.of("conversationId", "chat", "body", "Hello", "kind", "TEXT")
    );
    when(
      db.optional(
        "select * from messages where sender_id=? and client_message_id=?",
        "buyer",
        client
      )
    ).thenReturn(old);
    assertEquals(
      true,
      chat
        .send("chat", Map.of("clientMessageId", client, "kind", "TEXT", "text", "Hello"))
        .get("replayed")
    );
    verifyNoInteractions(events);
    verify(db, never()).exec(anyString(), any(Object[].class));
  }

  @Test
  void changedReplayConflicts() {
    doReturn(Map.of()).when(chat).conversation("chat", true);
    when(
      db.optional(
        "select * from messages where sender_id=? and client_message_id=?",
        "buyer",
        client
      )
    ).thenReturn(Map.of("conversationId", "other", "body", "Hello", "kind", "TEXT"));
    assertEquals(
      409,
      assertThrows(Problem.class, () ->
        chat.send("chat", Map.of("clientMessageId", client, "kind", "TEXT", "text", "Hello"))
      ).status
    );
    verifyNoInteractions(events);
  }

  @Test
  void nonParticipantCannotSend() {
    doThrow(new Problem(404, "NOT_FOUND")).when(chat).conversation("chat", true);
    assertEquals(404, assertThrows(Problem.class, () -> chat.send("chat", Map.of())).status);
    verifyNoInteractions(db, events);
  }

  @Test
  void cannotContactOwnListing() {
    when(catalog.detail("listing")).thenReturn(Map.of("ownerId", "buyer", "status", "AVAILABLE"));
    assertEquals(422, assertThrows(Problem.class, () -> chat.create("listing")).status);
    verifyNoInteractions(db, events);
  }

  @ParameterizedTest
  @ValueSource(strings = { "-1", "abc" })
  void rejectsInvalidHistoryCursor(String cursor) {
    doReturn(Map.of()).when(chat).conversation("chat", false);
    assertEquals(
      422,
      assertThrows(Problem.class, () -> chat.history("chat", Map.of("afterCursor", cursor))).status
    );
    verifyNoInteractions(db);
  }
}
