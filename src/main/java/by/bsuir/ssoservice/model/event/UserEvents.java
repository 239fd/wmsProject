package by.bsuir.ssoservice.model.event;

import by.bsuir.ssoservice.model.enums.AuthProvider;
import by.bsuir.ssoservice.model.enums.UserRole;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * События пользователя для Event Sourcing
 */
public class UserEvents {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserCreatedEvent {
        @JsonProperty("email")
        private String email;

        @JsonProperty("full_name")
        private String fullName;

        @JsonProperty("role")
        private UserRole role;

        @JsonProperty("password_hash")
        private String passwordHash;

        @JsonProperty("provider")
        private AuthProvider provider;

        @JsonProperty("organization_id")
        private UUID organizationId;

        @JsonProperty("warehouse_id")
        private UUID warehouseId;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserActivatedEvent {
        @JsonProperty("is_active")
        private Boolean isActive;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDeactivatedEvent {
        @JsonProperty("is_active")
        private Boolean isActive;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserPasswordChangedEvent {
        @JsonProperty("password_hash")
        private String passwordHash;
    }
}

