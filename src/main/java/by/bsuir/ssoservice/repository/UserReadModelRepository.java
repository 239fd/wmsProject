package by.bsuir.ssoservice.repository;

import by.bsuir.ssoservice.model.entity.UserReadModel;
import by.bsuir.ssoservice.model.enums.AuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Репозиторий для чтения пользователя (Read Model)
 */
@Repository
public interface UserReadModelRepository extends JpaRepository<UserReadModel, UUID> {

    Optional<UserReadModel> findByEmail(String email);

    Optional<UserReadModel> findByProviderAndProviderUid(AuthProvider provider, String providerUid);

    boolean existsByEmail(String email);
}

