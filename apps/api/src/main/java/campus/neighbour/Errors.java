package campus.neighbour;

import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
class Errors {

  @ExceptionHandler(Problem.class)
  ResponseEntity<?> problem(Problem p) {
    return error(p.status, p.code);
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    org.springframework.web.bind.MissingRequestHeaderException.class,
    org.springframework.http.converter.HttpMessageNotReadableException.class,
  })
  ResponseEntity<?> invalid(Exception p) {
    return error(422, "VALIDATION_ERROR");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<?> conflict(Exception p) {
    return error(409, "STATE_CONFLICT");
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<?> size(Exception p) {
    return error(413, "IMAGE_TOO_LARGE");
  }

  ResponseEntity<?> error(int status, String code) {
    return ResponseEntity.status(status).body(
      Map.of(
        "error",
        Map.of("code", code, "message", code, "fieldErrors", Map.of(), "requestId", Db.id())
      )
    );
  }
}
