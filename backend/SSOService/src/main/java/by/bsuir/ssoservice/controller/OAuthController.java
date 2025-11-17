package by.bsuir.ssoservice.controller;

import by.bsuir.ssoservice.dto.request.CompleteOAuthRegistrationRequest;
import by.bsuir.ssoservice.dto.response.AuthResponse;
import by.bsuir.ssoservice.dto.response.OAuthRegistrationResponse;
import by.bsuir.ssoservice.service.OAuthService;
import by.bsuir.ssoservice.utils.RequestUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/oauth")
@RequiredArgsConstructor
public class OAuthController {

    private final OAuthService oauthService;

    @GetMapping("/authorize/{provider}")
    public void initiateOAuth(
            @PathVariable String provider,
            @RequestParam(defaultValue = "login") String type,
            HttpServletResponse response) throws IOException {

        String authorizationUrl = oauthService.getAuthorizationUrl(provider, type);
        response.sendRedirect(authorizationUrl);
    }

    @GetMapping("/callback/{provider}")
    public void handleOAuthCallback(
            @PathVariable String provider,
            @RequestParam String code,
            @RequestParam(required = false) String state,
            HttpServletRequest httpRequest,
            HttpServletResponse response) throws IOException {

        Object result = oauthService.handleCallback(
                provider,
                code,
                state,
                RequestUtils.getClientIp(httpRequest),
                RequestUtils.getUserAgent(httpRequest)
        );

        if (result instanceof AuthResponse authResponse) {
            String redirectUrl = String.format(
                    "http://localhost:3000/auth/callback?access_token=%s&refresh_token=%s",
                    URLEncoder.encode(authResponse.accessToken(), StandardCharsets.UTF_8),
                    URLEncoder.encode(authResponse.refreshToken(), StandardCharsets.UTF_8)
            );
            response.sendRedirect(redirectUrl);
        }
        else if (result instanceof OAuthRegistrationResponse regResponse) {
            String redirectUrl = String.format(
                    "http://localhost:3000/role?token=%s&email=%s&name=%s",
                    URLEncoder.encode(regResponse.temporaryToken(), StandardCharsets.UTF_8),
                    URLEncoder.encode(regResponse.email(), StandardCharsets.UTF_8),
                    URLEncoder.encode(regResponse.fullName(), StandardCharsets.UTF_8)
            );
            response.sendRedirect(redirectUrl);
        }
    }

    @PostMapping("/complete-registration")
    public ResponseEntity<AuthResponse> completeRegistration(
            @Valid @RequestBody CompleteOAuthRegistrationRequest request,
            HttpServletRequest httpRequest) {

        AuthResponse response = oauthService.completeRegistration(
                request,
                RequestUtils.getClientIp(httpRequest),
                RequestUtils.getUserAgent(httpRequest)
        );

        return ResponseEntity.ok(response);
    }
}

