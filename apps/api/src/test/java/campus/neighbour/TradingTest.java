package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TradingTest {

  Db db = mock(Db.class);
  Accounts accounts = mock(Accounts.class);
  Catalog catalog = mock(Catalog.class);
  Chat chat = mock(Chat.class);
  Idempotency idem = mock(Idempotency.class);
  Events events = mock(Events.class);
  Trading trading = spy(new Trading(db, accounts, catalog, chat, idem, events));

  @BeforeEach
  void setup() {
    when(accounts.actor()).thenReturn("buyer");
    when(accounts.active()).thenReturn("buyer");
    doAnswer(i -> ((Supplier<?>) i.getArgument(4)).get())
      .when(idem)
      .run(anyString(), anyString(), anyString(), any(), any());
  }

  void state(String status) {
    doReturn(
      Map.of("status", status, "kind", "SALE", "initiatorId", "seller", "counterpartyId", "buyer")
    )
      .when(trading)
      .trade("trade", true);
    when(
      db.rows("select * from trade_items where trade_id=? order by listing_id", "trade")
    ).thenReturn(List.of(Map.of("listingId", "listing", "receiverId", "buyer")));
  }

  void noSideEffects() {
    verify(db, never()).exec(anyString(), any(Object[].class));
    verifyNoInteractions(events);
  }

  @Test
  void buyerCannotCreateSellerReservation() {
    String id = "00000000-0000-4000-8000-000000000001";
    when(chat.conversation(id, false)).thenReturn(Map.of("sellerId", "seller"));
    assertEquals(
      403,
      assertThrows(Problem.class, () -> trading.reserve(Map.of("conversationId", id), "key")).status
    );
    noSideEffects();
  }

  @Test
  void invalidReservationIdIsRejected() {
    assertEquals(
      422,
      assertThrows(Problem.class, () ->
        trading.reserve(Map.of("conversationId", "bad"), "key")
      ).status
    );
    noSideEffects();
  }

  @ParameterizedTest
  @ValueSource(strings = { "RESERVED", "SOLD", "WITHDRAWN" })
  void unavailableItemCannotBeReserved(String status) {
    assertEquals(
      409,
      assertThrows(Problem.class, () ->
        trading.available(Map.of("status", status, "moderationStatus", "VISIBLE"))
      ).status
    );
    noSideEffects();
  }

  @ParameterizedTest
  @ValueSource(strings = { "COMPLETED", "PARTIALLY_CONFIRMED" })
  void cannotCancelAfterConfirmation(String status) {
    state(status);
    assertEquals(
      409,
      assertThrows(Problem.class, () ->
        trading.action("trade", false, Map.of("reason", "Changed plans"), "key")
      ).status
    );
    noSideEffects();
  }

  @Test
  void cancelledTradeCannotBeConfirmed() {
    state("CANCELLED");
    assertEquals(
      409,
      assertThrows(Problem.class, () -> trading.action("trade", true, Map.of(), "key")).status
    );
    noSideEffects();
  }

  @Test
  void sellerCannotConfirmBuyerReceipt() {
    state("WAITING_MEETUP");
    when(accounts.actor()).thenReturn("seller");
    assertEquals(
      403,
      assertThrows(Problem.class, () -> trading.action("trade", true, Map.of(), "key")).status
    );
    noSideEffects();
  }

  @ParameterizedTest
  @ValueSource(strings = { "COMPLETED", "CANCELLED" })
  void repeatedTerminalActionHasNoSideEffects(String status) {
    state(status);
    doReturn(Map.of("status", status)).when(trading).detail("trade");
    assertEquals(
      status,
      trading.action("trade", status.equals("COMPLETED"), Map.of(), "key").get("status")
    );
    noSideEffects();
  }

  @ParameterizedTest
  @ValueSource(ints = { 0, 6 })
  void reviewRatingBoundaries(int rating) {
    state("COMPLETED");
    assertEquals(
      422,
      assertThrows(Problem.class, () ->
        trading.review("trade", Map.of("rating", rating), "key")
      ).status
    );
    noSideEffects();
  }

  @Test
  void confirmationCompletesSaleAndReleasesReservation() {
    state("WAITING_MEETUP");
    when(
      db.optional(
        "select user_id from trade_confirmations where trade_id=? and user_id=?",
        "trade",
        "buyer"
      )
    ).thenReturn(null);
    when(db.rows("select * from trade_confirmations where trade_id=?", "trade")).thenReturn(
      List.of(Map.of("userId", "buyer"))
    );
    doReturn(Map.of("status", "COMPLETED")).when(trading).detail("trade");
    assertEquals("COMPLETED", trading.action("trade", true, Map.of(), "key").get("status"));
    verify(db).exec("update listings set status=?,updated_at=now() where id=?", "SOLD", "listing");
    verify(db).exec("delete from listing_reservations where trade_id=?", "trade");
  }
}
