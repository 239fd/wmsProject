package by.bsuir.ssoservice.model.entity;

import by.bsuir.ssoservice.model.enums.AuthProvider;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "login_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "login_at", nullable = false)
    private LocalDateTime loginAt;

    @Column(name = "ip_address", columnDefinition = "inet")
    @org.hibernate.annotations.ColumnTransformer(
            write = "?::inet"
    )
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, columnDefinition = "auth_provider")
    @org.hibernate.annotations.ColumnTransformer(
            write = "?::auth_provider"
    )
    private AuthProvider provider;

    @Column(name = "refresh_token_hash", unique = true, length = 60)
    private String refreshTokenHash;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "logout_at")
    private LocalDateTime logoutAt;
}

