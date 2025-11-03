package by.bsuir.ssoservice.repository;

import by.bsuir.ssoservice.model.entity.UserEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Репозиторий для событий пользователя (Write Model)
 */
@Repository
public interface UserEventRepository extends JpaRepository<UserEvent, Integer> {

    List<UserEvent> findByUserIdOrderByEventVersionAsc(UUID userId);

    UserEvent findFirstByUserIdOrderByEventVersionDesc(UUID userId);
}

