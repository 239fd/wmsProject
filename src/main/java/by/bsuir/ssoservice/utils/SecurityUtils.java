package by.bsuir.ssoservice.utils;

import by.bsuir.ssoservice.exception.AppException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

@Slf4j
public class SecurityUtils {

    public static UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw AppException.unauthorized("Пользователь не аутентифицирован");
        }

        String principalStr = authentication.getPrincipal().toString();

        try {
            return UUID.fromString(principalStr);
        } catch (IllegalArgumentException e) {
            throw AppException.unauthorized("Неверный формат идентификатора пользователя");
        }
    }
}

