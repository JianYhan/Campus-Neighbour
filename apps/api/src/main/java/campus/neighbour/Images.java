package campus.neighbour;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
class Images {

  final Db db;
  final Accounts a;
  final Path root;

  Images(Db d, Accounts a, @Value("${campus.uploads}") String root) throws IOException {
    db = d;
    this.a = a;
    this.root = Path.of(root).toAbsolutePath();
    Files.createDirectories(this.root);
  }

  Map<String, Object> upload(MultipartFile file) throws IOException {
    String actor = a.active();
    Problem.require(
      file.getSize() > 0 && file.getSize() <= 5 * 1024 * 1024,
      413,
      "IMAGE_TOO_LARGE"
    );
    String type;
    try (var stream = ImageIO.createImageInputStream(file.getInputStream())) {
      var readers = ImageIO.getImageReaders(stream);
      Problem.require(readers.hasNext(), 415, "INVALID_IMAGE");
      var reader = readers.next();
      try {
        reader.setInput(stream);
        String format = reader.getFormatName().toLowerCase();
        Problem.require(Set.of("png", "jpeg", "jpg").contains(format), 415, "INVALID_IMAGE");
        Problem.require(
          (long) reader.getWidth(0) * reader.getHeight(0) <= 20_000_000,
          413,
          "IMAGE_TOO_LARGE"
        );
        type = format.equals("png") ? "image/png" : "image/jpeg";
        reader.read(0);
      } finally {
        reader.dispose();
      }
    }
    String id = Db.id(),
      key = id + (type.equals("image/png") ? ".png" : ".jpg");
    Path target = root.resolve(key);
    Files.copy(file.getInputStream(), target);
    try {
      db.exec(
        "insert into images(id,owner_id,storage_key,mime_type,size_bytes) values(?,?,?,?,?)",
        id,
        actor,
        key,
        type,
        file.getSize()
      );
    } catch (RuntimeException e) {
      Files.deleteIfExists(target);
      throw e;
    }
    return Map.of(
      "id",
      id,
      "url",
      "/api/v1/images/" + id,
      "mimeType",
      type,
      "sizeBytes",
      file.getSize()
    );
  }

  Map<String, Object> accessible(String id) {
    var image = db.one("select * from images where id=?", id);
    String actor = a.maybe();
    boolean allowed =
      actor.equals(image.get("ownerId")) ||
      db.optional(
        "select l.id from listing_images li join listings l on l.id=li.listing_id where li.image_id=? and l.moderation_status='VISIBLE' and l.status<>'WITHDRAWN'",
        id
      ) != null;
    if (!allowed && !actor.isBlank()) allowed =
      db.optional(
        "select t.id from trade_items i join trades t on t.id=i.trade_id join listing_images li on li.listing_id=i.listing_id where li.image_id=? and (t.initiator_id=? or t.counterparty_id=?)",
        id,
        actor,
        actor
      ) != null;
    Problem.require(allowed, 404, "NOT_FOUND");
    return image;
  }
}
