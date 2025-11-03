package by.bsuir.ssoservice.service;

import by.bsuir.ssoservice.dto.request.UpdateProfileRequest;
import by.bsuir.ssoservice.dto.response.SessionInfo;
import by.bsuir.ssoservice.dto.response.UserResponse;
import by.bsuir.ssoservice.model.entity.LoginAudit;
import by.bsuir.ssoservice.model.entity.UserReadModel;
import by.bsuir.ssoservice.repository.LoginAuditRepository;
import by.bsuir.ssoservice.repository.UserReadModelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProfileService {

    private final UserReadModelRepository userRepository;
    private final LoginAuditRepository loginAuditRepository;
    private final RefreshTokenService refreshTokenService;


    @Transactional(readOnly = true)
    public UserResponse getUserProfile(UUID userId) {
        UserReadModel user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        String photoBase64 = null;
        if (user.getPhoto() != null && user.getPhoto().length > 0) {
            photoBase64 = Base64.getEncoder().encodeToString(user.getPhoto());
        }

        return new UserResponse(
                user.getUserId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                photoBase64,
                user.getOrganizationId(),
                user.getWarehouseId()
        );
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        UserReadModel user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        if (!user.getEmail().equals(request.email())) {
            if (userRepository.findByEmail(request.email()).isPresent()) {
                throw new RuntimeException("Email уже используется");
            }
        }

        String fullName = request.lastName() + " " + request.firstName();
        if (request.middleName() != null && !request.middleName().isBlank()) {
            fullName += " " + request.middleName();
        }

        user.setEmail(request.email());
        user.setFullName(fullName);
        user.setUpdatedAt(LocalDateTime.now());

        UserReadModel updatedUser = userRepository.save(user);

        log.info("Profile updated for user: {}", userId);

        String photoBase64 = null;
        if (updatedUser.getPhoto() != null && updatedUser.getPhoto().length > 0) {
            photoBase64 = Base64.getEncoder().encodeToString(updatedUser.getPhoto());
        }

        return new UserResponse(
                updatedUser.getUserId(),
                updatedUser.getEmail(),
                updatedUser.getFullName(),
                updatedUser.getRole(),
                photoBase64,
                updatedUser.getOrganizationId(),
                updatedUser.getWarehouseId()
        );
    }

    @Transactional
    public String uploadPhoto(UUID userId, MultipartFile photo) throws IOException {
        UserReadModel user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        if (photo.getSize() > 5 * 1024 * 1024) {
            throw new RuntimeException("Размер фото не должен превышать 5 МБ");
        }

        String contentType = photo.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("Файл должен быть изображением");
        }

        byte[] photoBytes = photo.getBytes();
        user.setPhoto(photoBytes);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Photo uploaded for user: {}, size: {} bytes", userId, photoBytes.length);

        return Base64.getEncoder().encodeToString(photoBytes);
    }

    @Transactional
    public void deletePhoto(UUID userId) {
        UserReadModel user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        if (user.getPhoto() != null) {
            user.setPhoto(null);
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);

            log.info("Photo deleted for user: {}", userId);
        }
    }


    @Transactional(readOnly = true)
    public List<SessionInfo> getActiveSessions(UUID userId, String currentToken) {
        List<LoginAudit> sessions = loginAuditRepository.findByUserIdAndIsActiveTrueOrderByLoginAtDesc(userId);

        return sessions.stream()
                .map(session -> new SessionInfo(
                        session.getId(),
                        session.getIpAddress(),
                        session.getUserAgent(),
                        session.getLoginAt(),
                        false
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public void terminateSession(UUID userId, Integer sessionId) {
        LoginAudit session = loginAuditRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Сессия не найдена"));

        if (!session.getUserId().equals(userId)) {
            throw new RuntimeException("Доступ запрещен");
        }

        loginAuditRepository.deactivateSessionById(sessionId);


        log.info("Session {} terminated for user: {}", sessionId, userId);
    }

    @Transactional
    public void terminateAllSessions(UUID userId, String currentToken) {
        loginAuditRepository.deactivateAllUserSessions(userId);
        refreshTokenService.deleteAllUserTokens(userId);

        log.info("All sessions terminated for user: {}", userId);
    }

    @Transactional
    public void deleteAccount(UUID userId) {
        UserReadModel user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

        loginAuditRepository.deactivateAllUserSessions(userId);

        List<LoginAudit> sessions = loginAuditRepository.findByUserIdAndIsActiveTrueOrderByLoginAtDesc(userId);
        for (LoginAudit session : sessions) {
            refreshTokenService.deleteRefreshToken(session.getRefreshTokenHash());
        }

        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        log.info("Account deleted for user: {}", userId);
    }
}

