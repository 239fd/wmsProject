package by.bsuir.ssoservice.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank(message = "Имя не может быть пустым")
        @Size(max = 100, message = "Имя должно быть не более 100 символов")
        String firstName,

        @NotBlank(message = "Фамилия не может быть пустой")
        @Size(max = 100, message = "Фамилия должна быть не более 100 символов")
        String lastName,

        @Size(max = 100, message = "Отчество должно быть не более 100 символов")
        String middleName,

        @NotBlank(message = "Email не может быть пустым")
        @Email(message = "Некорректный формат email")
        String email
) {
}

