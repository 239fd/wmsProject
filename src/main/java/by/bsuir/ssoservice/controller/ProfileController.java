package by.bsuir.ssoservice.controller;

import by.bsuir.ssoservice.dto.request.UpdateProfileRequest;
import by.bsuir.ssoservice.dto.response.SessionInfo;
import by.bsuir.ssoservice.dto.response.UserResponse;
import by.bsuir.ssoservice.exception.AppException;
import by.bsuir.ssoservice.service.ProfileService;
import by.bsuir.ssoservice.utils.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<UserResponse> getCurrentUser() {
        UUID userId = SecurityUtils.getCurrentUserId();
        UserResponse user = profileService.getUserProfile(userId);
        return ResponseEntity.ok(user);
    }

    @PutMapping
    public ResponseEntity<UserResponse> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        UserResponse updatedUser = profileService.updateProfile(userId, request);
        return ResponseEntity.ok(updatedUser);
    }

    @PostMapping(value = "/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadPhoto(@RequestParam("photo") MultipartFile photo) {
        UUID userId = SecurityUtils.getCurrentUserId();

        if (photo.getSize() > 5 * 1024 * 1024) {
            throw AppException.badRequest("Размер файла не должен превышать 5 МБ");
        }

        String contentType = photo.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw AppException.badRequest("Файл должен быть изображением");
        }

        String photoUrl = profileService.uploadPhoto(userId, photo);
        return ResponseEntity.ok(Map.of("photoUrl", photoUrl));
    }

    @DeleteMapping("/photo")
    public ResponseEntity<Map<String, String>> deletePhoto() {
        UUID userId = SecurityUtils.getCurrentUserId();
        profileService.deletePhoto(userId);
        return ResponseEntity.ok(Map.of("message", "Фото удалено"));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionInfo>> getActiveSessions(HttpServletRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String currentToken = request.getHeader("X-Refresh-Token");
        List<SessionInfo> sessions = profileService.getActiveSessions(userId, currentToken);
        return ResponseEntity.ok(sessions);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Map<String, String>> terminateSession(@PathVariable Integer sessionId) {
        UUID userId = SecurityUtils.getCurrentUserId();
        profileService.terminateSession(userId, sessionId);
        return ResponseEntity.ok(Map.of("message", "Сессия завершена"));
    }

    @DeleteMapping("/sessions")
    public ResponseEntity<Map<String, String>> terminateAllSessions(HttpServletRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String currentToken = request.getHeader("X-Refresh-Token");
        profileService.terminateAllSessions(userId, currentToken);
        return ResponseEntity.ok(Map.of("message", "Все сессии завершены"));
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteAccount() {
        UUID userId = SecurityUtils.getCurrentUserId();
        profileService.deleteAccount(userId);
        return ResponseEntity.ok(Map.of("message", "Аккаунт удален"));
    }
}

