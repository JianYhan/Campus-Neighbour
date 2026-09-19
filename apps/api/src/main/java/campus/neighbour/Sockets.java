package campus.neighbour;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.*;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.config.*;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketSessionDecorator;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

@Configuration
@EnableWebSocketMessageBroker
class Sockets implements WebSocketMessageBrokerConfigurer {

  @Value("${campus.origin}")
  String origin;

  final SessionRepository<? extends Session> sessions;

  Sockets(SessionRepository<? extends Session> sessions) {
    this.sessions = sessions;
  }

  public void configureMessageBroker(MessageBrokerRegistry r) {
    r.enableSimpleBroker("/queue");
    r.setUserDestinationPrefix("/user");
  }

  public void registerStompEndpoints(StompEndpointRegistry r) {
    r.addEndpoint("/ws").setAllowedOrigins(origin.split(",")).addInterceptors(
      new HttpSessionHandshakeInterceptor() {
        public boolean beforeHandshake(
          ServerHttpRequest req,
          ServerHttpResponse res,
          WebSocketHandler h,
          Map<String, Object> attrs
        ) throws Exception {
          if (req.getPrincipal() == null) return false;
          var servlet = ((ServletServerHttpRequest) req).getServletRequest();
          var token = (CsrfToken) servlet.getAttribute(CsrfToken.class.getName());
          if (token == null) return false;
          attrs.put("csrf", token.getToken());
          return super.beforeHandshake(req, res, h, attrs);
        }
      }
    );
  }

  public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
    registration.setMessageSizeLimit(16 * 1024).setSendBufferSizeLimit(64 * 1024);
    registration.addDecoratorFactory(handler ->
      new WebSocketHandlerDecorator(handler) {
        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
          super.afterConnectionEstablished(
            new WebSocketSessionDecorator(session) {
              @Override
              public void sendMessage(WebSocketMessage<?> message) throws java.io.IOException {
                Object sid = getAttributes().get(
                  HttpSessionHandshakeInterceptor.HTTP_SESSION_ID_ATTR_NAME
                );
                if (sid == null || sessions.findById(sid.toString()) == null) {
                  close(CloseStatus.POLICY_VIOLATION);
                  return;
                }
                super.sendMessage(message);
              }
            }
          );
        }
      }
    );
  }

  public void configureClientInboundChannel(ChannelRegistration r) {
    r.interceptors(
      new ChannelInterceptor() {
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
          var h = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
          if (h == null) return message;
          var cmd = h.getCommand();
          if (cmd == StompCommand.DISCONNECT) return message;
          var attrs = h.getSessionAttributes();
          Problem.require(h.getUser() != null && attrs != null, 403, "FORBIDDEN");
          String sid = (String) attrs.get(
            HttpSessionHandshakeInterceptor.HTTP_SESSION_ID_ATTR_NAME
          );
          Problem.require(sid != null && sessions.findById(sid) != null, 403, "FORBIDDEN");
          if (cmd == StompCommand.CONNECT) Problem.require(
            Objects.equals(attrs.get("csrf"), h.getFirstNativeHeader("X-CSRF-TOKEN")),
            403,
            "FORBIDDEN"
          );
          if (cmd == StompCommand.SUBSCRIBE) Problem.require(
            "/user/queue/events".equals(h.getDestination()),
            403,
            "FORBIDDEN"
          );
          Problem.require(cmd != StompCommand.SEND, 403, "FORBIDDEN");
          return message;
        }
      }
    );
  }
}
