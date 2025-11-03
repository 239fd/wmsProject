package by.bsuir.ssoservice.dto.response;

import by.bsuir.ssoservice.model.enums.UserRole;

import java.util.UUID;

/**
 * DTO с информацией о пользователе
 */
public record UserResponse(
        UUID userId,
        String email,
        String fullName,
        UserRole role,
        UUID organizationId,
        UUID warehouseId
) {}

