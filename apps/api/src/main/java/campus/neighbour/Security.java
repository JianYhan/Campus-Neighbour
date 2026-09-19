package campus.neighbour;

import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.*;

@Configuration
class Security {

  @Bean
  PasswordEncoder passwords() {
    return Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();
  }

  @Bean
  SecurityContextRepository contexts() {
    return new HttpSessionSecurityContextRepository();
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository contexts)
    throws Exception {
    return http
      .securityContext(c -> c.securityContextRepository(contexts))
      .authorizeHttpRequests(a ->
        a.requestMatchers("/actuator/health").permitAll().anyRequest().permitAll()
      )
      .csrf(c ->
        c.csrfTokenRequestHandler(
          new org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler()
        )
      )
      .formLogin(c -> c.disable())
      .httpBasic(c -> c.disable())
      .logout(c -> c.disable())
      .exceptionHandling(c ->
        c.accessDeniedHandler((req, res, e) -> {
          res.setStatus(403);
          res.setContentType("application/json");
          res.getWriter().write("{\"error\":{\"code\":\"FORBIDDEN\"}}");
        })
      )
      .build();
  }
}
