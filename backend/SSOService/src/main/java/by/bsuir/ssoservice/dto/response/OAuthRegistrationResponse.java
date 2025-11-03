package by.bsuir.ssoservice.dto.response;

import lombok.Builder;

/**
 * DTO для ответа при начале OAuth регистрации
 * Содержит временный токен для завершения регистрации
 */
@Builder
public record OAuthRegistrationResponse(
        String temporaryToken,
        String email,
        String fullName,
        String provider,
        boolean requiresRoleSelection,
        String redirectUrl
) {
}

