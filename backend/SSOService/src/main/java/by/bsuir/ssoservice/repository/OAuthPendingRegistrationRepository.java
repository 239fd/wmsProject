package by.bsuir.ssoservice.repository;

import by.bsuir.ssoservice.model.entity.OAuthPendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OAuthPendingRegistrationRepository extends JpaRepository<OAuthPendingRegistration, UUID> {

    Optional<OAuthPendingRegistration> findByTemporaryTokenAndCompletedFalse(String temporaryToken);

    Optional<OAuthPendingRegistration> findByEmailAndProviderAndCompletedFalse(String email, String provider);

    @Modifying
    @Query("DELETE FROM OAuthPendingRegistration o WHERE o.expiresAt < :now OR o.completed = true")
    void deleteExpiredOrCompleted(LocalDateTime now);
}

