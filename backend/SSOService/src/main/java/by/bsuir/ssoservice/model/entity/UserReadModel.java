package by.bsuir.ssoservice.model.entity;

import by.bsuir.ssoservice.model.enums.AuthProvider;
import by.bsuir.ssoservice.model.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_read_model")
@Builder
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserReadModel {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, columnDefinition = "user_role")
    @org.hibernate.annotations.ColumnTransformer(
            read = "role::text",
            write = "?::user_role"
    )
    private UserRole role;

    @Column(name = "password_hash")
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, columnDefinition = "auth_provider")
    @org.hibernate.annotations.ColumnTransformer(
            read = "provider::text",
            write = "?::auth_provider"
    )
    private AuthProvider provider;

    @Column(name = "photo", columnDefinition = "bytea")
    private byte[] photo;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "warehouse_id")
    private UUID warehouseId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

