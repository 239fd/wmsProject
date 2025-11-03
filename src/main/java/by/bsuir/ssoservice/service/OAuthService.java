package by.bsuir.ssoservice.service;

import by.bsuir.ssoservice.dto.request.CompleteOAuthRegistrationRequest;
import by.bsuir.ssoservice.dto.response.AuthResponse;
import by.bsuir.ssoservice.dto.response.OAuthRegistrationResponse;
import by.bsuir.ssoservice.exception.AppException;
import by.bsuir.ssoservice.model.entity.OAuthPendingRegistration;
import by.bsuir.ssoservice.model.entity.UserReadModel;
import by.bsuir.ssoservice.model.enums.AuthProvider;
import by.bsuir.ssoservice.repository.OAuthPendingRegistrationRepository;
import by.bsuir.ssoservice.repository.UserReadModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthService {

    private final UserReadModelRepository userRepository;
    private final OAuthPendingRegistrationRepository pendingRegistrationRepository;
    private final UserService userService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${oauth.yandex.client-id}")
    private String yandexClientId;

    @Value("${oauth.yandex.client-secret}")
    private String yandexClientSecret;

    @Value("${oauth.yandex.redirect-uri}")
    private String yandexRedirectUri;

    @Value("${oauth.google.client-id}")
    private String googleClientId;

    @Value("${oauth.google.client-secret}")
    private String googleClientSecret;

    @Value("${oauth.google.redirect-uri}")
    private String googleRedirectUri;

    public String getAuthorizationUrl(String provider, String type) {
        return switch (provider.toLowerCase()) {
            case "yandex" -> buildYandexAuthUrl(type);
            case "google" -> buildGoogleAuthUrl(type);
            default -> throw new AppException("Неподдерживаемый провайдер: " + provider, HttpStatus.BAD_REQUEST);
        };
    }

    @Transactional
    public Object handleCallback(String provider, String code, String state, String ipAddress, String userAgent) {
        String accessToken = exchangeCodeForToken(provider, code);
        OAuthUserInfo userInfo = getUserInfo(provider, accessToken);

        return userRepository.findByEmailAndProvider(userInfo.email(), AuthProvider.valueOf(provider.toUpperCase()))
                .map(existingUser -> (Object) userService.loginOAuthUser(existingUser, ipAddress, userAgent))
                .orElseGet(() -> (Object) createPendingRegistration(userInfo, provider));
    }

    @Transactional
    public AuthResponse completeRegistration(
            CompleteOAuthRegistrationRequest request,
            String ipAddress,
            String userAgent) {

        OAuthPendingRegistration pending = pendingRegistrationRepository
                .findByTemporaryTokenAndCompletedFalse(request.temporaryToken())
                .orElseThrow(() -> new AppException("Недействительный или истекший токен", HttpStatus.BAD_REQUEST));

        if (pending.isExpired()) {
            throw new AppException("Токен регистрации истек", HttpStatus.BAD_REQUEST);
        }

        UserReadModel user = userService.createOAuthUser(
                pending.getEmail(),
                pending.getFullName(),
                pending.getProvider(),
                pending.getPhoto(),
                request.role(),
                request.organizationId(),
                request.warehouseId()
        );

        pending.setCompleted(true);
        pendingRegistrationRepository.save(pending);

        return userService.generateTokensWithAudit(user, ipAddress, userAgent);
    }

    private OAuthRegistrationResponse createPendingRegistration(OAuthUserInfo userInfo, String provider) {
        pendingRegistrationRepository.findByEmailAndProviderAndCompletedFalse(userInfo.email(), provider)
                .ifPresent(pendingRegistrationRepository::delete);

        String temporaryToken = UUID.randomUUID().toString();

        OAuthPendingRegistration pending = OAuthPendingRegistration.builder()
                .temporaryToken(temporaryToken)
                .email(userInfo.email())
                .fullName(userInfo.name())
                .provider(provider)
                .providerUid(userInfo.id())
                .photo(userInfo.picture())
                .build();

        pendingRegistrationRepository.save(pending);

        return OAuthRegistrationResponse.builder()
                .temporaryToken(temporaryToken)
                .email(userInfo.email())
                .fullName(userInfo.name())
                .provider(provider)
                .requiresRoleSelection(true)
                .redirectUrl("http://localhost:3000/role")
                .build();
    }

    private String exchangeCodeForToken(String provider, String code) {
        return switch (provider.toLowerCase()) {
            case "yandex" -> exchangeYandexCode(code);
            case "google" -> exchangeGoogleCode(code);
            default -> throw new AppException("Неподдерживаемый провайдер", HttpStatus.BAD_REQUEST);
        };
    }

    private OAuthUserInfo getUserInfo(String provider, String accessToken) {
        return switch (provider.toLowerCase()) {
            case "yandex" -> getYandexUserInfo(accessToken);
            case "google" -> getGoogleUserInfo(accessToken);
            default -> throw new AppException("Неподдерживаемый провайдер", HttpStatus.BAD_REQUEST);
        };
    }


    private String buildYandexAuthUrl(String type) {
        return String.format(
                "https://oauth.yandex.ru/authorize?response_type=code&client_id=%s&redirect_uri=%s&state=%s",
                yandexClientId,
                yandexRedirectUri,
                type
        );
    }

    private String exchangeYandexCode(String code) {
        String tokenUrl = "https://oauth.yandex.ru/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(yandexClientId, yandexClientSecret);

        String body = String.format(
                "grant_type=authorization_code&code=%s&redirect_uri=%s",
                code,
                yandexRedirectUri
        );

        HttpEntity<String> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenUrl, request, Map.class);
            Map<String, Object> responseBody = response.getBody();
            return (String) responseBody.get("access_token");
        } catch (Exception e) {
            log.error("Failed to exchange Yandex code for token", e);
            throw new AppException("Ошибка авторизации через Яндекс", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private OAuthUserInfo getYandexUserInfo(String accessToken) {
        String userInfoUrl = "https://login.yandex.ru/info?format=json";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    userInfoUrl,
                    HttpMethod.GET,
                    request,
                    Map.class
            );

            Map<String, Object> userInfo = response.getBody();
            return new OAuthUserInfo(
                    (String) userInfo.get("id"),
                    (String) userInfo.get("default_email"),
                    (String) userInfo.get("display_name"),
                    null
            );
        } catch (Exception e) {
            log.error("Failed to get Yandex user info", e);
            throw new AppException("Ошибка получения данных пользователя", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    private String buildGoogleAuthUrl(String type) {
        return String.format(
                "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=%s&redirect_uri=%s&scope=openid email profile&state=%s",
                googleClientId,
                googleRedirectUri,
                type
        );
    }

    private String exchangeGoogleCode(String code) {
        String tokenUrl = "https://oauth2.googleapis.com/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        String body = String.format(
                "grant_type=authorization_code&code=%s&redirect_uri=%s&client_id=%s&client_secret=%s",
                code,
                googleRedirectUri,
                googleClientId,
                googleClientSecret
        );

        HttpEntity<String> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenUrl, request, Map.class);
            Map<String, Object> responseBody = response.getBody();
            return (String) responseBody.get("access_token");
        } catch (Exception e) {
            log.error("Failed to exchange Google code for token", e);
            throw new AppException("Ошибка авторизации через Google", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private OAuthUserInfo getGoogleUserInfo(String accessToken) {
        String userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    userInfoUrl,
                    HttpMethod.GET,
                    request,
                    Map.class
            );

            Map<String, Object> userInfo = response.getBody();
            return new OAuthUserInfo(
                    (String) userInfo.get("id"),
                    (String) userInfo.get("email"),
                    (String) userInfo.get("name"),
                    null
            );
        } catch (Exception e) {
            log.error("Failed to get Google user info", e);
            throw new AppException("Ошибка получения данных пользователя", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional
    public void cleanupExpiredRegistrations() {
        pendingRegistrationRepository.deleteExpiredOrCompleted(LocalDateTime.now());
    }

    private record OAuthUserInfo(String id, String email, String name, byte[] picture) {
    }
}

