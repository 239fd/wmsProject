package by.bsuir.ssoservice.config;

import by.bsuir.ssoservice.service.JwtTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String requestURI = request.getRequestURI();
        log.info("Processing request: {} {}", request.getMethod(), requestURI);

        try {
            String authHeader = request.getHeader("Authorization");
            log.info("Authorization header present: {}", authHeader != null);

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String jwt = authHeader.substring(7);
                log.info("JWT token extracted, length: {}, first 20 chars: {}...",
                    jwt.length(), jwt.substring(0, Math.min(20, jwt.length())));

                if (jwtTokenService.validateToken(jwt)) {
                    String userId = jwtTokenService.extractUserId(jwt);
                    String email = jwtTokenService.extractEmail(jwt);
                    String role = jwtTokenService.extractRole(jwt);

                    log.info("Token validated successfully for user: {} ({}), role: {}", email, userId, role);

                    if (userId == null || role == null) {
                        log.error("UserId or role is null after token validation");
                        filterChain.doFilter(request, response);
                        return;
                    }

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userId,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    );

                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    log.info("JWT authentication successful for user: {}, Authentication set: {}",
                        email, SecurityContextHolder.getContext().getAuthentication() != null);
                } else {
                    log.warn("JWT token validation failed for request: {}", requestURI);
                }
            } else {
                log.info("No valid Authorization header found for request: {}", requestURI);
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication for {}: {}", requestURI, e.getMessage(), e);
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/") ||
               path.startsWith("/actuator/") ||
               path.startsWith("/api/test/") ||
               path.equals("/error");
    }
}

