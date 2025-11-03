package by.bsuir.ssoservice.dto.response;

import java.time.LocalDateTime;

public record SessionInfo(
        Integer sessionId,
        String ipAddress,
        String userAgent,
        LocalDateTime loginAt,
        Boolean isCurrent
) {
}

