package by.bsuir.ssoservice.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "oauth_pending_registrations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OAuthPendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "temporary_token", nullable = false, unique = true)
    private String temporaryToken;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    @Column(name = "provider_uid", nullable = false)
    private String providerUid;

    @Column(name = "photo")
    private byte[] photo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "completed", nullable = false)
    private Boolean completed;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (expiresAt == null) {
            expiresAt = createdAt.plusMinutes(15);
        }
        if (completed == null) {
            completed = false;
        }
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}

