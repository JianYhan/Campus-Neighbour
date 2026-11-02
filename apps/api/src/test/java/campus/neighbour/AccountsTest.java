package campus.neighbour;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AccountsTest {

  Db db;
  PasswordEncoder passwords;
  Accounts accounts;

  @BeforeEach
  void setUp() {
    SecurityContextHolder.clearContext();
    db = mock(Db.class);
    passwords = mock(PasswordEncoder.class);
    accounts = new Accounts(db, passwords);
  }

  @AfterEach
  void clearIdentity() {
    SecurityContextHolder.clearContext();
  }

  void login(String id) {
    SecurityContextHolder.getContext().setAuthentication(
      new UsernamePasswordAuthenticationToken(id, null, List.of())
    );
  }

  static void problem(int status, String code, Runnable action) {
    var error = assertThrows(Problem.class, action::run);
    assertEquals(status, error.status);
    assertEquals(code, error.code);
  }

  @Test
  void anonymousCannotActButCanBrowse() {
    assertEquals("", accounts.maybe());
    problem(401, "UNAUTHENTICATED", accounts::actor);
    login("anonymousUser");
    assertEquals("", accounts.maybe());
    problem(401, "UNAUTHENTICATED", accounts::actor);
    verifyNoInteractions(db);
  }

  @Test
  void activeAccountUsesServerIdentity() {
    login("student");
    when(db.one("select status from users where id=?", "student")).thenReturn(
      Map.of("status", "ACTIVE")
    );
    assertEquals("student", accounts.active());
    verify(db).one("select id from users where id=?", "student");
  }

  @Test
  void restrictedAccountCannotWrite() {
    login("student");
    when(db.one("select status from users where id=?", "student")).thenReturn(
      Map.of("status", "RESTRICTED")
    );
    problem(403, "ACCOUNT_RESTRICTED", accounts::active);
    verify(db, never()).exec(anyString(), any(Object[].class));
  }

  @ParameterizedTest
  @ValueSource(strings = { "STUDENT", "ADMIN" })
  void adminRequiresAdministratorRole(String role) {
    login("user");
    when(db.one("select status from users where id=?", "user")).thenReturn(
      Map.of("status", "ACTIVE")
    );
    when(db.one("select role from users where id=?", "user")).thenReturn(Map.of("role", role));
    if (role.equals("ADMIN")) assertEquals("user", accounts.admin());
    else problem(403, "FORBIDDEN", accounts::admin);
  }

  @ParameterizedTest
  @CsvSource({
    "bad-email,abcdefghijkl,email,INVALID_FORMAT",
    "student@example.test,short,password,TOO_SHORT",
  })
  void invalidRegistrationDoesNotPersist(
    String email,
    String password,
    String field,
    String reason
  ) {
    var error = assertThrows(Problem.class, () ->
      accounts.register(Map.of("email", email, "password", password, "nickname", "Student"))
    );
    assertEquals(422, error.status);
    assertEquals(Map.of(field, reason), error.fieldErrors);
    verifyNoInteractions(db, passwords);
  }

  @Test
  void registrationCannotAssignItsOwnRole() {
    problem(400, "VALIDATION_ERROR", () ->
      accounts.register(
        Map.of(
          "email",
          "student@example.test",
          "password",
          "abcdefghijkl",
          "nickname",
          "Student",
          "role",
          "ADMIN"
        )
      )
    );
    verifyNoInteractions(db, passwords);
  }

  @Test
  void registrationNormalizesEmailAndPersistsOnlyEncodedPassword() {
    var service = spy(accounts);
    doReturn(Map.of("id", "created")).when(service).self(anyString());
    when(passwords.encode("abcdefghijkl")).thenReturn("encoded-password");
    assertEquals(
      Map.of("id", "created"),
      service.register(
        Map.of("email", " Student@EXAMPLE.test ", "password", "abcdefghijkl", "nickname", "Student")
      )
    );
    verify(db).exec(
      eq("insert into users(id,email,password_hash,nickname) values(?,?,?,?)"),
      anyString(),
      eq("student@example.test"),
      eq("encoded-password"),
      eq("Student")
    );
  }

  @Test
  void passwordComparisonUsesPasswordEncoder() {
    when(passwords.matches("raw", "hash")).thenReturn(true);
    assertTrue(accounts.matches("raw", "hash"));
    when(passwords.matches("wrong", "hash")).thenReturn(false);
    assertFalse(accounts.matches("wrong", "hash"));
  }

  @Test
  void publicProfileDoesNotExposePrivateAccountFields() {
    when(db.one("select id,nickname,profile from users where id=?", "student")).thenReturn(
      Map.of("id", "student", "nickname", "Student", "profile", Map.of("bio", "Hello"))
    );
    assertEquals(
      Map.of("userId", "student", "nickname", "Student", "bio", "Hello"),
      accounts.profile("student")
    );
  }
}
