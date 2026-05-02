# Требования от пользователя для завершения backend

## ✅ Исправления кода завершены (2026-05-02)

**Выполнено:**
- ✅ Все ошибки компиляции исправлены во всех 5 сервисах
- ✅ SSOService: удалены ссылки на `warehouseId`, исправлены raw типы Map
- ✅ warehouse-service: исправлены вызовы `getOrganizationId()` → `orgId()`
- ✅ organization-service: добавлена зависимость `nimbus-jose-jwt:9.37.3`
- ✅ Прогнан `allCodeQuality` — BUILD SUCCESSFUL

**Статистика качества кода:**
- PMD: 763 нарушения (SSOService: 126, org: 121, warehouse: 117, product: 298, document: 101)
- SpotBugs: 120 проблем (SSOService: 35, org: 16, warehouse: 9, product: 26, document: 34)
- Все отчёты: `backend/build/reports/unified/`

**Следующий шаг (I2):** Анализ и исправление нарушений PMD/SpotBugs перед снятием `ignoreFailures = true`

---

## SMTP Configuration (для C12 - Invitation Flow)

**Статус:** ✅ Настроено (2026-05-02)

**Конфигурация в `organization-service/src/main/resources/application.properties`:**
```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=${MAIL_USERNAME:your-email@gmail.com}
spring.mail.password=${MAIL_PASSWORD:your-app-password}
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
```

**Реальные данные (для локального запуска):**
```properties
MAIL_USERNAME=pavelkarliuk1@gmail.com
MAIL_PASSWORD=rujd mvxy aure wlsk
```

**Использование:**
- Локально: установить переменные окружения `MAIL_USERNAME` и `MAIL_PASSWORD`
- Docker/K8s: передать через environment variables или Secret
- Без переменных: использует дефолтные плейсхолдеры (отправка не работает)

**Где используется:**
- `organization-service` → `InvitationService.sendInvitationEmail()` — отправка email с invitation links

## Открытые вопросы

### 1. Четвертая роль STOREKEEPER (B1) ✅ РЕШЕНО (2026-05-02)
**Решение:** Оставляем 3 роли (`WORKER`, `ACCOUNTANT`, `DIRECTOR`) согласно poyasn.
**Обоснование:** Текущая ролевая модель полностью покрывает требования спецификации.

### 2. Flyway migrations (I3) — пользователь принял решение, ожидается реализация
Нужно принять решение:
- Оставить `ddl-auto=update` для разработки

**Текущее состояние:** Все сервисы используют `ddl-auto=update`.
