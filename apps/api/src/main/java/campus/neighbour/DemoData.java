package campus.neighbour;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
class DemoData implements CommandLineRunner {

  final Db db;
  final PasswordEncoder passwords;
  final boolean enabled;
  final String password;
  final Path uploads;

  DemoData(
    Db db,
    PasswordEncoder passwords,
    @Value("${campus.demo}") boolean enabled,
    @Value("${DEMO_PASSWORD:}") String password,
    @Value("${campus.uploads}") String uploads
  ) {
    this.db = db;
    this.passwords = passwords;
    this.enabled = enabled;
    this.password = password;
    this.uploads = Path.of(uploads);
  }

  public void run(String... args) throws Exception {
    if (!enabled) return;
    if (db.optional("select id from users where email='seller@example.test'") != null) return;
    Problem.require(password.length() >= 12, 422, "Set DEMO_PASSWORD with at least 12 characters");
    String seller = Db.id(),
      buyer = Db.id(),
      admin = Db.id();
    for (var u : java.util.List.of(
      new String[] { seller, "seller@example.test", "林同学", "STUDENT" },
      new String[] { buyer, "buyer@example.test", "小陈", "STUDENT" },
      new String[] { admin, "admin@example.test", "Campus Admin", "ADMIN" }
    ))
      db.exec(
        "insert into users(id,email,password_hash,nickname,role,profile) values(?,?,?,?,?,?::jsonb)",
        u[0],
        u[1],
        passwords.encode(password),
        u[2],
        u[3],
        "{\"college\":\"示例学院\",\"major\":\"软件工程\",\"year\":\"二年级\"}"
      );
    String[][] products = {
      { "高等数学 · 同济第七版", "Calculus", "2500", "1" },
      { "无线降噪耳机", "Headphones", "18000", "2" },
      { "陪你读书的台灯", "Desk lamp", "4500", "3" },
      { "周末出发 · 帆布背包", "Everyday tote", "3500", "3" },
      { "程序设计入门", "Programming", "3200", "1" },
      { "机械键盘 · 茶轴", "Keyboard", "12000", "2" },
      { "绿色随行水杯", "Daily bottle", "2200", "3" },
      { "羽毛球拍 · 双拍", "Badminton", "6500", "4" },
    };
    int[] colors = {
      0xE5DDC9,
      0xDCE1E3,
      0xE8DCCF,
      0xDDE2D4,
      0xD6DECF,
      0xE5E1D9,
      0xDBE3D9,
      0xE5DDD2,
    };
    Files.createDirectories(uploads);
    for (int n = 0; n < products.length; n++) {
      String lid = Db.id(),
        image = Db.id(),
        owner = n < 6 ? seller : buyer;
      var p = products[n];
      BufferedImage art = new BufferedImage(720, 580, BufferedImage.TYPE_INT_RGB);
      Graphics2D g = art.createGraphics();
      g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
      g.setColor(new Color(colors[n]));
      g.fillRect(0, 0, 720, 580);
      g.setColor(new Color(0, 0, 0, 18));
      g.fillOval(175, 415, 380, 55);
      g.setColor(new Color(0x64745A));
      if (n == 0 || n == 4) {
        g.rotate(-.12, 360, 290);
        g.fillRoundRect(235, 90, 250, 340, 8, 8);
        g.setColor(new Color(0xEEEBD8));
        g.fillRect(248, 100, 10, 320);
        g.setFont(new Font("Serif", Font.BOLD, 34));
        g.drawString(n == 0 ? "CALCULUS" : "CODE", 280, 195);
        g.setFont(new Font("Serif", Font.PLAIN, 18));
        g.drawString("A NEW CHAPTER", 280, 242);
        g.drawLine(280, 267, 440, 267);
      } else if (n == 1) {
        g.setStroke(new BasicStroke(28));
        g.drawArc(235, 130, 250, 280, 0, 180);
        g.fillRoundRect(207, 242, 74, 149, 30, 30);
        g.fillRoundRect(441, 242, 74, 149, 30, 30);
      } else if (n == 2) {
        g.setStroke(new BasicStroke(14));
        g.drawLine(345, 415, 345, 205);
        g.fillOval(255, 403, 180, 28);
        g.fillArc(242, 117, 206, 168, 0, 180);
      } else if (n == 3) {
        g.setColor(new Color(0xB29874));
        g.fillRoundRect(233, 215, 254, 218, 16, 16);
        g.setStroke(new BasicStroke(17));
        g.drawArc(278, 117, 166, 203, 0, 180);
      } else if (n == 5) {
        g.fillRoundRect(139, 210, 445, 189, 16, 16);
        g.setColor(new Color(0xDDDCD2));
        for (int row = 0; row < 4; row++) for (int col = 0; col < 12; col++) g.fillRoundRect(
          153 + col * 35,
          226 + row * 38,
          28,
          29,
          4,
          4
        );
      } else if (n == 6) {
        g.fillRoundRect(290, 130, 143, 303, 35, 35);
        g.setColor(new Color(0x384C39));
        g.fillRoundRect(300, 104, 122, 47, 10, 10);
      } else {
        g.setStroke(new BasicStroke(12));
        g.drawOval(230, 98, 170, 220);
        g.drawLine(316, 316, 346, 435);
        g.setStroke(new BasicStroke(2));
        for (int k = 0; k < 7; k++) {
          g.drawLine(251 + k * 18, 131, 251 + k * 18, 283);
          g.drawLine(253, 143 + k * 22, 380, 143 + k * 22);
        }
      }
      g.dispose();
      Path file = uploads.resolve(image + ".png");
      ImageIO.write(art, "png", file.toFile());
      db.exec(
        "insert into images(id,owner_id,storage_key,mime_type,size_bytes) values(?,?,?,'image/png',?)",
        image,
        owner,
        image + ".png",
        Files.size(file)
      );
      db.exec(
        "insert into listings(id,owner_id,title,description,price_minor,category_id,building_id,course_id,condition_code,book_edition,swap_enabled,wanted_description) values(?,?,?,?,?,?,?,?,?,?,true,?)",
        lid,
        owner,
        p[0],
        "这是虚构的校园演示商品。保存完好，欢迎站内沟通，约定校园面交。",
        Long.parseLong(p[2]),
        "11111111-1111-4111-8111-11111111111" + p[3],
        "22222222-2222-4222-8222-22222222222" + ((n % 3) + 1),
        n == 0
          ? "33333333-3333-4333-8333-333333333331"
          : n == 4
            ? "33333333-3333-4333-8333-333333333332"
            : null,
        "GOOD",
        n == 0 ? "第七版" : null,
        "欢迎交换教材或宿舍用品"
      );
      db.exec("insert into listing_images values(?,?,0)", lid, image);
    }
    db.exec(
      "insert into seasonal_zones(id,title_zh,title_en,description_zh,description_en,starts_at,ends_at,enabled) values(?,?,?,?,?,now()-interval '1 day',now()+interval '120 days',true)",
      Db.id(),
      "新学期 · 刚刚好",
      "New term, new finds",
      "教材、台灯、生活好物，为新学期轻装出发。",
      "Books and everyday essentials for a lighter start."
    );
  }
}
