package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

class CatalogTest {

  static final String CATEGORY = "00000000-0000-0000-0000-000000000001";
  static final String BUILDING = "00000000-0000-0000-0000-000000000002";
  Db db;
  Accounts accounts;
  Catalog catalog;

  @BeforeEach
  void setUp() {
    db = mock(Db.class);
    accounts = mock(Accounts.class);
    catalog = spy(new Catalog(db, accounts));
    when(accounts.active()).thenReturn("owner");
  }

  Map<String, Object> listing(String owner, String status, String moderation) {
    return new HashMap<>(
      Map.of(
        "id",
        "listing",
        "ownerId",
        owner,
        "status",
        status,
        "moderationStatus",
        moderation,
        "contentVersion",
        3
      )
    );
  }

  Map<String, Object> body() {
    return new HashMap<>(
      Map.of(
        "title",
        "Textbook",
        "description",
        "Good textbook",
        "priceMinor",
        2500,
        "categoryId",
        CATEGORY,
        "buildingId",
        BUILDING,
        "conditionCode",
        "GOOD",
        "imageIds",
        List.of("image")
      )
    );
  }

  void validDictionaries() {
    when(
      db.optional(
        eq("select id from dictionaries where id=? and kind=? and (? or active)"),
        any(),
        anyString(),
        eq(false)
      )
    ).thenReturn(Map.of("id", "dictionary"));
  }

  void failure(int status, String code, Runnable action) {
    var error = assertThrows(Problem.class, action::run);
    assertEquals(status, error.status);
    assertEquals(code, error.code);
    verify(db, never()).exec(anyString(), any(Object[].class));
  }

  @ParameterizedTest
  @CsvSource({ "VISIBLE,AVAILABLE,true", "HIDDEN,AVAILABLE,false", "VISIBLE,WITHDRAWN,false" })
  void visitorsOnlySeePublicDetails(String moderation, String status, boolean visible) {
    var row = listing("owner", status, moderation);
    doReturn(row).when(catalog).raw("listing", false);
    when(accounts.maybe()).thenReturn("visitor");
    doReturn(row).when(catalog).enrich(row);
    if (visible) assertSame(row, catalog.detail("listing"));
    else failure(404, "NOT_FOUND", () -> catalog.detail("listing"));
  }

  @Test
  void ownerCanInspectHiddenWithdrawnListing() {
    var row = listing("owner", "WITHDRAWN", "HIDDEN");
    doReturn(row).when(catalog).raw("listing", false);
    doReturn(row).when(catalog).enrich(row);
    when(accounts.maybe()).thenReturn("owner");
    assertSame(row, catalog.detail("listing"));
  }

  @Test
  void anotherUserCannotEditListing() {
    doReturn(listing("other", "AVAILABLE", "VISIBLE"))
      .when(catalog)
      .raw("listing", true);
    failure(403, "FORBIDDEN", () -> catalog.save("listing", body()));
  }

  @ParameterizedTest
  @ValueSource(strings = { "RESERVED", "SOLD", "EXCHANGED" })
  void occupiedOrCompletedListingCannotBeEdited(String status) {
    doReturn(listing("owner", status, "VISIBLE"))
      .when(catalog)
      .raw("listing", true);
    failure(409, "STATE_CONFLICT", () -> catalog.save("listing", body()));
  }

  @Test
  void staleEditVersionCannotOverwriteListing() {
    doReturn(listing("owner", "AVAILABLE", "VISIBLE"))
      .when(catalog)
      .raw("listing", true);
    var b = body();
    b.put("expectedVersion", 2);
    failure(409, "VERSION_CONFLICT", () -> catalog.save("listing", b));
  }

