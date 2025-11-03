package by.bsuir.ssoservice.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO для обновления токенов через refresh token
 */
public record RefreshTokenRequest(
        @NotBlank(message = "Refresh token обязателен")
        String refreshToken
) {}

