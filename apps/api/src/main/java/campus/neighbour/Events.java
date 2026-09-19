package campus.neighbour;

import java.util.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
class Events {

  final Db db;
  final SimpMessagingTemplate socket;

  Events(Db db, SimpMessagingTemplate socket) {
    this.db = db;
    this.socket = socket;
  }

  void notify(String user, String type, String resource, String id) {
    String nid = Db.id();
    db.exec(
      "insert into notifications(id,user_id,type,resource_type,resource_id) values(?,?,?,?,?)",
      nid,
      user,
      type,
      resource,
      id
    );
    db.exec(
      "insert into outbox_events(id,user_id,type,resource_id) values(?,?,?,?)",
      Db.id(),
      user,
      type,
      id
    );
  }

  @Scheduled(fixedDelay = 1000)
  public void deliver() {
    for (var event : db.rows(
      "select * from outbox_events where sent_at is null order by created_at limit 100"
    )) {
      socket.convertAndSendToUser(
        (String) event.get("userId"),
        "/queue/events",
        Map.of(
          "eventId",
          event.get("id"),
          "type",
          event.get("type"),
          "resourceId",
          event.get("resourceId")
        )
      );
      db.exec("update outbox_events set sent_at=now() where id=?", event.get("id"));
    }
  }
}
