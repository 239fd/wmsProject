package by.bsuir.ssoservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

/**
 * Сервис для управления Refresh токенами в Redis
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String REFRESH_TOKEN_PREFIX = "refresh_token:";

    public void saveRefreshToken(String refreshToken, UUID userId, Duration ttl) {
        String key = REFRESH_TOKEN_PREFIX + refreshToken;
        redisTemplate.opsForValue().set(key, userId.toString(), ttl);
        log.debug("Refresh token saved for user: {}", userId);
    }

    public UUID getUserIdByRefreshToken(String refreshToken) {
        String key = REFRESH_TOKEN_PREFIX + refreshToken;
        Object userId = redisTemplate.opsForValue().get(key);
        if (userId != null) {
            return UUID.fromString(userId.toString());
        }
        return null;
    }

    public void deleteRefreshToken(String refreshToken) {
        String key = REFRESH_TOKEN_PREFIX + refreshToken;
        redisTemplate.delete(key);
        log.debug("Refresh token deleted: {}", refreshToken);
    }

    public void deleteAllUserTokens(UUID userId) {
        String pattern = REFRESH_TOKEN_PREFIX + "*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null) {
            keys.forEach(key -> {
                Object storedUserId = redisTemplate.opsForValue().get(key);
                if (userId.toString().equals(storedUserId)) {
                    redisTemplate.delete(key);
                }
            });
        }
        log.debug("All tokens deleted for user: {}", userId);
    }
}

