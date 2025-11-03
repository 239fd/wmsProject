package by.bsuir.ssoservice.repository;

import by.bsuir.ssoservice.model.entity.LoginAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LoginAuditRepository extends JpaRepository<LoginAudit, Integer> {

    List<LoginAudit> findByUserIdAndIsActiveTrueOrderByLoginAtDesc(UUID userId);

    List<LoginAudit> findByUserIdAndIsActiveTrue(UUID userId);

    @Modifying
    @Query("UPDATE LoginAudit la SET la.isActive = false, la.logoutAt = CURRENT_TIMESTAMP WHERE la.id = :id")
    void deactivateSessionById(@Param("id") Integer id);

    @Modifying
    @Query("UPDATE LoginAudit la SET la.isActive = false, la.logoutAt = CURRENT_TIMESTAMP WHERE la.userId = :userId AND la.isActive = true")
    void deactivateAllUserSessions(@Param("userId") UUID userId);
}

