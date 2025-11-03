package by.bsuir.ssoservice.repository;

import by.bsuir.ssoservice.model.entity.UserReadModel;
import by.bsuir.ssoservice.model.enums.AuthProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Репозиторий для чтения пользователя (Read Model)
 */
@Repository
public interface UserReadModelRepository extends JpaRepository<UserReadModel, UUID> {

    Optional<UserReadModel> findByEmail(String email);

    @Query("SELECT u FROM UserReadModel u WHERE u.email = :email AND u.provider = :provider")
    Optional<UserReadModel> findByEmailAndProvider(@Param("email") String email, @Param("provider") AuthProvider provider);

    boolean existsByEmail(String email);
}

