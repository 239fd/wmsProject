package by.bsuir.ssoservice.service;

import by.bsuir.ssoservice.dto.request.LoginRequest;
import by.bsuir.ssoservice.dto.request.RegisterRequest;
import by.bsuir.ssoservice.dto.response.AuthResponse;
import by.bsuir.ssoservice.dto.response.UserResponse;
import by.bsuir.ssoservice.model.entity.UserEvent;
import by.bsuir.ssoservice.model.entity.UserReadModel;
import by.bsuir.ssoservice.model.enums.AuthProvider;
import by.bsuir.ssoservice.model.enums.UserRole;
import by.bsuir.ssoservice.model.event.UserEvents;
import by.bsuir.ssoservice.repository.UserEventRepository;
import by.bsuir.ssoservice.repository.UserReadModelRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Сервис для управления пользователями с реализацией CQRS и Event Sourcing
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserEventRepository eventRepository;
    private final UserReadModelRepository readModelRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final ObjectMapper objectMapper;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (readModelRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Пользователь с таким email уже существует");
        }

        if ((request.role() == UserRole.WORKER || request.role() == UserRole.ACCOUNTANT)
                && (request.organizationCode() == null || request.organizationCode().isBlank())) {
            throw new IllegalArgumentException("Для роли " + request.role() + " необходим код предприятия");
        }

        UUID userId = UUID.randomUUID();
        String passwordHash = passwordEncoder.encode(request.password());

        UUID organizationId = null;
        UUID warehouseId = null;

        if (request.organizationCode() != null && !request.organizationCode().isBlank()) {
            organizationId = UUID.randomUUID();
            if (request.role() == UserRole.WORKER) {
                warehouseId = UUID.randomUUID();
            }
        }

        UserEvents.UserCreatedEvent event = new UserEvents.UserCreatedEvent(
                request.email(),
                request.getFullName(),
                request.role(),
                passwordHash,
                AuthProvider.LOCAL,
                organizationId,
                warehouseId
        );

        UserEvent userEvent = UserEvent.builder()
                .userId(userId)
                .eventType("USER_CREATED")
                .eventData(objectMapper.valueToTree(event))
                .eventVersion(1)
                .createdAt(LocalDateTime.now())
                .build();
        eventRepository.save(userEvent);

        UserReadModel readModel = UserReadModel.builder()
                .userId(userId)
                .email(request.email())
                .fullName(request.getFullName())
                .role(request.role())
                .passwordHash(passwordHash)
                .provider(AuthProvider.LOCAL)
                .organizationId(organizationId)
                .warehouseId(warehouseId)
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        readModelRepository.save(readModel);

        log.info("User registered successfully: {}", request.email());

        return generateTokens(readModel);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        UserReadModel user = readModelRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Неверный email или пароль"));

        if (!user.getIsActive()) {
            throw new IllegalArgumentException("Аккаунт деактивирован");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Неверный email или пароль");
        }

        log.info("User logged in: {}", request.email());

        return generateTokens(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refreshToken(String refreshToken) {
        UUID userId = refreshTokenService.getUserIdByRefreshToken(refreshToken);

        if (userId == null) {
            throw new IllegalArgumentException("Недействительный refresh token");
        }

        UserReadModel user = readModelRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Пользователь не найден"));

        if (!user.getIsActive()) {
            throw new IllegalArgumentException("Аккаунт деактивирован");
        }

        refreshTokenService.deleteRefreshToken(refreshToken);

        log.info("Token refreshed for user: {}", user.getEmail());

        return generateTokens(user);
    }

    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenService.deleteRefreshToken(refreshToken);
            log.info("User logged out, refresh token deleted");
        }
    }

    public void logoutAll(UUID userId) {
        refreshTokenService.deleteAllUserTokens(userId);
        log.info("User logged out from all devices: {}", userId);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserInfo(UUID userId) {
        UserReadModel user = readModelRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Пользователь не найден"));

        return new UserResponse(
                user.getUserId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getOrganizationId(),
                user.getWarehouseId()
        );
    }

    private AuthResponse generateTokens(UserReadModel user) {
        UserRole role = user.getRole();

        String accessToken = jwtTokenService.generateAccessToken(
                user.getUserId(),
                user.getEmail(),
                role
        );

        String refreshToken = jwtTokenService.generateRefreshToken();

        refreshTokenService.saveRefreshToken(
                refreshToken,
                user.getUserId(),
                Duration.ofSeconds(jwtTokenService.getRefreshTokenValidity())
        );

        return AuthResponse.of(
                accessToken,
                refreshToken,
                jwtTokenService.getAccessTokenValidity()
        );
    }
}