  @ParameterizedTest
  @ValueSource(longs = { -1, 1000000000 })
  void priceOutsideRangeCannotBePublished(long price) {
    validDictionaries();
    var b = body();
    b.put("priceMinor", price);
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, b));
  }

  @ParameterizedTest
  @ValueSource(longs = { 0, 999999999 })
  void priceBoundariesAreAcceptedAndImagesKeepOrder(long price) {
    validDictionaries();
    var b = body();
    b.put("priceMinor", price);
    b.put("imageIds", List.of("first", "second"));
    doReturn(Map.of("id", "created")).when(catalog).detail(anyString());
    assertEquals(Map.of("id", "created"), catalog.save(null, b));
    var id = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(db).exec(
      eq(
        "insert into listings(id,owner_id,title,description,price_minor,category_id,building_id,course_id,condition_code,book_author,book_edition,swap_enabled,wanted_description) values(?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ),
      id.capture(),
      eq("owner"),
      eq("Textbook"),
      eq("Good textbook"),
      eq(price),
      eq(CATEGORY),
      eq(BUILDING),
      isNull(),
      eq("GOOD"),
      isNull(),
      isNull(),
      eq(false),
      isNull()
    );
    verify(db).exec("insert into listing_images values(?,?,?)", id.getValue(), "first", 0);
    verify(db).exec("insert into listing_images values(?,?,?)", id.getValue(), "second", 1);
  }

  @Test
  void missingTitleIsRejected() {
    var b = body();
    b.remove("title");
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, b));
  }

  @Test
  void invalidCategoryIsRejected() {
    when(
      db.optional(
        "select id from dictionaries where id=? and kind=? and (? or active)",
        CATEGORY,
        "categories",
        false
      )
    ).thenReturn(null);
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, body()));
  }

  @Test
  void fractionalPriceIsRejected() {
    validDictionaries();
    var b = body();
    b.put("priceMinor", 1.5);
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, b));
  }

  @ParameterizedTest
  @ValueSource(ints = { 0, 7 })
  void imageCountMustBeBetweenOneAndSix(int count) {
    validDictionaries();
    var b = body();
    b.put(
      "imageIds",
      java.util.stream.IntStream.range(0, count)
        .mapToObj(i -> "image" + i)
        .toList()
    );
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, b));
  }

  @Test
  void duplicateImagesAreRejected() {
    validDictionaries();
    var b = body();
    b.put("imageIds", List.of("image", "image"));
    failure(422, "VALIDATION_ERROR", () -> catalog.save(null, b));
  }

  @Test
  void imageOwnedByAnotherAccountCannotBeAttached() {
    validDictionaries();
    when(
      db.one("select id from images where id=? and owner_id=? for update", "image", "owner")
    ).thenThrow(new Problem(404, "NOT_FOUND"));
    failure(404, "NOT_FOUND", () -> catalog.save(null, body()));
  }

  @Test
  void imageAlreadyAttachedElsewhereCannotBeReused() {
    validDictionaries();
    when(db.optional("select listing_id from listing_images where image_id=?", "image")).thenReturn(
      Map.of("listingId", "other-listing")
    );
    failure(409, "STATE_CONFLICT", () -> catalog.save(null, body()));
  }

  @ParameterizedTest
  @ValueSource(booleans = { false, true })
  void ownerCanWithdrawAndRelistWithCurrentVersion(boolean relist) {
    doReturn(listing("owner", relist ? "WITHDRAWN" : "AVAILABLE", "VISIBLE"))
      .when(catalog)
      .raw("listing", true);
    doReturn(Map.of("id", "listing")).when(catalog).detail("listing");
    assertEquals(
      Map.of("id", "listing"),
      catalog.state("listing", relist, Map.of("expectedVersion", 3))
    );
    verify(db).exec(
      "update listings set status=?,content_version=content_version+1,updated_at=now() where id=?",
      relist ? "AVAILABLE" : "WITHDRAWN",
      "listing"
    );
  }

  @ParameterizedTest
  @CsvSource({
    "other,AVAILABLE,VISIBLE,3,403,FORBIDDEN",
    "owner,AVAILABLE,VISIBLE,2,409,VERSION_CONFLICT",
    "owner,RESERVED,VISIBLE,3,409,STATE_CONFLICT",
    "owner,AVAILABLE,HIDDEN,3,409,STATE_CONFLICT",
  })
  void invalidWithdrawalDoesNotMutate(
    String owner,
    String status,
    String moderation,
    int version,
    int expectedStatus,
    String code
  ) {
    doReturn(listing(owner, status, moderation))
      .when(catalog)
      .raw("listing", true);
    failure(expectedStatus, code, () ->
      catalog.state("listing", false, Map.of("expectedVersion", version))
    );
  }
}
