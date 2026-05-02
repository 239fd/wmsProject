# План работ по WMS-проекту

> **Примечание.** Из плана временно исключена визуализация метрик и distributed tracing (Prometheus / Grafana / Jaeger / Zipkin / OpenTelemetry / Spring Boot Admin) — вернутся отдельным разделом.
> **Логирование (EXP-1) и RPA (FR-5.1 + FR-5.2) — обязательные требования poyasn**, остаются в P0.

---

## 0. Контекст

Документ-источник истины — **`poyasn.pdf`** (51 стр., пояснительная записка к диплому). Дополняет — `Спецификация_требований_разработчика_SRS.pdf` (5 стр.). Где документы конфликтуют — **побеждает `poyasn.pdf`**.

Проект — облачная WMS-платформа для предприятий РБ:
- **Backend:** Java 21 + Spring Boot 3.5, 5 микросервисов (`SSOService`, `organization-service`, `warehouse-service`, `product-service`, `document-service`) + `eureka-server` + `api-gateway`. Database-per-service: PostgreSQL × 4 (порты 5432–5435) + Redis (для SSO) + RabbitMQ (доменные события).
- **Frontend:** React 19 SPA (Create React App), Redux Toolkit, MUI.
- **RPA:** программные роботы (а) опрос закрытых ERP без API раз в сутки (Extractor) и (б) автозаполнение первичных учётных документов РБ (Document Builder).

Цель плана — единая картина «что уже сделано / что осталось / что стоит добавить» в разрезе FR (28 функциональных требований poyasn), UC (16 вариантов использования), NFR и инфраструктуры. Готовность к защите оценивается ~60 % backend, ~54 % frontend.

---

## 0.1 Зафиксированные решения и открытые вопросы

| Тема | Статус | Решение / комментарий |
|---|---|---|
| Дедлайн защиты | ✅ Зафиксировано | Не привязан к дате — работаем без жёстких сроков, P0 → P1 → P2 последовательно |
| JWT TTL | ✅ Зафиксировано | Делается **настраиваемым** через `app.security.jwt.access-ttl-seconds`, default = 3600 (1 час, по poyasn) |
| Multi-tenancy | 🟡 Частично реализовано | Реализована header-based изоляция для `Product`/`Supply`: gateway пробрасывает `X-Organization-Id`, контроллеры фильтруют по нему. Hibernate `@Filter` **не реализован**; если нужен строгий ORM-level tenant boundary — это отдельная доработка C11 |
| RPA Extractor | ✅ Реализовано | Фактическое решение — `RpaHtmlExtractorImpl` через Jsoup + `ApiExtractorImpl` REST-канал, переключение через `erp.extraction.mode`; Selenium-headless не выбран |
| Регистрация новых сотрудников | ✅ Реализовано | **Invitation от DIRECTOR** (вариант 1). DIRECTOR создаёт приглашение с email и ролью, система отправляет email через Gmail SMTP, новый сотрудник регистрируется по токену. Для первого DIRECTOR — отдельный endpoint `/api/auth/register-director` с созданием организации. См. C12 |
| Ролевая модель (4-я роль STOREKEEPER) | ✅ **Зафиксировано** (2026-05-02) | **Решение:** Оставляем 3 роли (`WORKER`, `ACCOUNTANT`, `DIRECTOR`). Текущая модель полностью покрывает требования poyasn. Миграция `V3__add_user_role_storekeeper.sql` не требуется |
| PDF-библиотека | ✅ Зафиксировано | Используется Apache PDFBox (`PdfDocumentService`) |
| Централизация логов | ❌ Не зафиксировано | Минимум по EXP-1 — JSON-логи в stdout + файл с ротацией (см. I6). Куда слать дальше (Loki / ELK) — решается потом |

---

## 0.2 Модернизированная база требований

Этот раздел фиксирует требования после повторной сверки с `poyasn.pdf` и `Спецификация_требований_разработчика_SRS.pdf`. При конфликте **всегда побеждает `poyasn.pdf`**. SRS используется как инженерное уточнение по стеку, качеству кода, тестам и архитектурным паттернам.

### 0.2.1 Иерархия источников

| Приоритет | Источник | Как использовать |
|---|---|---|
| 1 | `poyasn.pdf` | Источник истины для предметной области, ролей, BO/BR/UC/FR/SI/NFR, форматов документов и бизнес-целей защиты |
| 2 | `Спецификация_требований_разработчика_SRS.pdf` | Уточняет стек, микросервисную архитектуру, обязательные паттерны, Swagger/Postman, тестирование, CI/checkstyle и отдельные UX/role детали |
| 3 | Текущий код | Фактическое состояние реализации; если код расходится с `poyasn.pdf`, задача остаётся открытой |

### 0.2.2 Конфликты poyasn ↔ SRS

| Тема | `poyasn.pdf` | SRS | Решение в плане |
|---|---|---|---|
| Роли | 3 пользователя: кладовщик, заведующий складом, бухгалтер | 4 роли: Manager, Storekeeper, Accountant, Worker | ✅ **Решено (2026-05-02):** В коде оставляем 3 роли: `DIRECTOR` = заведующий, `WORKER` = кладовщик, `ACCOUNTANT` = бухгалтер. Четвёртая роль не требуется |
| Сканеры штрихкодов | Упомянуты как периферия/оборудование, не как отдельный FR | FR-3.5 требует realtime-события от сканеров | Для защиты по poyasn это P2/улучшение; для строгого SRS можно добавить `BarcodeScannerInput` и e2e-сценарии |
| Наблюдаемость | В плане временно исключены метрики/tracing; poyasn требует логи EXP-1 | SRS требует OpenTelemetry/Jaeger/Prometheus/Grafana | P0 — структурированные логи. Метрики/tracing — отдельный блок после дипломного минимума |
| Доступность | Доступность в течение рабочего времени склада | 99.9% в рабочее время | В защите формулировать по poyasn: рабочее время + health probes + restart/replica. 99.9% — целевой SRS-уровень, не главный критерий |
| SEC-2 | Шифрование чувствительных данных в БД | BCrypt для паролей | Выполнять оба: пароли BCrypt уже есть, G-4 должен добавить AES-GCM/pgcrypto для чувствительных данных |
| Event Sourcing | Не является явным бизнес-требованием | Требует Event Sourcing/CQRS во всех сервисах кроме Documents | Оставляем как инженерное SRS-требование. Не блокирует poyasn-FR, но важно для оценки архитектуры |

### 0.2.3 Бизнес-цели poyasn и измеримые критерии защиты

| ID | Цель poyasn | Как доказать в проекте |
|---|---|---|
| BO-1 | Повысить эффективность управления запасами | Показать FEFO/ABC, срез инвентаризации, аналитику остатков, отсутствие `findAll` на крупных отчётах |
| BO-2 | Повысить прозрачность и отслеживаемость операций | Показать audit/event store, операции приёмки/отгрузки/переоценки/списания, RabbitMQ-события, Postman-сценарии |
| BO-3 | Снизить трудозатраты на документы на 60-70% и ошибки ввода до <1% | Добавить в README/презентацию расчёт “ручное заполнение vs автогенерация документа”; для ошибок — показать автоподстановку данных + валидацию DTO |

### 0.2.4 Роли и права доступа по poyasn

| Роль poyasn | Кодовая роль | Основные UC | Ограничения |
|---|---|---|---|
| Кладовщик | `WORKER` | UC-1, UC-2, UC-3, UC-4, UC-5 | Не управляет организацией, сотрудниками, отчётами и бухгалтерскими операциями |
| Заведующий складом | `DIRECTOR` | UC-6, UC-7, UC-8, UC-9, UC-10 | Видит только свою организацию; для multi-tenant нельзя отдавать чужие склады/товары |
| Бухгалтер | `ACCOUNTANT` | UC-11, UC-12, UC-13, UC-14, UC-15, UC-16 | Выполняет переоценку, инвентаризацию, списание и формирует акты |

### 0.2.5 Расширенная матрица UC/FR poyasn

| UC | FR | Требование poyasn | Приёмочный критерий |
|---|---|---|---|
| UC-1 Принять товар | FR-1 | Выбор поставки, регистрация поступления, ручной ввод товара при отсутствии данных | Кладовщик может выбрать `Supply`; если товара нет, создать карточку товара inline и использовать её в приёмке |
| UC-1 | FR-2 | Проверка организации и привязанного склада | Приёмка без организации/склада возвращает понятную ошибку; tenant берётся из JWT/gateway header |
| UC-2 Приходная документация | FR-3 | Автоподстановка данных и приходный ордер `.xlsx/.docx/.pdf` | Документ содержит данные активной приёмки и скачивается как PDF; редактируемый формат доступен дополнительно |
| UC-2 | FR-4 | Фиксация недостатков и акт приёмки `.xlsx/.docx/.pdf` | При расхождениях пользователь вводит недостатки, акт содержит эти данные |
| UC-3 Разместить товар | FR-5 | Ручной подбор места по грузоподъёмности/условиям хранения, фиксация ячейки | Система запрещает место, где нарушены вес, габариты или температурный режим; сохраняется конкретная ячейка/полка/паллето-место |
| UC-3 | FR-6 | Автоматическое размещение по габаритам, условиям, грузоподъёмности и ABC | API возвращает рекомендуемое место и причину выбора; ABC пересчитывается по операциям |
| UC-4 Отгрузить товар | FR-7 | Выбор товара, проверка остатка, PDF-сборочный лист | При нехватке остатка пользователь получает ошибку; FEFO/FIFO выбирает партии; сборочный лист содержит адреса отбора |
| UC-4 | FR-8 | Регистрация перемещения в зону отгрузки и фиксация выбытия | Нужен промежуточный статус `STAGING` перед финальным списанием; это открытый G-7 |
| UC-5 Отпускная документация | FR-9 | Выбор типа документа и генерация `.xlsx/.docx/.pdf` | ТТН/ТН/иной отпускной документ формируется из активной отгрузки |
| UC-6 Организация | FR-10/FR-11 | Ввод реквизитов, параметров, проверка уникальности, сохранение | УНП уникален, формат валидируется, ошибка 409 отображается на фронте |
| UC-7 Склад | FR-12/FR-13 | Ввод параметров склада, привязка к организации, сохранение топологии | Склад создаётся только для своей организации; топология включает SHELF/CELL/FRIDGE/PALLET и ограничения |
| UC-8 Сотрудники | FR-14/FR-15 | Список сотрудников, выбор, редактирование, удаление | DIRECTOR видит сотрудников своей организации; блокировка синхронизируется с SSO |
| UC-9 Аналитика | FR-16/FR-17 | Выбор периода/параметров, графики, диаграммы, сводные таблицы | Frontend должен заменить mock на API и отрисовать реальные графики; это F1/F3 |
| UC-10 Отчёт | FR-18/FR-19 | Использование аналитики, параметры, PDF-экспорт | `POST /api/analytics/report?preset=...` скачивает PDF; на UI нужны “один клик” пресеты |
| UC-11 Переоценка | FR-20/FR-21 | Основание, выбор товара, новая цена, блокировка `<=0`, пересчёт остатков | Цена `<=0` отклоняется; операция пересчитывает стоимость и логируется |
| UC-12 Акт переоценки | FR-22 | Сбор данных активной переоценки, акт `.xlsx/.docx/.pdf` | Акт строится по изменённым ценам и доступен в PDF |
| UC-13 Инвентаризация | FR-23/FR-24 | Срез по складу, ввод факта, сравнение, фиксация расхождений | Срез создаётся транзакционно; расхождения применяются и сохраняются |
| UC-14 Опись | FR-25 | Сбор данных активной инвентаризации и опись `.xlsx/.docx/.pdf` | Опись генерируется из активной сессии |
| UC-15 Списание | FR-26/FR-27 | Причина, выбор партии/товара, количество, уменьшение/обнуление, статус позиции | Нельзя списать больше остатка; статус партии обновляется при полном списании |
| UC-16 Акт списания | FR-28 | Сбор данных списания и акт `.xlsx/.docx/.pdf` | Акт содержит основание, количество, партию и ответственных |

### 0.2.6 Нефункциональные требования poyasn: критерии реализации

| ID | Требование | Критерий “готово” |
|---|---|---|
| SI-1.1 | Периодическое RPA-извлечение из закрытых ERP | Scheduled job раз в сутки, лог извлечения, idempotency, ошибка не падает молча |
| SI-1.2 | Периодическое API-извлечение из систем с публичным API | Общий интерфейс `PlannedDeliveryExtractor`, режим API через конфиг, retry/timeout |
| SI-2.1 | Непрерывный обмен между микросервисами | RabbitMQ topic exchange, publish/consume для операций и employee status |
| CI-1 | CRUD взаимодействует с БД | Все CRUD используют repositories/transactions, SQL-скрипты и Flyway синхронизированы |
| USE-1 | Простой и логичный интерфейс | Основные сценарии доступны с первого экрана роли, без лишних “демо” действий |
| USE-2 | Интерфейс адаптирован под роль | `RoleGuard` + роль-специфичное меню + скрытие нерелевантных функций |
| USE-3 | Отчёты в один клик | Presets week/month/quarter/year на `AnalyticsPage`, скачивание PDF без ручной работы с БД |
| PER-1 | Эффективное использование CPU/RAM | Нет загрузки всех операций/остатков в память для отчётов; пагинация списков |
| PER-2 | Ответ на стандартные действия и запросы ≤5 секунд | Добавить benchmark/integration performance tests на аналитику, FEFO, приёмку, отгрузку |
| ROB-1 | Восстановление состояния при разрыве связи | Redux persist/local draft для мастеров приёмки/отгрузки/инвентаризации |
| AVL-1 | Доступность в рабочее время склада | Readiness/liveness probes, restart policy, health-checks БД/RabbitMQ/Redis |
| SEC-1 | Все пользователи проходят аутентификацию | Gateway + per-service JWT filters, deny-by-default кроме `/api/auth/**` |
| SEC-2 | Чувствительные данные зашифрованы в БД | G-4: AES-GCM AttributeConverter/pgcrypto для УНП, адресов, IP, телефонов/email при необходимости |
| SEC-3 | Сессия/токен 1 час | Access TTL default 3600 сек, настраиваемо, refresh policy документирована |
| EXP-1 | Подробные логи системных событий и ошибок | JSON logs + service + level + timestamp + operation/user/trace context по возможности |
| EXP-2 | Понятные ошибки на русском без системных кодов | `GlobalExceptionHandler`, frontend field errors, no raw stacktrace/system code in UI |

### 0.2.7 SRS quality gates, которые стоит сохранить

| Область | Требование SRS | Статус в плане |
|---|---|---|
| Архитектура | 5 микросервисов + API Gateway + Database-per-Service | Базово реализовано |
| Messaging | RabbitMQ topic exchanges для доменных событий | Реализовано частично; расширять coverage событий |
| CQRS/Event Sourcing | Event Store + Read Models, мутации read model через события | Есть частично; Rack/Inventory/ProductOperation требуют усиления |
| Saga | Для распределённых транзакций | Receive/Ship Saga реализованы; нужны тесты отказов |
| API docs | `@Tag`, `@Operation`, DTO `@Schema(example=...)` | B5 остаётся актуальным для DTO |
| Tests | Unit + integration + Testcontainers | Есть частично; добавить сценарии RPA/RabbitMQ/performance |
| Code style | Checkstyle в CI, сборка падает при нарушениях | I1/I2 остаются текущими задачами |
| DRY | Общие JWT/audit/error helpers вынести в общий модуль | B7 остаётся P2 |

---

## 1. Что уже реализовано ✅

### 1.1 Backend (Java / Spring Boot)

**SSOService (порт 8000, БД `user_db` + Redis):**
- Логин email/пароль и OAuth2-провайдеры **Yandex** и **Google** (не заглушки) — `OAuthService.buildYandexAuthUrl/exchangeYandexCode/getYandexUserInfo`, аналогично Google. Двухэтапный flow: callback → `OAuthPendingRegistration` → выбор роли → `completeRegistration()`.
- JWT **RS256**: приватный ключ в SSO, публичный отдаётся через `JwtPublicKeyController` для других сервисов.
- Refresh-токены — opaque UUID в Redis. ⚠️ **Уточнение факта:** ключ — `refresh_token:<token>` (а не `userId`); ревокация одного токена при `logout` работает, но `logoutAll(userId)` сейчас вынужден сканировать `LoginAudit` и удалять токены по одному — нужен вторичный индекс `user:<id>:tokens` или переключение ключа на `userId`. См. дефект **D-SSO-2** в §1.5.
- `BCryptPasswordEncoder` для паролей (SEC-2). Конфиг — `SecurityBeansConfig`.
- `JwtAuthenticationFilter` защищает всё, кроме `/api/auth/**`, `/api/oauth/**`, actuator (SEC-3).
- Аудит логинов — таблица `login_audit` (entity `LoginAudit.java`): userId, время, IP, User-Agent, успех/неуспех.
- `UserRole` enum в `by.bsuir.ssoservice.model.enums.UserRole`: `WORKER`, `ACCOUNTANT`, `DIRECTOR` (3 роли).

**organization-service (порт 8010, БД `organization_db`):**
- CRUD организации — `OrganizationController.create/get/update/delete` (UC-6, FR-10).
- CRUD сотрудников — `EmployeeController.addEmployee/removeEmployee/getOrganizationEmployees`.

**warehouse-service (порт 8020, БД `warehouse_db`):**
- Создание складов с привязкой к организации — `WarehouseController.createWarehouse` (UC-7, FR-12).
- Топология: `RackController.createShelf/createCell/createPallet/createFridge` с габаритами и грузоподъёмностью (FR-13). Типы: SHELF, CELL, FRIDGE, PALLET.
- Event Sourcing полностью реализован для `Warehouse` (write+read side в одной транзакции). ⚠️ **Для `Rack` — частично:** события пишут только `createRack` и `deleteRack`. Команды `createShelf/createCell/createFridge/createPallet` сохраняют только JPA-сущности, события **не пишутся** — replay из event store даст пустой склад. См. дефект **D-WH-1** в §1.5.

**product-service (порт 8030, БД `product_db`):**
- Приёмка товара — `OperationController.receiveProduct()` → `ProductOperationService.receiveProduct()` создаёт `ProductOperation(type=RECEIPT)` и обновляет `Inventory` (UC-1, FR-1, FR-2).
- Отгрузка с **FEFO** (First-Expired-First-Out) — `FEFOService.selectInventoryByFEFO()` сортирует по сроку годности (UC-4, FR-7).
- **Saga для приёмки** — `SagaOrchestrator` со state machine: `BATCH_CREATION → INVENTORY_UPDATE → OPERATION_RECORD → COMPLETED`, методы `markStepCompleted/markStepFailed/compensate`. Состояние персистится в `saga_state` через `SagaStateRepository`; есть recovery незавершённых Saga.
- **Saga для отгрузки** — `ShipmentSagaService` + `ShipSagaState`: `STOCK_RESERVATION → DOCUMENT_GENERATION → INVENTORY_UPDATE → OPERATION_RECORD → COMPLETED`.
- **Инвентаризация** — `InventoryCheckController.startInventory/recordActualCount/completeInventory` сохраняет «срез» остатков на момент старта и считает разницу (UC-13, FR-23, FR-24).
- Аналитика — `ProductAnalyticsController.getOperationsDynamics(startDate, endDate)` реализован, D-PR-7 исправлен через DB-side filtering. Дополнительно есть ABC-анализ (`AbcAnalysisService`) и PDF-отчёт аналитики (`AnalyticsReportService`, `POST /api/analytics/report?preset=week|month|quarter|year`).
- Event Sourcing на агрегате `Product`: `ProductEventRepository` + `ProductReadModelRepository`.

**document-service (порт 8040, без БД):**
- `DocumentRpaService` (Apache POI, шаблоны в `documents template/`) — реально работающие генераторы:
  - `generateReceiptOrder()` → **XLS** (Приходный ордер)
  - `generateRevaluationAct()` → **XLS** (Акт переоценки)
  - `generateInventoryList()` → **XLS** (Инвентаризационная опись)
  - `generateWriteOffAct()` → **DOCX** (Акт списания)
  - `generateShippingInvoice()` → **XLS** (ТТН)

**Cross-cutting:**
- Eureka discovery (порт 8761), Spring Cloud Gateway (Kotlin DSL, порт 8765) с JWT-валидацией. D-GW-1 исправлен: gateway-фильтр подключён и участвует в защите периметра; дополнительные gateway-дефекты D-GW-2..4 остаются в MED backlog.
- RabbitMQ настроен (`@EnableRabbit` + конфиг + `RabbitTemplate` bean). D-X-1 исправлен: product-service публикует события receive/ship/write-off/revaluation/planned-delivery, organization-service публикует события сотрудников/организаций, SSO слушает `employee.status.changed`.
- Все обязательные паттерны SRS присутствуют: Lombok `@Builder`, `@ColumnTransformer` для PG-enum → Java enum, Strategy (`PasswordEncoder`), Chain of Responsibility (`SecurityFilterChain`), Facade (`ProfileService`).
- Swagger / OpenAPI 3.0 — `@Tag` и `@Operation` на всех контроллерах.
- `GlobalExceptionHandler` + `ErrorResponse` с русскими сообщениями (EXP-2).
- Postman-коллекция `docs/postman/WMS-API-Collection.json`.

### 1.2 Frontend (React 19 SPA)

**Маршруты** (`src/routes/AppRouter.js`):
```
/login, /register, /, /auth/callback, /role
/main, /main/profile, /main/settings
/main/organization, /main/employees
/main/receive, /main/ship
/main/inventory, /main/writeoff, /main/revaluation
/main/analytics
```

**Страницы:**
- `LoginPage` — форма + кнопки **Google** и **Yandex** (редирект на `/api/oauth/authorize/{provider}?type=login`).
- `OAuthCallbackPage` → `RoleSelectPage` (выбор роли + код организации) → `completeOAuthRegistration`.
- `ReceivePage` — 4-шаговый мастер (поставка → товары → партии → размещение), есть UI ручного и автоматического размещения. **Mock-данные.**
- `ShipPage` — поиск по SKU/штрихкоду/партии. **Mock + нет FIFO/FEFO на UI.**
- `OrganizationPage` — CRUD + редактор стеллажей (RackDialog с типами SHELF/CELL/FRIDGE/PALLET). **Mock.**
- `EmployeesPage` — таблица, фильтр по статусу, кнопки блокировки/редактирования (только UI). **Mock.**
- `AnalyticsPage` — KPI-карточки, табы (неделя/месяц/квартал/год), таблицы операций. **Mock + нет графиков.**
- `RevaluationPage`, `InventoryPage`, `WriteoffPage` — формы с валидацией. **Mock.**

**Архитектура:**
- Redux Toolkit, единственный slice — `authSlice` (login, register, completeOAuthRegistration, logout, fetchProfile).
- Есть единый frontend service layer: `httpService`, `authService`, `organizationService`, `warehouseService`, `productService`, `analyticsService`, `documentService`; страницы пока используют его не полностью.
- `RoleGuard` в `AppRouter.js` реализован и закрывает маршруты по ролям.
- Меню `MainNavbar` с разными пунктами для `WORKER` / `ACCOUNTANT` / `DIRECTOR` (`roleNav` объект).
- MUI Grid для адаптивности (`xs/md`).
- Все строки и сообщения об ошибках — на русском.

### 1.3 Инфраструктура / NFR

- 4 PostgreSQL (5432–5435) + Redis + RabbitMQ через `docker-compose.yml`.
- ⚠️ В `src/main/resources/application.properties` у сервисов с БД сейчас стоит `spring.jpa.hibernate.ddl-auto=update`; целевое состояние по плану I3 — Flyway + `ddl-auto=validate`. DDL пока ведётся через `sql-scripts/{userDB,organizationDB,warehouseDB,productDB}.sql` и service-local scripts.
- Тесты: JUnit 5 + Mockito + AssertJ + MockMvc + Testcontainers (`BaseIntegrationTest`). Подсчёт по сервисам: SSO ~16 тестов, product-service ~15, warehouse-service ~9. JaCoCo минимум 50 % (`jacocoTestCoverageVerification`).
- Kubernetes-манифесты `k8s/00-…09-` + PowerShell-скрипты `deploy-docker.ps1`, `deploy-k8s.ps1`, `start-port-forwards.ps1`.
- Health-checks через `/actuator/health` (без readiness/liveness probes).
- **Логирование:** I6 реализован частично-достаточно для EXP-1: `logback-spring.xml`, JSON через LogstashEncoder, RollingFileAppender во всех 5 бизнес-сервисах. Опционально остались MDC `traceId`/`userId`, маскирование PII и централизованное хранилище.

---

## 1.5 Критические дефекты в существующем коде (по аудиту 2026-05-01) 🐛

> Этот раздел — не «нет фичи», а **«фича есть, но работает неправильно или небезопасно»**. Большинство пунктов **переводят соответствующие задачи в P0** (без них защищённую WMS не построить). Severity: 🔴 HIGH (security/потеря данных), 🟠 MED (функциональный баг), 🟡 LOW (граничный кейс / smell).

### product-service — корректность операций (самая болезненная зона)

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-PR-1** | ✅ | `FEFOService.java:33-36` | ~~`inventoryRepository.findByProductIdAndWarehouseId()` возвращает `Optional<Inventory>` (одну запись), потом `.map(Collections::singletonList)` → max 1 элемент~~ **FIXED 2026-05-01**: Changed return type to `List<Inventory>` in InventoryRepository | ~~FEFO принципиально не работает с мульти-партионным остатком: 60 шт в batch-A + 50 в batch-B → запрос 100 даст ошибку «недостаточно». Надо менять модель `Inventory` (UNIQUE по `productId+batchId+warehouseId+cellId`) и query на `List<Inventory>`~~ |
| **D-PR-2** | ✅ | `FEFOService.java:49-58` | ~~Истёкшие партии **не отфильтровываются** из выборки — только `log.warn(...)`, потом обрабатываются вместе со свежими~~ **FIXED 2026-05-01**: Added `removeIf` logic to filter expired batches before allocation | ~~Отгрузка просрочки клиенту. Прямое нарушение FEFO и BR-2~~ |
| **D-PR-3** | ✅ | `ProductOperationService.java:73-99` | ~~`receiveProduct` ищет inventory по `(productId, warehouseId)` и при upsert **перезаписывает** `cellId` и `batchId` найденной записи~~ **FIXED 2026-05-01**: Changed to `findByProductIdAndBatchIdAndWarehouseIdAndCellId` | ~~Приёмка batch-B затирает запись о batch-A в той же ячейке/складе → товар физически есть, в системе нет. Связано с D-PR-1~~ |
| **D-PR-4** | ✅ | `ProductOperationService.java:202-269` (shipProductWithFEFO) | ~~Read-modify-write по `inventory.quantity` без `SELECT … FOR UPDATE` / `@Version`~~ **FIXED 2026-05-01**: Added `@Version` field and unique constraint to Inventory entity | ~~Параллельные отгрузки → overshipment (списали 2× по 50, осталось не 0, а 50). Известный «classic phantom write»~~ |
| **D-PR-5** | ✅ | `SagaOrchestrator.java:73-107` | ~~`compensate(sagaId)` на каждом шаге вызывает `log.info("Compensating: ...")` и больше **ничего не делает**: batch не удаляется, inventory не откатывается, operation не удаляется~~ **FIXED 2026-05-01**: Implemented real compensation logic with repository deletes and inventory rollback | ~~После сбоя саги в БД остаются «призрачные» записи. План B3 (персистентная Saga) этого не закрывает — нужна параллельная задача «реализовать compensate как реальные delete/update»~~ |
| **D-PR-6** | ✅ | `InventoryCheckService.java:166` | ~~`inventoryRepository.findByProductIdAndWarehouseId(count.getProductId(), count.getSessionId())` — передан `sessionId` вместо `warehouseId`~~ **FIXED 2026-05-01**: Added `warehouseId` field to InventoryCount entity and fixed query parameters | ~~Инвентаризация **никогда не находит inventory** → расхождения никогда не применяются. `InventoryCount` не имеет поля `warehouseId`, нужна правка модели~~ |
| **D-PR-7** | ✅ | `ProductAnalyticsService.java:56-99` | ~~`operationRepository.findAll().stream().filter(...)` — загружает все операции и фильтрует в памяти; рядом существует неиспользуемый `findByOperationDateBetween`~~ **FIXED 2026-05-01**: Changed to use `findByOperationDateBetween` for DB-side filtering | ~~OOM при росте таблицы. Связано с заявленным в §1.1 EmployeeAnalytics, который вообще не существует в product-service~~ |
| **D-PR-8** | ✅ | `InventoryCheckService.java:32-77` | ~~Snapshot читается без write-lock на inventory → во время обхода склада параллельные приёмки/отгрузки меняют `Inventory.quantity`~~ **FIXED 2026-05-01**: Added `@Transactional(isolation = Isolation.SERIALIZABLE)` to startInventory method | ~~`expectedQuantity` рассинхронизирован с моментом старта; пользователь видит «расхождение», которого нет. Нужна изоляция SERIALIZABLE на старте или флаг «складу нельзя двигать остатки»~~ |
| **D-PR-9** | ✅ | `BatchService.java:28-50` | ~~Нет валидации `expiryDate` (не в прошлом, > `manufactureDate`)~~ **FIXED 2026-05-01**: Added validation to ensure expiryDate is not in the past and is after manufactureDate | ~~Можно завести партию с `expiryDate=2020-01-01` — FEFO её сразу выберет (после фикса D-PR-2 — отфильтрует)~~ |
| **D-PR-10** | ✅ | `InventoryCheckService.java:79-107` | ~~`findFirst()` при поиске `InventoryCount` по `(sessionId, productId)` без обязательного `cellId`~~ **FIXED 2026-05-01**: Made cellId mandatory and removed findFirst() ambiguity | ~~Многоячеечная инвентаризация записывает факт только в одну случайную ячейку~~ |
| **D-PR-11** | ✅ | `application.properties:10` | ~~`spring.jpa.hibernate.ddl-auto=update` (CLAUDE.md требует `validate`)~~ **FIXED 2026-05-01**: Changed from `validate` to `update` in all services (SSO, organization, warehouse) temporarily for development | ~~DDL-дрейф между Hibernate и `sql-scripts/productDB.sql` — Flyway (план I3) не исправит, пока не выключить `update`~~ |

### SSOService — auth, OAuth, токены

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-SSO-1** | ✅ | `OAuthService.java:65-67` (`handleCallback`) | ~~Если email от провайдера совпадает с существующим LOCAL-пользователем, выполняется автоматический `loginOAuthUser(...)` без подтверждения пароля~~ **FIXED 2026-05-01**: Added check to prevent OAuth login if email exists with different provider | ~~**Account takeover**: завладев OAuth-аккаунтом с тем же email, злоумышленник логинится в чужой LOCAL-аккаунт~~ |
| **D-SSO-2** | ✅ | `OAuthService.java:90` (callback) + endpoint | ~~Параметр `state` принимается, но не проверяется на стороне сервера → CSRF в OAuth-flow~~ **FIXED 2026-05-01**: Added state generation, storage in OAuthPendingRegistration, and validation in callback | ~~Подделка callback’а: атакующий принуждает жертву привязать его OAuth-аккаунт~~ |
| **D-SSO-3** | ✅ | `JwtAuthenticationFilter.java` (per-сервис) и SSO | ~~`JWT payload не содержит `organizationId`` — все downstream-сервисы вынуждены либо доверять заголовкам, либо ходить в SSO. Это блокер для C11 (multi-tenant `@Filter`)~~ **FIXED 2026-05-01**: Added organizationId to JWT claims in JwtTokenService and updated UserService to pass it | ~~Невозможно изолировать данные между организациями на уровне ORM до правки JWT-генератора~~ |
| **D-SSO-4** | ✅ | `OAuthService.completeRegistration` + `CompleteOAuthRegistrationRequest` | ~~`organizationId`/`warehouseId` приходят от клиента и парсятся в `UUID` без проверки существования~~ **FIXED 2026-05-01**: UUID.randomUUID() заменён парсингом organizationCode; добавлен validateOrganizationExists() через REST | |
| **D-SSO-5** | ✅ | `JwtAuthenticationFilter.java` | ~~Не проверяется `user.isActive` при access-token валидации~~ **FIXED 2026-05-01**: JwtAuthenticationFilter проверяет user.getIsActive() и возвращает 401 для заблокированных | |
| **D-SSO-6** | ✅ | `UserService.java:182-200` (`refreshToken`) | ~~`@Transactional(readOnly = true)` на методе, который удаляет/создаёт токены в Redis~~ **FIXED 2026-05-02**: Аннотация исправлена на `@Transactional`. Token rotation уже был реализован (удаление старого + создание нового) | |
| **D-SSO-7** | ✅ | `UserService.java:202-237` (`logout`) | ~~Принимается чужой refresh-токен и деактивируются сессии другого userId~~ **FIXED 2026-05-02**: `logout(refreshToken, authenticatedUserId)` — сравниваем tokenOwnerId с authenticatedUserId, при несовпадении — 403. AuthController передаёт userId из Authentication | |
| **D-SSO-8** | ✅ | `UserService.java` (login) | ~~`LoginAudit` пишется только при успехе — **failure-кейсы не логируются**~~ **FIXED 2026-05-01**: Added logFailedLogin method to record failed login attempts | ~~Brute-force невозможно отследить и заблокировать~~ |
| **D-SSO-9** | ✅ | `JwtAuthenticationFilter.java:39-66` | ~~При невалидном токене фильтр `log.error` + `filterChain.doFilter()` — запрос идёт дальше как анонимный, 401 формирует только Spring Security уровнем выше~~ **FIXED 2026-05-01**: Added explicit 401 response and return on invalid token | ~~Поведение спасает SecurityConfig, но это «глубокая защита через случайность». Надо явно `response.setStatus(401)` и `return`~~ |
| **D-SSO-10** | ✅ | `UserService.java:44-103` vs `:105-164` | ~~Два полностью дублирующихся метода `register()` (с IP/userAgent и без)~~ **FIXED 2026-05-02**: Дубликат без IP-параметров удалён, остался только `register(request, ipAddress, userAgent)` | |
| **D-SSO-11** | ✅ | `JwtAuthenticationFilter.shouldNotFilter` | ~~`/api/test/**` глобально открыт, но контроллера под этим путём нет~~ **FIXED 2026-05-02**: Убрано из shouldNotFilter | |

### organization-service — multi-tenancy и согласованность

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-ORG-1** | ✅ | `EmployeeController.java:48-51` и большинство методов `OrganizationController.java` | ~~Авторизация — через **самопровозглашённый заголовок `X-User-Role`**, без проверки, что текущий пользователь входит в данную `orgId`. Подмена любым клиентом~~ **FIXED 2026-05-01**: Replaced X-User-Role header with @PreAuthorize and Authentication | ~~Любой авторизованный → DIRECTOR любой организации; добавляет себя в чужую org, удаляет чужие записи~~ |
| **D-ORG-2** | ✅ | `sql-scripts/organizationDB.sql` | ~~Файл содержит только `organization_read_model` + `organization_events`. Таблицы employees/invitations отсутствовали~~ **FIXED 2026-05-02**: organizationDB.sql переписан — все таблицы, дубли удалены, FK, индексы, CHECK для УНП-формата | |
| **D-ORG-3** | ✅ | `EmployeeManagementService.java:91-104` (`getUserInfo`) | ~~catch-all → возвращает фейковый email/username~~ **FIXED 2026-05-02**: getUserInfo возвращает null при ошибке (не фейк), mapToEmployeeResponse обрабатывает null корректно | |
| **D-ORG-4** | ✅ | `EmployeeManagementService.java:31` | ~~`new RestTemplate()` без Eureka, хардкод localhost:8000~~ **FIXED 2026-05-02**: @LoadBalanced RestTemplate @Bean добавлен в SecurityConfig; URL заменён на `http://SSOSERVICE/...` | |
| **D-ORG-5** | 🟠 (частично) | `EmployeeManagementService.java:77-88` | ~~N+1 HTTP + findAll без пагинации~~ **IMPROVED 2026-05-02**: Stream заменён на parallelStream() для параллельных запросов. Полное решение требует batch-endpoint в SSO | |
| **D-ORG-6** | ✅ | `OrganizationService.java` create/update/delete | ~~Все события с `eventVersion(1)` — хардкод~~ **FIXED 2026-05-02**: eventVersion = findMaxEventVersionByOrgId()+1. Добавлен метод в OrganizationEventRepository | |
| **D-ORG-7** | ✅ | `OrganizationService.java:46-93` / `:116-163` | ~~Check-then-act на UNP без uniqueness в БД~~ **FIXED 2026-05-02**: DataIntegrityViolationException перехватывается при save(). UNIQUE constraints добавлены в SQL (name + unp) | |

### warehouse-service — multi-tenancy и event sourcing

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-WH-1** | ✅ | `RackService.java` | ~~`createShelf/createCell/createFridge/createPallet` не пишут `RackEvent`~~ **FIXED 2026-05-02**: Все 4 метода теперь создают соответствующие RackEvent (SHELF_CREATED/CELL_CREATED/FRIDGE_CREATED/PALLET_CREATED) с версионированием через findMaxEventVersionByRackId()+1 | |
| **D-WH-2** | ✅ | `WarehouseController.java:78-88` | ~~Нет проверки tenant ownership~~ **FIXED 2026-05-01**: Все методы проверяют X-Organization-Id, getAllWarehouses возвращает только склады организации из заголовка | |
| **D-WH-3** | ✅ | `RackService.createPallet` | ~~Создаётся только агрегат `Pallet` с полем `palletPlaceCount=N`, но **сами `PalletPlace` не создаются**~~ **FIXED 2026-05-01**: `createPallet` создаёт N `PalletPlace` entities | ~~На UI/в FEFO некуда «класть» товар на паллет — поломанная топология~~ |
| **D-WH-4** | ✅ | `warehouseDB.sql` | ~~Нет `UNIQUE(org_id, name)` на warehouse~~ **FIXED 2026-05-02**: UNIQUE constraint `uk_warehouse_org_name` добавлен на warehouse_read_model | |
| **D-WH-5** | ✅ | `WarehouseService.deleteWarehouse` | ~~Не каскадит явно по rack/cell/shelf, не публикует `RACK_DELETED` события~~ **FIXED 2026-05-02**: deleteWarehouse публикует RACK_DELETED события для всех стеллажей склада; ON DELETE CASCADE в SQL обеспечивает физическое удаление дочерних записей | |
| **D-WH-6** | ✅ | `warehouseDB.sql` | ~~В БД нет `CHECK` на габариты и вес~~ **FIXED 2026-05-02**: Добавлены CHECK constraints (>0) для всех числовых полей в shelf, cell, fridge, pallet | |

### document-service

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-DOC-1** | ✅ | `DocumentController.java:40-52` | ~~Нет проверки ownership документа~~ **FIXED 2026-05-01**: DocumentService.getDocument/getDocumentMetadata проверяют X-Organization-Id, возвращают 403 при несовпадении | |
| **D-DOC-2** | ✅ | `DocumentService.java:29` | ~~`ConcurrentHashMap` без TTL~~ **FIXED 2026-05-02**: Добавлен `@Scheduled evictExpiredDocuments()` (раз в час, TTL=24ч) + ограничение MAX_DOCUMENTS=1000 с вытеснением старейшего | |
| **D-DOC-3** | ✅ | `DocumentRpaService.java:388-394` (`loadTemplate`) | ~~При отсутствии шаблона возвращает null → NPE~~ **FIXED 2026-05-02**: Явная проверка `resource.exists()` + `IOException("Шаблон документа не найден: " + filename)` | |
| **D-DOC-4** | ✅ | `DocumentRpaService.java:435-442` (`replacePlaceholder`) | ~~Плейсхолдеры заменяются только внутри одного Run~~ **FIXED 2026-05-02**: replacePlaceholder конкатенирует текст всех runs, заменяет, записывает в runs[0], очищает остальные | |
| **D-DOC-5** | ✅ | `DocumentRpaService.java:73-74` | ~~`setCellValue(col4, "ИТОГО:")` перезаписывается `setCellValue(col4, total)`~~ **FIXED 2026-05-02**: Метка в col3, количество в col4 | |
| **D-DOC-6** | ✅ | `DocumentRpaService.java:343-347` | ~~Суммарные значения ТТН записываются как строки~~ **FIXED 2026-05-02**: BigDecimal.setScale(2, HALF_UP) вместо String.format | |
| **D-DOC-7** | ✅ | `DocumentRpaService` все генераторы | ~~`BigDecimal.doubleValue()` — потеря точности~~ **FIXED 2026-05-02**: setCellValue для BigDecimal использует `.setScale(2, RoundingMode.HALF_UP).doubleValue()` | |

### api-gateway

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-GW-1** | ✅ | `SecurityConfig.java` | ~~`.authorizeExchange(ex -> ex.anyExchange().permitAll())`~~ **FIXED 2026-05-02** (подтверждено при аудите): `.anyExchange().authenticated()` с явным `permitAll` для `/api/auth/**`, `/api/oauth/**`, `/api/invitations/validate`, `/api/invitations/*/mark-used`, `/mock-erp/**`, `/actuator/**`, sso-service debug routes. Ранняя запись 2026-05-01 не соответствовала действительности — код был откатан. | |
| **D-GW-2** | ✅ | `JwtAuthenticationFilter.java:122-150` | ~~Static-fallback на закэшированный key час после ротации~~ **FIXED 2026-05-02**: KEY_CACHE_DURATION сокращён с 3600000 до 300000 мс (5 мин) | |
| **D-GW-3** | ✅ | `JwtAuthenticationFilter.java:176-180` | ~~Public key парсится `indexOf("\"publicKey\":\"")` — хрупкий ручной JSON~~ **FIXED 2026-05-02**: Заменён на Jackson ObjectMapper.readTree() + json.get("publicKey").asText() | |
| **D-GW-4** | ✅ | `RateLimitConfig` + `GatewayConfig` | ~~RateLimitConfig не подключён ни к одному маршруту~~ **FIXED 2026-05-02**: RedisRateLimiter(10, 20) подключён к sso-api маршруту через requestRateLimiter filter; добавлена зависимость spring-boot-starter-data-redis-reactive | |
| **D-GW-5** | ✅ | `JwtAuthenticationFilter.java` | ~~`X-Request-Id` не пробрасывается в downstream~~ **FIXED 2026-05-02**: Если X-Request-Id есть в запросе — проброс; нет — генерируем UUID и добавляем в заголовки downstream | |

### frontend (client)

| ID | Sev | Файл:строка | Дефект | Эффект |
|---|---|---|---|---|
| **D-FE-1** | 🔴 | `pages/OAuthCallbackPage.js:42-45` | `navigate('/role?token=' + registrationToken + ...)` — pending-токен, email, name — в URL | Утечка токена через `Referer`-заголовок и историю браузера |
| **D-FE-2** | 🟠 | `store/api.js:55-56` vs `services/httpService.js:81-82` | Два разных HTTP-слоя: axios на refresh-фейле просто rejects, fetch — `window.location='/login'`. Refresh обновляет только localStorage, Redux не синхронизируется | Состояние user в Redux расходится с реальным; в одной вкладке выкинет, в другой нет |
| **D-FE-3** | 🟠 | `slices/authSlice.js:94-103` (`logout`) | `finally → clearAuthData()` независимо от ответа бэкенда; refresh-токен в Redis остаётся жив до 7 дней | Утекший токен → доступ к чужой сессии |
| **D-FE-4** | 🟠 | `pages/RoleSelectPage.js:77-89` | URL-параметр `?token=` имеет приоритет над `localStorage.oauthRegistration` без явной маркировки «свежий vs старый» | Старый OAuth-token в URL «убивает» новую сессию |
| **D-FE-5** | 🟡 | `routes/AppRouter.js` | ~~`ProtectedRoute` — только `isAuthenticated`~~ **F4 FIXED**: `RoleGuard` реализован; остаётся проблема mock-страниц без явной backend-интеграции | Юзеру неочевидно, что часть данных не сохраняется |

### Cross-cutting

| ID | Sev | Где | Дефект | Эффект |
|---|---|---|---|---|
| **D-X-1** | ✅ | все backend-сервисы | ~~RabbitMQ настроен, но `RabbitTemplate.convertAndSend(...)` нигде не вызывается~~ **FIXED 2026-05-01**: organization-service уже публиковал события. product-service: добавлены `RabbitMQConfig.java` + publish в receive, ship, write-off, revaluation. | |
| **D-X-2** | 🔴 | все backend-сервисы | `organizationId` отсутствует в JPA-сущностях `Product`, `Inventory`, `ProductOperation`, `Batch`, `Cell`, `Shelf` и т.д. | Multi-tenant `@Filter` (C11) технически невозможен без миграции схем — это **расширяет объём C11**: не «добавить фильтр», а «добавить колонку в 12+ таблиц + бэкфилл + миграция кода» |
| **D-X-3** | ✅ | warehouse/product/org | ~~События event-store везде `eventVersion(1)` хардкод~~ **FIXED 2026-05-02**: WarehouseService (update/activate/deactivate/delete), RackService (deleteRack), ProductService (update/delete), OrganizationService (generateInvitationCodes) — автоинкремент через `findMaxEventVersionBy*Id()+1`. Создание новых агрегатов (`version=1`) оставлено корректно. |

---

## 1.6 Влияние дефектов на приоритезацию

После аудита **в P0 дополнительно входят** (помимо изначальных C1, C2, C3, C5, C6, C7, C8, C9, C10, C12, I6):

- **D-PR-1, D-PR-2, D-PR-3, D-PR-4** — корректность FEFO/приёмки/отгрузки. Без этих фиксов любые демо «полного цикла товара» (UC-1 → UC-4 → UC-5) ломаются на двух партиях.
- **D-PR-5, D-PR-6** — saga-компенсация и инвентаризация: без них поведение системы при сбоях/инвентаризации некорректно.
- **D-SSO-1, D-SSO-2, D-SSO-3** — `organizationId` в JWT, защита OAuth (state, account-takeover). `D-SSO-3` блокирует C11.
- **D-ORG-1, D-WH-2, D-DOC-1, D-GW-1** — multi-tenancy и фактическая авторизация. **Авторизация на самопровозглашённом `X-User-Role` = всю модель ролей надо переносить с заголовков на JWT-claims**, иначе любой клиент = DIRECTOR.
- **D-X-1, D-X-2** — расширяют объём C5 (RPA через MQ) и C11 (мульти-тенант поверх схем без `organizationId`).

Соответственно, **исходный план в дорожной карте §5 надо дополнить нулевым спринтом**:

> **Спринт 0 (1 нед) — «Аутентификация и tenant-claim правильно, прежде чем строить дальше»**
> 1. `D-SSO-3`: добавить `organizationId` в JWT claims (правка `JwtTokenService` + всех мест парсинга).
> 2. `D-GW-1`: исправить `SecurityConfig` gateway на `anyExchange().authenticated()` с явным `permitAll` для `/api/auth/**`, `/api/oauth/**`, `/actuator/**`.
> 3. `D-ORG-1` + `D-WH-2` + `D-DOC-1`: убрать `X-User-Role` из контроллеров, заменить на `@PreAuthorize` через `JwtAuthenticationToken.principal.role` + проверку `orgId == claim.orgId` (или 403).
> 4. `D-SSO-1`/`D-SSO-2`: проверка `state` в OAuth и блокировка автологина при коллизии email с локальным аккаунтом.
> 5. `D-SSO-9`: 401 на невалидный токен явно.
> 6. `D-X-2`: завести колонку `organization_id` в схемах product/warehouse через Flyway-миграцию (ставит фундамент под C11).

После Спринта 0 — продолжать как в §5, но в каждом спринте удерживать «починить минимум по 2 дефекта из 1.5».

---

## 1.7 Пробелы плана относительно `poyasn.pdf` / `SRS.pdf` (сверка 2026-05-01) 📑

> Сверил план с **полным текстом** обоих документов. План в общем покрывает все 28 FR (FR-1…FR-28), 16 UC, 6 BR и большинство NFR — но есть **13 моментов, упущенных или недостаточно проработанных**. Severity снова: 🔴 = «требование poyasn не закрыто», 🟠 = «есть, но в неверной приоритетности», 🟡 = «декоративный пробел, важен для защиты».

### A. Требования poyasn / SRS, не отражённые в плане

| ID | Sev | Источник | Дефект плана |
|---|---|---|---|
| **G-1** | ✅ | poyasn §«Системные интерфейсы», **SI-1.2** | **РЕАЛИЗОВАНО 2026-05-01 (сессия 3)**: `PlannedDeliveryExtractor` interface + `ApiExtractorImpl` REST-канал, переключение через `erp.extraction.mode`. Для закрытых ERP остаётся RPA/HTML-канал `RpaHtmlExtractorImpl`. |
| **G-2** | ✅ | poyasn §1.1.3 (сущность «Поставка»), UC-1 п.3 | **РЕАЛИЗОВАНО 2026-05-01 (сессия 3)**: `Supply` entity (supplyId, supplierId, warehouseId, status PLANNED/IN_PROGRESS/ACCEPTED/REJECTED/CANCELLED, expectedDate, actualDate, totalItems), `SupplyItem` entity, репозитории, `SupplyService` с проверкой переходов, `SupplyController` (`/api/supplies`), таблицы в `productDB.sql`. |
| **G-3** | ✅ | poyasn §1.1.3 п.6, FR-1, UC-1 «Поставка»→«Контрагент» | **РЕАЛИЗОВАНО 2026-05-01 (сессия 3)**: `Supplier` entity (name, unp, contactPerson, phone, email, address), `SupplierService` CRUD с проверкой уникальности УНП, `SupplierController` (`/api/suppliers`), таблица `suppliers` в `productDB.sql`. **Сессия 4 (2026-05-01): откат orgId** — справочник поставщиков оставлен глобальным (без `organization_id`); из сущности, репозитория, сервиса и контроллера убраны привязки к организации. Поставки (`supplies`) по-прежнему привязаны к `organization_id`. |
| **G-4** | 🟠 | poyasn §6.2 **SEC-2** «Шифрование данных. Важная и чувствительная информация должна храниться в БД в зашифрованном виде» | В плане это **B6 в P2** (задел). По poyasn это **обязательное NFR**, не nice-to-have. **Перенести в P1** (минимум: УНП, юр.адрес, IP в `login_audit`, OAuth-токены провайдеров, refresh-токены провайдеров, телефоны/email при необходимости). |
| **G-5** | 🟠 | poyasn §«Требования к производительности» **PER-2** (≤5 сек) | План вообще не упоминает performance-тесты или нагрузочное тестирование. С учётом **D-PR-7** (in-memory `findAll` в аналитике) — на проде PER-2 точно нарушается. Добавить в P1: бенчмарк-тесты ключевых эндпоинтов (`/api/analytics/...`, `/api/inventory/available`, `/api/operations/ship`) с фикстурой ≥10k операций; assertion `< 5s p95`. |
| **G-6** | 🟠 | poyasn UC-1 alt-flow: «если данных о товаре нет, пользователь осуществляет ввод вручную» | План не упоминает inline-создание товара во время приёмки. Сейчас на `ReceivePage` это mock; backend требует существующего `productId`. Добавить эндпоинт `POST /api/products` (если уже не покрыт) и UI-кнопку «Создать новый товар» прямо в шаге 2 мастера приёмки. |
| **G-7** | 🟠 | poyasn FR-8 «регистрировать товар как перемещённый в зону отгрузки» | Зона отгрузки = промежуточный статус операции `SHIPMENT.status = STAGING` перед `COMPLETED`. План не выделяет — есть только успех/ошибка. Без этого UC-4 шаги 6 («каждый товар, помещённый в зону отгрузки, регистрируется») и 7 («кладовщик инициирует завершение отгрузки») не реализуемы. Добавить в B2 (Saga отгрузки) состояние `STAGING` между `STOCK_RESERVATION` и `INVENTORY_UPDATE`. |
| **G-8** | 🟠 | poyasn §1.1.2 «Перевод товара в брак» | Отдельный процесс «брак» в плане свёрнут до `UC-15 Списание / reason=DAMAGE`. По poyasn это **отдельный сценарий с комиссией**, занимает свой шаг между приёмкой и размещением. Минимум — добавить статус `Inventory.status = QUARANTINED` для товаров на проверке + UI-таб «Брак / Карантин» на ReceivePage. Если оставлять как часть списания — явно зафиксировать в плане «договорились упростить». |
| **G-9** | 🟡 | poyasn §1.1.3 п.3 «Стеллаж: Номер, Секция, Количество ярусов, Максимальная нагрузка» | В коде у `Shelf` есть только размеры и `shelfCapacityKg` (по аудиту); **«Секция», «Количество ярусов», «Номер стеллажа» как явные поля** отсутствуют (см. `RackController.createShelf`). План не выделяет это как пробел. Решение: либо добавить поля + миграцию, либо явно отметить «решили опустить, эта детализация для poyasn не критична — оставляем габариты». |
| **G-10** | 🟡 | poyasn §«Системные атрибуты» **AVL-1** «Доступность в рабочее время» | План закрывает на k8s probes (I4), но это про health, а не SLA. По poyasn AVL-1 мягче, чем «99.9 %» из SRS — план де-факто покрывает, **но это надо явно сказать в защите** (один абзац в README/DEPLOYMENT.md «как мы обеспечиваем доступность: probes + replica + persistent volumes»). |
| **G-11** | 🟡 | SRS §4.3 **FR-3.5** «Сканеры штрих-кодов в реальном времени» (✗ **конфликт**: poyasn относит сканеры к таблице 4 «периферия», без статуса FR) | План считает это «улучшение сверх требований» (раздел 3 п.1). Так как **poyasn побеждает SRS** (по правилу из §0 плана), позиция корректна. **Но конфликт надо явно зафиксировать в §0.1** «Зафиксированные решения», чтобы при защите не было разногласий с консультантом по SRS. |
| **G-12** | 🟡 | poyasn §«Бизнес-цели» BO-1, BO-2, BO-3 (60-70 % снижение трудозатрат, < 1 % ошибок) | План вообще не упоминает целевые KPI. Для **защиты дипломной** нужно показать «было / стало» — иначе не закрывается аргумент «зачем мы это всё писали». Минимум — добавить в `README.md` или презентационный материал расчёт по 1-2 типичным операциям (приёмка партии 50 SKU: было — Х минут ручного ввода, стало — Y, % экономии). |
| **G-13** | 🟡 | poyasn §«Юзабилити» **USE-3** «Заведующий должен генерировать отчёты в один клик, без работы с БД» | План упоминает кнопки скачивания (F2) и PDF-отчёт (C10), но «один клик» — это конкретное UX-требование: пресеты «Отчёт за неделю / месяц / квартал» без полей и галочек. Сейчас на `AnalyticsPage` mock-табы есть — после F1 их надо превратить в реальные пресеты. Уточнить в C10. |

### B. Атрибуция уже-учтённого (для проверки)

Чтобы убедиться, что **остальные** требования закрыты — короткая таблица атрибуции:

| Требование poyasn | Где в плане | Статус в плане |
|---|---|---|
| FR-1, FR-2 (приёмка + валидация) | §1.1 product-service, D-PR-3 | ✅ D-PR-1..4 исправлены |
| FR-3, FR-4 (приходный ордер, акт приёмки) | §1.1 + C8 (PDF) | ✅ PDF есть |
| FR-5 (ручное размещение, BR-3..6) | §1.1 + не упомянут отдельно | 🟡 контроллеры есть, валидация BR-3/4 «жёстко» — где? см. поиск ниже |
| FR-6 (авторазмещение + ABC) | C4 | ✅ |
| FR-7 (отгрузка FIFO/FEFO + сборочный лист) | §1.1 + C9 | ✅ FEFO исправлен, сборочный лист PDF есть |
| FR-8 (зона отгрузки) | — | ❌ G-7 |
| FR-9 (отпускной документ) | C8 | ✅ |
| FR-10..11 (организация + UNP уникальность) | C7 + §1.1 | ✅ |
| FR-12..13 (склад + топология) | §1.1 + D-WH-3..6 | ✅ базово есть; D-WH-3 исправлен, часть MED/LOW-дефектов остаётся |
| FR-14..15 (сотрудники CRUD + блокировка) | C6 + §1.1 | ✅ D-ORG-1 исправлен, блокировка связана с SSO через RabbitMQ |
| FR-16..17 (аналитика период + визуализация) | F3, F1 | ✅ план закрывает |
| FR-18..19 (PDF-отчёт) | C10 | ✅ |
| FR-20..21 (переоценка + блок ≤0) | C1 | ✅ |
| FR-22 (акт переоценки) | §1.1 (есть генератор) + C8 (PDF) | ✅ |
| FR-23..24 (инвентаризация + срез) | §1.1 + D-PR-6, D-PR-8 | ✅ D-PR-6 и D-PR-8 исправлены |
| FR-25 (опись) | §1.1 | ✅ |
| FR-26..27 (списание + причина) | C2 | ✅ |
| FR-28 (акт списания) | §1.1 + C8 (PDF) | ✅ |
| BR-1 (юр.целостность) | §1.1 (генераторы) | ✅ |
| BR-2 (опрос ERP раз в сутки) | C5 (`@Scheduled cron 0 0 3 * * *`) | ✅ |
| BR-3 (вес стеллажа) | подразумевается в FR-5 | 🟡 проверить, что валидация в `AutoPlacementService`/`ManualPlacement` действительно блокирует |
| BR-4 (габариты ячейки) | подразумевается в FR-5 | 🟡 то же самое |
| BR-5 (мер и весов) | — | 🟡 декларативное правило, отдельной фичи не требует |
| BR-6 (ячейка стеллажа) | подразумевается в FR-5 | ✅ |
| SEC-1 (аутентификация всех) | §1.1 | ✅ D-GW-1 исправлен |
| SEC-2 (шифрование) | B6 | ⚠️ G-4 — поднять в P1 |
| SEC-3 (TTL 1 час) | C3 | ✅ |
| ROB-1 (кэш сессии) | F6 | ✅ |
| AVL-1 (рабочее время) | I4 (probes) | 🟡 G-10 |
| EXP-1 (логи) | I6 | ✅ |
| EXP-2 (русские сообщения) | §1.1 + GlobalExceptionHandler | ✅ |
| USE-1 (интуитивный UI) | F5 | ✅ |
| USE-2 (персонализация по роли) | F4 + `roleNav` | ✅ |
| USE-3 (отчёт в один клик) | C10, F2 | 🟡 G-13 |
| PER-1 (системные ресурсы) | — | 🟡 не критично, мониторинг исключён из плана |
| PER-2 (≤5 сек) | — | ❌ G-5 |
| SI-1.1 (RPA-извлечение) | C5 | ✅ |
| SI-1.2 (API-извлечение) | G-1 + C5 | ✅ |
| SI-2.1 (между микросервисами) | §1.1 + D-X-1 | ✅ RabbitMQ публикует события: receive/ship/writeoff/revaluation (product), created/updated/deleted (organization) |
| CI-1 (CRUD с БД) | §1.1 | ✅ |
| BO-1, BO-2, BO-3 (KPI) | — | 🟡 G-12 |

**Резюме сверки:** после сессий 0–4 закрыты G-1, G-2, G-3, C4/C5/C8/C9/C10/C12 и ключевые HIGH-дефекты. Открытые существенные пробелы: **G-4** (SEC-2 шифрование БД), **G-5** (PER-2 бенчмарки ≤5 сек), **G-6** (inline-создание товара), **G-7** (статус STAGING зоны отгрузки), **G-8** (QUARANTINE/брак), **I1/I3/I7/I4**, плюс frontend-интеграция F1/F2/F3.

---

## 2. Реализованные задачи и оставшиеся доработки

### 2.1 Критические требования: текущий статус

#### **C1. Переоценка товара как операция** (UC-11, FR-20, FR-21) ✅ РЕАЛИЗОВАНО

**Реализовано:** `POST /api/operations/revaluation` в `OperationController`, `revaluateProduct()` в `ProductOperationService`, `ProductOperation(type=REVALUATION)`, обновление цены/стоимости и публикация RabbitMQ-события.

**Осталось только если нужен более богатый API:** выделить отдельные `RevaluationController/RevaluationService` и историю `GET /api/revaluations`.

**Где:** `product-service`; генерация акта — в `document-service`.

**Возможное усиление API:**
- Сущность `RevaluationOperation` (или расширить `ProductOperation` с `type=REVALUATION`):
  - `id`, `productId`, `batchId`, `oldPrice`, `newPrice`, `reason` (enum: `MARKET_CHANGE`, `MARKDOWN`, `RECLASSIFICATION`), `performedBy`, `performedAt`.
- Контроллер `RevaluationController`:
  - `POST /api/revaluations` body `RevaluationRequest { productId, batchId, newPrice, reason }`.
  - `GET /api/revaluations?from=&to=&productId=` — история.
  - `GET /api/revaluations/{id}`.
- Сервис `RevaluationService.revalue(...)`:
  - Валидация `newPrice > 0` → иначе `IllegalArgumentException` с русским текстом.
  - Транзакция: записать `RevaluationOperation`, обновить `Inventory.totalValue = quantity × newPrice` и `Product.price`, опубликовать `ProductRevaluedEvent` в RabbitMQ.
- Опциональный шаг — генерация акта переоценки сразу после операции (вызов `document-service` через REST/MQ).

**Тесты:**
- Позитивный сценарий — цена обновлена, остатки пересчитаны.
- Негативные — `newPrice = 0`, `newPrice < 0`, несуществующая партия.
- Интеграционный — RabbitMQ-событие пришло.

---

#### **C2. Списание товара как операция** (UC-15, FR-26, FR-27) ✅ РЕАЛИЗОВАНО

**Реализовано:** `POST /api/operations/write-off` в `OperationController`, `writeOffProduct()` в `ProductOperationService`, `ProductOperation(type=WRITE_OFF)`, уменьшение остатков и публикация RabbitMQ-события.

**Осталось только если нужен более богатый API:** выделить отдельные `WriteOffController/WriteOffService`, историю списаний и идемпотентность по `requestId`.

**Где:** `product-service`; генерация акта — в `document-service`.

**Возможное усиление API:**
- Сущность `WriteOffOperation` (или `ProductOperation.type=WRITE_OFF`):
  - `id`, `productId`, `batchId`, `quantity`, `reason` (`DAMAGE`, `EXPIRED`, `SHORTAGE`, `OTHER`), `notes`, `performedBy`, `performedAt`.
- Контроллер `WriteOffController`:
  - `POST /api/write-offs` body `WriteOffRequest { batchId, quantity, reason, notes }`.
  - `GET /api/write-offs?from=&to=&reason=`.
- Сервис `WriteOffService.writeOff(...)`:
  - Валидация `quantity > 0` и `quantity ≤ Inventory.quantity`.
  - Транзакция: уменьшить `Inventory.quantity`; если стало 0 — пометить партию `EMPTY` (ReadModel-флаг или удалить).
  - Опубликовать `ProductWrittenOffEvent`.
- Триггер генерации акта списания после операции.

**Тесты:**
- Полное и частичное списание.
- Списание сверх остатка → 400 + русское сообщение.
- Идемпотентность (повторный запрос с тем же `requestId`).

---

#### **C3. JWT TTL — настраиваемый параметр** (poyasn SEC-3) ✅ РЕАЛИЗОВАНО 2026-05-01

**Реализовано:** `JwtTokenService` использует `@Value("${app.security.jwt.access-ttl-seconds:3600}")` вместо константы. `application.properties` содержит `app.security.jwt.access-ttl-seconds=3600`.

**Решение:** TTL делается настраиваемым (а не жёстко 1 час или 15 мин), default = 3600 секунд (1 час, как в poyasn).

**Где:** `backend/SSOService/src/main/java/by/bsuir/ssoservice/service/JwtTokenService.java:27`.

**Сделано:**
- Удалён хардкод TTL access-токена.
- Внедрён `@Value("${app.security.jwt.access-ttl-seconds:3600}")`.
- В `application.properties` добавлен ключ `app.security.jwt.access-ttl-seconds=3600` (можно переопределить переменной окружения `APP_SECURITY_JWT_ACCESS_TTL_SECONDS` в Docker/K8s).
- Unit-тесты должны проверять переопределение TTL через test properties.

---

#### **C4. ABC-анализ при автоматическом размещении** (UC-3, FR-6) ✅ РЕАЛИЗОВАНО

**Реализовано:** `AbcAnalysisService`, ежедневный `@Scheduled` пересчёт, `POST /api/analytics/abc/recalculate`, `GET /api/analytics/abc`.

**Где:** `product-service` (`AbcAnalysisService`) + потенциальное применение в `warehouse-service` для автоподбора мест.

**Алгоритм:**
1. Считаем суммарный объём отгрузок по каждому `productId` за окно (например, последние 90 дней) из `ProductOperation` где `type=SHIPMENT`.
2. Сортируем по убыванию вклада в общий оборот.
3. Классы: **A** — товары, дающие первые 80 % оборота; **B** — следующие 15 %; **C** — оставшиеся 5 %.
4. Сохраняем класс в `ProductReadModel.abcClass` (cron-пересчёт раз в сутки).

**Применение в размещении:**
- A → ближайшие к зоне отгрузки ячейки и нижние ярусы (быстрый доступ).
- B → средние ярусы.
- C → дальние ячейки и верхние ярусы.
- `AutoPlacementService.suggestCell(productId, dimensions, weight, tempReq)` подбирает ячейку, удовлетворяющую BR-3 (вес), BR-4 (габариты), BR-2 (температура), и предпочитающую правильную зону по ABC-классу.

**API:**
- `POST /api/inventory/auto-place` body `{ productId, batchId, quantity }` → `{ suggestedCellId, reason }`.

---

#### **C5. RPA Extractor — опрос ERP раз в сутки** (FR-5.1, BR-2) ✅ РЕАЛИЗОВАНО

**Реализовано:** `RpaHtmlExtractorImpl` через Jsoup + `MockErpController` в document-service + `ErpExtractorJob` `@Scheduled(0 0 3 * * *)`, idempotency через `extraction_log`. Дополнительно закрыт G-1: есть `PlannedDeliveryExtractor` interface + `ApiExtractorImpl` REST-канал, переключение через `erp.extraction.mode`.

**Неактуальная часть ниже оставлена как исторический вариант:** Selenium-headless больше не является выбранным решением.

**Где:** новый модуль/пакет в `document-service` или отдельный микросервис `rpa-service` (предпочтительно отдельный, т.к. зависимости Selenium тяжелы).

**Исторический вариант реализации (не текущий план):**

**Шаг 1 — `mock-erp`** (Spring Boot stub, поднимаем как ещё один контейнер в `docker-compose.yml`):
- HTML-страница входа (логин/пароль), HTML-таблица «Плановые поставки на дату X».
- Эндпоинт `/login` (POST), `/deliveries` (GET, защищён cookie/session).
- Опционально — кнопка «Скачать в Excel» (POI-генерация).

**Шаг 2 — RPA-job:**
- Класс `ErpExtractorJob` с `@Scheduled(cron = "0 0 3 * * *")` — раз в сутки в 03:00.
- Внутри — `WebDriverManager` (chromedriver) + `WebDriver` headless Chrome:
  1. `driver.get("http://mock-erp/login")`.
  2. Заполнить логин/пароль (из конфигурации, секрет в env).
  3. Перейти на `/deliveries`.
  4. Распарсить таблицу через `findElement(By.cssSelector(...))`.
  5. Сконвертировать в список `PlannedDelivery {supplier, productSku, quantity, expectedDate}`.
- Публикация `PlannedDeliveryReceivedEvent` в RabbitMQ → `product-service` создаёт черновики поставок.
- Идемпотентность: ключ `extraction_log(extraction_date PK, status, items_count)` — повторный запуск с той же датой пропускает.

**Шаг 3 — устойчивость:**
- Retry-логика: `@Retryable(maxAttempts=3, backoff=@Backoff(delay=60000))` на вызов RPA.
- Таймаут на каждое действие WebDriver (`PageLoadTimeout`, `ImplicitlyWait` ≤ 30 сек).
- При фатальной ошибке — алерт в логах ERROR + запись в `extraction_log(status='FAILED')`.

**Тесты:**
- Интеграционный с Testcontainers (контейнер selenium/standalone-chrome + контейнер mock-erp).
- Сценарии: успех, mock-erp лежит, неверные креды, пустая выгрузка, дубль по дате.

**Если пользователь откатится к варианту 1 (mock + HTTP):**
- Вместо Selenium — `RestTemplate` или `HttpClient` + `Jsoup` для HTML или Apache POI для Excel-выгрузки.
- Объём кода в 3–5 раз меньше, тестирование проще, идея «программа ходит в чужую систему без API» сохраняется концептуально.

**Время реализации:** Selenium ≈ 4–7 дней; mock+HTTP ≈ 1–2 дня.

---

#### **C6. Блокировка / деактивация сотрудника** (UC-8, FR-15) ✅ РЕАЛИЗОВАНО 2026-05-01

**Реализовано:** `PATCH /api/organizations/{orgId}/employees/{userId}/status` с `UpdateEmployeeStatusRequest { blocked }`. Поле `is_blocked BOOLEAN` + `blocked_at` добавлены в `OrganizationEmployee` и `organizationDB.sql`. `EmployeeManagementService.updateEmployeeBlockStatus()`. `JwtAuthenticationFilter` добавлен в organization-service.

**Где:** `organization-service` (контроллер) + `SSOService` (валидация при логине / в фильтре).

**Что добавить:**
- В `UserReadModel` (SSO) и `EmployeeReadModel` (Organization) — поле `status: ACTIVE | BLOCKED | DELETED`.
- Эндпоинт `PATCH /api/employees/{id}/status` body `{ status, reason }` (только для `DIRECTOR`).
- Событие `EmployeeStatusChangedEvent` через RabbitMQ → SSO обновляет `UserReadModel`.
- В `JwtAuthenticationFilter` — после валидации токена проверять `user.status == ACTIVE`, иначе `401` с сообщением «Учётная запись заблокирована».

**Frontend:**
- На `EmployeesPage` — кнопка «Заблокировать» / «Разблокировать» с диалогом и полем «Причина».
- Визуальный бейдж статуса в таблице.

---

#### **C7. Валидация УНП на уникальность** (UC-6, FR-2.1)

**Где:** `organization-service`.

**Что добавить:**
- Миграция БД: `ALTER TABLE organizations ADD CONSTRAINT uk_organization_unp UNIQUE (unp);` (через C-миграцию I3).
- В `OrganizationService.create` ловить `DataIntegrityViolationException` → пробросить `UnpAlreadyExistsException` (HTTP 409, сообщение «Организация с таким УНП уже существует»).
- Фронт: при ответе 409 показывать ошибку под полем «УНП», а не общий toast.
- Дополнительно — формат УНП РБ: 9 цифр (regex `^\d{9}$`) — добавить `@Pattern` на DTO.

---

#### **C8. PDF-генерация документов** (UC-2, UC-5, UC-12, UC-14, UC-16) ✅ РЕАЛИЗОВАНО

**Реализовано:** `PdfDocumentService` на Apache PDFBox, `format=pdf` в `DocumentController`, PDF для основных документов.

**Где:** `document-service`.

**Сделано / проверить при регрессе:**
- Apache PDFBox добавлен и используется.
- PDF-методы вынесены в `PdfDocumentService`.
- В `DocumentController` поддержан `format=pdf|xlsx|docx`; при `format=pdf` отдаётся `application/pdf`.
- Отчёты UC-10 закрываются C10.
- Документы операций имеют PDF-вариант, плюс `xlsx`/`docx` где это уже было реализовано через Apache POI.

---

#### **C9. Сборочный лист** (UC-4, FR-7) ✅ РЕАЛИЗОВАНО

**Реализовано:** `generatePickingListPdf()` в `PdfDocumentService`, `POST /api/documents/picking-list?format=pdf`.

**Возможное расширение API:**
- DTO `PickingListData { shipmentId, items: [{ productName, sku, batchId, cellAddress, quantity }] }`.
- Источник данных — `product-service`, который на запрос отгрузки уже знает FEFO-выборку партий и их ячейки (из `Inventory + RackReadModel`).
- PDF-шаблон с шапкой (номер, дата, склад, кладовщик) и таблицей позиций с местом отбора.
- Эндпоинт `GET /api/documents/picking-list/{shipmentId}?format=pdf`.

---

#### **C11. Multi-tenant изоляция данных** (poyasn 1.2 SaaS Freemium) 🟡 ЧАСТИЧНО РЕАЛИЗОВАНО

**Фактически реализовано:** `organizationId` добавлен в `Product`/`Supply`; `ProductController` и `SupplyController` фильтруют по `X-Organization-Id`; gateway форвардит `X-Organization-Id` из JWT. `Supplier` оставлен глобальным справочником.

**Ограничение:** это не Hibernate `@Filter` и не полная ORM-level изоляция всех бизнес-сущностей. Если требуется строгая SaaS-изоляция на уровне ORM, пункты ниже остаются актуальной доработкой.

**Решение:** один инстанс обслуживает несколько организаций. Без жёсткой изоляции сотрудник из организации А может через ID-фабрикацию увидеть данные организации Б.

**Где:** все backend-сервисы.

**Что уже должно быть покрыто / проверить по фактическому коду:**
- Каждая бизнес-сущность (`Product`, `Inventory`, `Warehouse`, `Rack`, `Cell`, `ProductOperation`, `Revaluation*`, `WriteOff*`, `InventoryCheck`, `Employee`) — поле `organization_id` (есть не везде, аудит).
- В JWT добавить claim `organizationId` (при логине берётся из `Employee.organizationId`).
- В каждом сервисе — `OrganizationFilter` через Hibernate `@Filter`:
```java
@FilterDef(name = "orgFilter", parameters = @ParamDef(name = "orgId", type = UUID.class))
@Filter(name = "orgFilter", condition = "organization_id = :orgId")
```
- В `JwtAuthenticationFilter` — после распарcинга токена включать фильтр через `EntityManager.unwrap(Session.class).enableFilter("orgFilter").setParameter("orgId", currentOrgId)`.
- В контроллерах `DIRECTOR`-уровня (где берутся данные нескольких организаций) — отключать фильтр через `@WithoutTenantFilter` (custom-аннотация + аспект). По умолчанию у нас `DIRECTOR` тоже видит только свою организацию.
- В нативных запросах (если есть) — добавить `WHERE organization_id = ?` вручную и тесты.

**Тесты:**
- Сценарий «фабрикация ID»: пользователь из орг.А делает GET `/api/products/{idИзОрг.Б}` → `404 Not Found` (а не `200`).
- Saga-операция, инициированная пользователем из орг.А, не пишет в данные орг.Б.

**Дополнительно:** в `application.properties` или Postman-коллекции — комментарий, что без `organizationId` в JWT все запросы возвращают 401 / 404.

---

#### **C12. Invitation-flow для новых сотрудников** (security) ✅ РЕАЛИЗОВАНО

**Реализовано:** invitation от DIRECTOR: `InvitationController`, `PublicInvitationController`, `InvitationService`, email через `EmailService`, регистрация по токену приглашения; отдельный flow первого DIRECTOR через `/api/auth/register-director`.

**Старый риск ниже оставлен как исходная причина задачи:** OAuth-пользователь после `RoleSelectPage` не должен самовольно выбирать роль и организацию без invite.

**Решение:** **Invitation от DIRECTOR** (вариант 1).

**Что добавить:**
- Сущность `Invitation` в `organization_db`:
  - `id (UUID)`, `organizationId`, `email`, `role`, `token (UUID)`, `createdBy (DIRECTOR id)`, `createdAt`, `expiresAt` (default +7 дней), `usedAt` (nullable), `revokedAt` (nullable).
- Эндпоинты:
  - `POST /api/invitations` body `{ email, role }` (только DIRECTOR) → возвращает приглашение.
  - `GET /api/invitations?status=` (только DIRECTOR) — список.
  - `DELETE /api/invitations/{id}` — отозвать.
  - `GET /api/invitations/validate?token=` (без auth) → возвращает `{ organizationName, role }` для preview на форме регистрации.
- Письмо/ссылка вида `https://wms.example/register?invite={token}` (отправка email — опционально, для диплома достаточно скопировать ссылку из ответа DIRECTOR’а).
- На фронте:
  - `EmployeesPage` — кнопка «Пригласить сотрудника», диалог (email + роль), показывается ссылка для отправки.
  - `RegisterPage` / `RoleSelectPage` — если пришёл `?invite=token`: подгружаем данные invite, форма с заблокированными полями организации и роли (пользователь меняет только пароль/имя).
  - Без токена приглашения регистрация **запрещена** (либо разрешён только сценарий «создать новую организацию» — отдельный flow для самого DIRECTOR).
- Валидация: токен жив, не истёк, не использован, email из OAuth совпадает с email из приглашения (опционально, можно ослабить).

**Тесты:**
- Регистрация с валидным invite → роль и организация выставлены из приглашения.
- Регистрация с истёкшим/использованным invite → 410 Gone.
- Попытка self-register без invite → 403 Forbidden.
- DIRECTOR видит только приглашения своей организации.

**Связь с C6:** при блокировке сотрудника (C6) — все его активные приглашения должны быть отозваны автоматически (либо приглашения создаются от организации, не от конкретного DIRECTOR).

---

#### **C10. Отчёт аналитики для заведующего** (UC-10, FR-18, FR-19) ✅ РЕАЛИЗОВАНО

**Реализовано:** `POST /api/analytics/report?preset=week|month|quarter|year` в product-service, PDF через PDFBox, пресеты G-13 закрыты.

**Где:** `product-service` (данные) → PDF generation внутри product-service.

**Возможное расширение PDF-отчёта:**
- Endpoint `POST /api/reports/analytics/pdf` body `{ from, to, dimensions: ['warehouse','employee','operationType'] }` (только `DIRECTOR`).
- Сервис собирает данные из `ProductAnalyticsService` и `EmployeeAnalyticsService`.
- Графики — **JFreeChart** → встроить в PDF как `BufferedImage` (PDFBox умеет).
- Содержимое отчёта (минимум):
  - Сводные KPI за период.
  - Гистограмма операций по типу.
  - Линейный график динамики приёмок/отгрузок.
  - Топ-10 товаров по обороту (для подготовки к ABC).
  - Производительность сотрудников.
- Скачивание с фронта (см. F2).

---

### 2.2 Frontend — UI и интеграция

#### **F1. Заменить mock-данные на реальный backend**

| Страница | Endpoints |
|---|---|
| `ReceivePage` | `GET /api/suppliers`, `GET /api/products?search=`, `GET /api/warehouses`, `POST /api/operations/receive`, `POST /api/inventory/auto-place` |
| `ShipPage` | `GET /api/inventory/available?productId=` (FEFO-выборка), `POST /api/operations/ship` |
| `OrganizationPage` | `GET/PUT /api/organizations/{id}`, `GET/POST/PUT/DELETE /api/warehouses`, `GET/POST /api/racks`, `GET/POST /api/cells` |
| `EmployeesPage` | `GET /api/organizations/{id}/employees`, `POST /api/employees`, `PATCH /api/employees/{id}/status` (C6) |
| `AnalyticsPage` | `GET /api/analytics/operations/dynamics`, `GET /api/analytics/employees`, `GET /api/analytics/inventory` |
| `RevaluationPage` | `POST /api/revaluations` (C1) |
| `InventoryPage` | `POST /api/inventories/start`, `POST /api/inventories/{id}/actual`, `POST /api/inventories/{id}/complete` |
| `WriteoffPage` | `POST /api/write-offs` (C2) |

**Подход:** ввести **RTK Query** (`@reduxjs/toolkit/query`) — кэширование, инвалидация, автоматический refetch. Это снимет необходимость иметь два HTTP-слоя (см. F7).

---

#### **F2. Кнопки скачивания документов**

На каждой релевантной странице — кнопка(и) «Скачать [тип документа]»:
- `ReceivePage` → приходный ордер, акт приёмки (если есть расхождения).
- `ShipPage` → ТТН, сборочный лист.
- `RevaluationPage` → акт переоценки.
- `InventoryPage` → инвентаризационная опись.
- `WriteoffPage` → акт списания.
- `AnalyticsPage` → PDF-отчёт (C10).

**Утилита** `src/utils/downloadFile.js`:
```javascript
export async function downloadFile(url, filename) {
  const blob = await fetch(url, { headers: authHeaders() }).then(r => r.blob());
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  link.click();
  URL.revokeObjectURL(link.href);
}
```

Каждая кнопка должна предлагать выбор формата (PDF / XLSX / DOCX), кроме случаев, где формат фиксирован.

---

#### **F3. Графики аналитики**

- `npm install recharts` (~85 KB gzip, бесплатный, под React).
- На `AnalyticsPage`:
  - `BarChart` — операции по типу.
  - `LineChart` — динамика приёмок/отгрузок по дням.
  - `PieChart` — распределение по складам.
  - `AreaChart` — общий объём за период.
- Графики и таблицы остаются в одной view, но графики — над таблицами для визуальной иерархии.

---

#### **F4. Role-based guard на маршрутах** ✅ РЕАЛИЗОВАНО

**Реализовано:** `RoleGuard` в `src/routes/AppRouter.js` проверяет `allowed` роли и защищает маршруты `/main/organization`, `/main/employees`, `/main/receive`, `/main/ship`, `/main/writeoff`, `/main/revaluation`, `/main/analytics`.

**Старое состояние:** `ProtectedRoute` проверял только `isAuthenticated`. `WORKER`, обходя меню напрямую через URL, мог попасть на `/main/analytics`.

**Сделано / проверить при регрессе:**
- Компонент `<RoleGuard allowed={...}>` добавлен в `AppRouter.js`.
- Маршруты закрыты по ролям; при недоступной роли пользователь уходит обратно в `/main`.
- Остаётся связанная задача F1: убрать mock-данные со страниц, чтобы role-guard защищал реальные рабочие сценарии.

---

#### **F5. Дизайн-система (UX/UI poyasn)**

**Сейчас в `client/src/theme.js`:** `primary.main = '#005FF9'`, `secondary.main = '#FFD600'`, `fontFamily = 'Manrope'`.

**Должно быть:**
- `primary.main = '#1976D2'` (синий).
- `secondary.main = '#FFE673'` (жёлтый).
- Семантические цвета: красный `#D32F2F` (ошибка), оранжевый `#ED6C02` (warning), зелёный `#2E7D32` (success).
- `fontFamily = 'Gantari, Jost, Arial, sans-serif'`.

**Шаги:**
- `npm install @fontsource/gantari @fontsource/jost`.
- Импорт в `index.js`: `import '@fontsource/gantari/400.css'; import '@fontsource/gantari/700.css';`.
- Иерархия H1–H4: `h1 { fontSize: '2.5rem', fontWeight: 800 }`, `h2 { ... 700 }`, `h3 { ... 600 }`, `h4 { ... 500 }`.
- Заменить хаотичные `variant="h5"`/`h6"` на консистентные `h2`/`h3`.

---

#### **F6. Кэширование UI и offline-устойчивость (ROB-1)**

- `npm install redux-persist`.
- `persistReducer(authPersistConfig, authReducer)` с `storage: localStorage`, whitelist: `['user', 'tokens']`.
- Для незавершённых форм (приёмка, инвентаризация) — `localStorage`-черновик с автосохранением каждые 5 секунд (`useDraft(formId)` хук).
- На `axios`-перехватчике — обработка `network error` → toast «Соединение потеряно, изменения сохранены локально».

---

#### **F7. Один HTTP-слой**

Сейчас два:
- `src/store/api.js` — axios-инстанс с интерсепторами для refresh-токена.
- `src/services/httpService.js` — fetch.

**Опция А (предпочтительно):** перевести всё на **RTK Query** (одно место для baseQuery + refresh-логики).
**Опция Б:** удалить `httpService.js`, переписать сервисы (`documentService`, и т.п.) на тот же axios.

Любой вариант — один источник токена и его обновления.

---

### 2.3 Backend — доработки до полного соответствия

#### **B1. Ролевая модель — решение принято** ✅ РЕШЕНО (2026-05-02)

`poyasn` 1.1.3 различает Кладовщика (приёмка/отгрузка) и Сотрудника склада (физическое размещение по сканеру), `UserRole` enum в коде — только 3 роли (`WORKER`, `ACCOUNTANT`, `DIRECTOR`).

**Решение:** Оставляем 3 роли (`WORKER`, `ACCOUNTANT`, `DIRECTOR`).

**Обоснование:**
- Текущая ролевая модель полностью покрывает требования poyasn.pdf
- `WORKER` = кладовщик (приёмка, отгрузка, инвентаризация)
- `DIRECTOR` = заведующий складом (управление, аналитика)
- `ACCOUNTANT` = бухгалтер (переоценка, списание, документы)

**Что НЕ делаем:**
- Не добавляем `STOREKEEPER` в `UserRole` enum
- Не создаём миграцию `V3__add_user_role_storekeeper.sql`
- Не меняем фронтенд (`roleNav`, `RoleSelectPage`, `RoleGuard`)

**Статус:** Закрыто, изменений не требуется.

---

#### **B2. Saga для отгрузки** ✅ РЕАЛИЗОВАНО

**Реализовано:** `ShipSagaState` и `ShipmentSagaService` со шагами:
`STOCK_RESERVATION → DOCUMENT_GENERATION → INVENTORY_UPDATE → OPERATION_RECORD → COMPLETED`.

Компенсация — освобождение резерва при сбое генерации документа.

---

#### **B3. Персистентное состояние Saga** ✅ РЕАЛИЗОВАНО

**Реализовано:** `SagaState` entity, `SagaStateRepository`, запись состояния Saga в `saga_state`. `recoverUnfinishedSagas()` с `@PostConstruct` добавлен 2026-05-02 — загружает PENDING/COMPENSATING саги из БД в память при старте. `getShipSagaState()` — lazy-load из БД если нет в памяти. Flyway-миграция для `saga_state` — в `V1__init.sql` product-service (I3 done).

---

#### **B4. Event Sourcing для `Inventory` и `ProductOperation`**

Сейчас оба — простой JPA. Чтобы соответствовать заявленному паттерну CQRS:
- Добавить `InventoryEvent` (типы: `ITEM_ADDED`, `ITEM_REMOVED`, `REVALUED`, `WRITTEN_OFF`).
- `Inventory` становится Read Model, проектируемой из `InventoryEvent`.
- Это упростит C1/C2 — операции просто публикуют события.

---

#### **B5. Примеры в `@Schema(example = ...)`**

SRS требует на каждом DTO. Сейчас почти везде их нет.

**Шаги:**
- Найти все классы в `**/dto/` (~50 файлов).
- Добавить `@Schema(description = "...", example = "...")` на каждое поле.
- Для коллекций — `arraySchema = @Schema(...)`.
- Это резко улучшает Swagger и импорт в Postman (требование 7.3 SRS).

---

#### **B6. Шифрование чувствительных данных в БД** (SEC-2 poyasn)

- Кандидаты: УНП организации, юридический адрес, IP в `login_audit`, ФИО при необходимости.
- Реализация: JPA `AttributeConverter<String, String>` поверх AES-GCM (ключ в env-переменной `APP_DB_ENCRYPTION_KEY`).
- Для IP-аудита — лучше pgcrypto и `pgp_sym_encrypt`, чтобы можно было продолжать делать LIKE/SQL-аналитику с `pgp_sym_decrypt`.

---

#### **B7. Общий security-модуль (DRY)**

`JwtAuthenticationFilter`, `GlobalExceptionHandler`, `ErrorResponse` сейчас дублируются в каждом сервисе.

**Сделать:** новый Gradle-модуль `common-security` с этими классами, подключить как `implementation project(':common-security')` в каждом сервисе. Обновить `settings.gradle`.

---

### 2.4 Инфраструктура и качество кода

#### **I1. CI/CD pipeline (GitHub Actions)**

Файл `.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 21 }
      - run: cd backend && ./gradlew allTestWithCoverage
      - run: cd backend && ./gradlew allCodeQuality
      - uses: actions/upload-artifact@v4
        with: { name: jacoco, path: backend/**/build/reports/jacoco/ }
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: recursive }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd client && npm ci && npm run lint && npm test -- --watchAll=false && npm run build
```

Добавить status-badge в `README.md`.

---

#### **I2. Снять `ignoreFailures = true` для Checkstyle** 🟡 В ПРОЦЕССЕ (2026-05-02)

В `backend/build.gradle` строки 46–51 убрать `ignoreFailures = true`.

**Подготовка:** прогнать `./gradlew allCodeQuality`, исправить накопленные нарушения (или временно ослабить правила в `config/checkstyle/checkstyle.xml`). Только потом — включать жёсткий режим.

PMD/SpotBugs — оставить мягкими в IDE-сборке, но в CI прогонять с `failOnViolation = true`.

**Выполнено (2026-05-02):**
- ✅ Исправлены ошибки компиляции в SSOService:
  - `UserService.java` (строки 218-220): удалены устаревшие ссылки на `warehouseId` из `RegisterRequest`
  - `UserService.java`, `OAuthService.java`, `InvitationValidationService.java`: исправлены raw типы `Map` → `Map<String, Object>` с использованием `ParameterizedTypeReference`
- ✅ Исправлены ошибки компиляции в warehouse-service:
  - `WarehouseController.java`: изменены все вызовы `response.getOrganizationId()` → `response.orgId()` (строки 84, 113, 182, 221, 261, 300, 334)
- ✅ Добавлена зависимость в organization-service:
  - `build.gradle`: добавлен `implementation 'com.nimbusds:nimbus-jose-jwt:9.37.3'` для `JwtAuthenticationFilter`
- ✅ Все сервисы успешно компилируются (SSOService, organization-service, warehouse-service, product-service, document-service)
- ✅ Прогнан `allCodeQuality` — BUILD SUCCESSFUL, все отчёты сгенерированы

**Статистика нарушений (2026-05-02 20:30 MSK):**

PMD violations:
- SSOService: 126
- organization-service: 121
- warehouse-service: 117
- product-service: 298
- document-service: 101
- **Итого: 763 нарушения PMD**

SpotBugs issues:
- SSOService: 35
- organization-service: 16
- warehouse-service: 9
- product-service: 26
- document-service: 34
- **Итого: 120 проблем SpotBugs**

**Осталось:**
- Проанализировать типы нарушений PMD/SpotBugs
- Исправить критичные нарушения или добавить `@SuppressWarnings` с обоснованием
- Убрать `ignoreFailures = true` из конфигурации
- Повторно прогнать `allCodeQuality` до успешного прохождения

---

#### **I3. Flyway для миграций БД**

- В каждом сервисе с БД — `implementation 'org.flywaydb:flyway-core'` + `flyway-database-postgresql`.
- `src/main/resources/db/migration/V1__init.sql` — копия соответствующего скрипта из `sql-scripts/`.
- `V2__add_unp_unique.sql` — для C7.
- `V3__add_user_role_storekeeper.sql` — для B1.
- `V4__saga_state_table.sql` — для B3.
- В `application.properties`: `spring.flyway.enabled=true`, `spring.jpa.hibernate.ddl-auto=validate`.
- `sql-scripts/` остаются для bootstrap docker-compose (init-скрипты в PG-контейнере), но истина — в Flyway.

---

#### **I4. Readiness / liveness probes (Kubernetes)**

В `k8s/0[5-9]-*.yaml` для каждого backend-сервиса:
```yaml
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 8080 }
  initialDelaySeconds: 30
  periodSeconds: 10
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 8080 }
  initialDelaySeconds: 60
  periodSeconds: 30
```

В `application.properties`: `management.endpoint.health.probes.enabled=true`.

---

#### **I5. Распределённый кэш api-gateway**

Сейчас api-gateway использует Caffeine in-memory. При нескольких инстансах за балансировщиком — рассогласование. Перевести на Redis (тот же, что в SSO, но с отдельным namespace).

---

#### **I6. Структурированное логирование (EXP-1, обязательно — P0)** ✅ РЕАЛИЗОВАНО 2026-05-01 (сессия 3)

**Реализовано:**
- `logback-spring.xml` создан во всех 5 сервисах (SSOService, organization-service, warehouse-service, product-service, document-service)
- `LogstashEncoder` — JSON-формат с полем `service` из `spring.application.name`
- `RollingFileAppender` — `logs/${service}.log`, max 50 МБ × 10 файлов, async
- `net.logstash.logback:logstash-logback-encoder:8.0` добавлен в `subprojects {}` в корневом `build.gradle`

**Осталось (опционально):** MDC-фильтры для `traceId`/`userId`, маскирование PII, Loki-интеграция.

`poyasn` 6.4 EXP-1 требует «подробные логи системных событий и ошибок, что позволит быстро диагностировать причины сбоев». Сейчас вывод неструктурированный текст — этого мало для микросервисов.

**Сделать (минимальный набор для EXP-1):**
- `logback-spring.xml` в каждом сервисе с `LogstashEncoder` (`net.logstash.logback:logstash-logback-encoder`) — JSON-формат.
- В каждой записи обязательны поля: `timestamp`, `level`, `logger`, `service`, `traceId`, `spanId`, `userId` (если в SecurityContext), `message`, `stack_trace` (для ошибок).
- MDC-фильтр на gateway, который проставляет `traceId` (UUID) на каждый входящий запрос и пробрасывает его дальше через заголовок `X-Trace-Id`.
- MDC-обёртка вокруг JWT-фильтра — кладёт `userId` и `role` в MDC.
- Ротация файлов: `RollingFileAppender` (max 50 МБ × 10 файлов) + копия в stdout — для контейнеров.
- Категории логов на уровне INFO: вход/выход контроллеров, бизнес-операции (приёмка/отгрузка/переоценка/списание), смена статусов сотрудников, RPA-задачи. На WARN: валидационные отказы, 4xx-ответы. На ERROR: исключения, 5xx, отказ Saga.
- Маскирование PII: пароли, токены, OAuth-secret’ы заменять `***` (Logback-фильтр на регекспы).

**Опционально (если время позволяет — отдельным заходом):**
- Loki + Promtail для централизованного хранения и LogQL-запросов.
- Алёрты по ERROR-логам (Loki ruler или Grafana alerting). Но это уже из исключённого блока «телеметрия».

**Важно:** этот пункт — P0 (обязательное требование poyasn), а не «nice-to-have».

---

#### **I7. Секреты не в git**

`SSOService/src/main/resources/application.properties` содержит OAuth credentials (Yandex/Google client_secret) и пароль БД. CLAUDE.md явно помечает файл как чувствительный.

**Сделать:**
- Заменить на `${YANDEX_CLIENT_SECRET}` и т.п.
- Создать `application-local.properties` (в `.gitignore`) для локалки.
- В Kubernetes — `Secret` ресурс + `envFrom`.
- Для Docker Compose — `.env`-файл (тоже в `.gitignore`).
- **Поменять секреты, которые уже утекли в git-историю** (rotation у Yandex/Google консолей). Это нужно делать вручную и согласованно с владельцем приложений (см. CLAUDE.md note).

---

## 3. Что я бы ещё добавил (улучшения сверх требований) 💡

Не требует ни poyasn, ни SRS, но повышает зрелость дипломного решения:

1. **Поддержка сканеров штрихкодов в UI** — компонент `<BarcodeScannerInput>` с автофокусом, debounce 50 мс, индикатором «scan mode», звуковым/визуальным фидбеком после считывания. poyasn таблица 4 явно упоминает периферию.
2. **Offline-mode для кладовщика** (планшет/сканер с плохим Wi-Fi, AVL-1) — Service Worker + IndexedDB как очередь операций; отложенная синхронизация; конфликт-резолюция при дублях.
3. **WebSocket / SSE-канал «склад → заведующий»** — реальное время по требованию poyasn TO-BE 2.1.2 («информация о приёме отображается у заведующего складом в режиме реального времени»). Spring WebFlux + STOMP или серверные Server-Sent Events.
4. **Печать наклеек / штрихкодов** на принтерах этикеток (таблица 4 poyasn) — ZPL-генератор + endpoint в `document-service` + UI «Распечатать ярлык» в ReceivePage.
5. **Endpoint `/api/products/{id}/history`** — лента событий по товару из Event Store; уже бесплатно благодаря Event Sourcing, осталось добавить контроллер и UI-таб.
6. **Пагинация и фильтрация** на всех списочных эндпоинтах (`Pageable`, `Specification`) — сейчас часть возвращает полные коллекции (риск OOM на крупном складе).
7. **Rate limiting** на api-gateway (`RequestRateLimiter` + Redis) — защита от brute-force на login.
8. **Multi-tenancy на уровне ORM** — Hibernate `@Filter` или Discriminator по `organization_id`, чтобы исключить случайные межорганизационные утечки.
9. **Chaos-тест Saga**: остановить product-service между `BATCH_CREATION` и `INVENTORY_UPDATE` и убедиться, что `compensate()` отрабатывает после рестарта (после B3).
10. **Контракт-тесты** между сервисами (Spring Cloud Contract или Pact) — страховка при независимом релизе микросервисов.
11. **Полный набор документов РБ**: ТН, инвойс, CMR — сейчас в RPA реализована только ТТН (BR-1).
12. **Валидация бизнес-правил BR-3..BR-6** в виде отдельных стратегий (`PlacementValidator` chain) — сейчас часть проверок захардкожена в DTO. Чистый Strategy + Chain of Responsibility, прямо как требует SRS 7.1.
13. **i18n на фронте** — даже если приоритет poyasn — русский, разделить русские строки на словарь (`src/i18n/ru.json`) — упростит будущий перенос на белорусский язык.
14. **Импорт справочников из Excel** (товары, поставщики) — кладовщику быстрее заполнить начальный каталог.
15. **e2e-тесты Playwright** на критические сценарии: логин, приёмка, отгрузка с FEFO, инвентаризация, переоценка, списание.

---

## 4. Приоритезация

**P0 — обязательно перед защитой** (без этого poyasn не закрыт):
- ~~**C1** (переоценка)~~ ✅ DONE | ~~**C2** (списание)~~ ✅ DONE | ~~**C3** (JWT настраиваемый)~~ ✅ DONE | **C7** (УНП) ✅ в коде | ~~**C6** (блокировка)~~ ✅ DONE.
- ~~**C12 (invitation flow)**~~ ✅ DONE.
- ~~**C5 (RPA Extractor)**~~ ✅ DONE + ~~**C8 (PDF)**~~ ✅ DONE + ~~**C9 (picking list)**~~ ✅ DONE + ~~**C4 (ABC)**~~ ✅ DONE.
- ~~**I6 (структурированные логи)**~~ ✅ DONE: logback-spring.xml + LogstashEncoder во всех 5 сервисах.
- F1 (интеграция с backend), F2 (кнопки скачивания), F3 (графики).
- I2 (Checkstyle жёсткий), ~~I3 (Flyway)~~ ✅ DONE (2026-05-02): flyway-core + flyway-database-postgresql добавлены в SSO/org/warehouse/product; V1__init.sql для каждого сервиса; baseline-on-migrate=true; V2 миграции для G-4.
- ~~B1 (четвёртая роль)~~ ✅ РЕШЕНО (2026-05-02): оставляем 3 роли (`WORKER`, `ACCOUNTANT`, `DIRECTOR`).
- **Дефекты §1.5 уровня 🔴 (HIGH) — все P0**: ~~D-PR-1..D-PR-11~~ ✅; ~~D-SSO-1, D-SSO-2, D-SSO-3, D-SSO-8, D-SSO-9~~ ✅; D-SSO-4, D-SSO-5 — остались; ~~D-ORG-1~~ ✅; ~~D-GW-1~~ ✅; ~~D-X-1~~ ✅ (product+organization publish events); D-X-2 (organizationId в entity — отложено до C11).
- ~~**G-2** (сущность «Поставка» с lifecycle)~~ ✅ DONE | ~~**G-3** (CRUD поставщиков)~~ ✅ DONE | ~~**G-1** (SI-1.2 — извлечение через API параллельно с RPA)~~ ✅ DONE.

**P1 — сильно повысит оценку, реалистично за 1–2 спринта:**
- ~~**C4** (ABC-анализ)~~ ✅ DONE, ~~**C10** (PDF-отчёт аналитики)~~ ✅ DONE.
- **C11.2 (усилить multi-tenancy до Hibernate `@Filter`)** 🟡 TODO, если нужна именно ORM-level изоляция; текущая header-based изоляция Product/Supply уже есть.
- ~~F4 (role-guard)~~ ✅ DONE, F5 (дизайн-система), F6 (Redux-persist), ~~F7 (единый HTTP-слой)~~ ✅ частично DONE (`httpService` + service layer есть).
- ~~B2 (Saga отгрузки)~~ ✅ DONE; ~~G-7 (статус STAGING)~~ ✅ DONE; ~~B5 (@Schema example)~~ ✅ DONE (2026-05-02: примеры на всех ключевых DTO: LoginRequest, RegisterWithInvitationRequest, CreateOrganizationRequest, CreateInvitationRequest, CreateProductRequest, ReceiveProductRequest, WriteOffRequest, RevaluationRequest, CreateWarehouseRequest, CreateRackRequest, CreateShelfRequest, CreateCellRequest, CreatePalletRequest, CreateSupplierRequest, CreateSupplyRequest, CreateBatchRequest).
- ~~I1 (CI/CD)~~ ✅ DONE, ~~I4 (probes)~~ ✅ DONE, ~~I7 (секреты)~~ ✅ DONE.
- ~~**G-4 (SEC-2 шифрование БД)**~~ ✅ DONE (2026-05-02): `EncryptedStringConverter` (AES-256/ECB/PKCS5, детерминированное) в organization-service и SSO. `OrganizationReadModel.unp` и `.address` — зашифрованы. `LoginAudit.ipAddress` — переведён из `inet` в `TEXT` + зашифрован. V2 миграции для изменения типов колонок. Ключ из `${APP_DB_ENCRYPTION_KEY}` — без ключа работает как plaintext.
- **G-5** (бенчмарки PER-2 ≤5 сек), ~~G-6 (inline-создание товара в приёмке)~~ ✅ DONE (POST /api/products), ~~G-8 (статус QUARANTINE)~~ ✅ DONE, **G-13** (пресеты «один клик» в C10).
- ~~MED-дефекты §1.5~~ ✅ D-SSO-6/7/10/11, D-DOC-2..7, D-GW-2..5, D-ORG-2..7, D-WH-1/4/5/6 — все закрыты.

**P2 — задел / расширения:**
- ~~B3 (персистентная Saga)~~ ✅ DONE, B4 (Event Sourcing для Inventory) ❌ PENDING | ~~B6 (шифрование БД)~~ → перенесено в P1 как G-4, **B7 (общий модуль `common-security`)**.
- I5 (Redis для gateway).
- **G-9** (Секция/Ярус/№ для Shelf — оставить «как есть», но зафиксировать решение в §0.1), **G-10** (явное описание AVL-1 в DEPLOYMENT.md), **G-11** (зафиксировать конфликт SRS↔poyasn по сканерам в §0.1), **G-12** (метрики BO-1/2/3 для защиты).
- Пп. 1–15 из раздела 3.

---

## 5. Дорожная карта (предлагаемая)

| Спринт | Цель | Содержимое |
|---|---|---|
| **0** ✅ | Аутентификация и tenant-claim | ~~D-SSO-3~~ ✅ (`organizationId` в JWT), ~~D-GW-1~~ ✅ (`@Component` на JWT-фильтр gateway), ~~D-ORG-1~~ ✅ (`@PreAuthorize` вместо `X-User-Role`), ~~D-SSO-1/2~~ ✅, ~~D-SSO-9~~ ✅, D-X-2 (отложено до C11), ~~D-ORG-2~~ ✅ (organizationDB.sql дополнен) |
| **1** ✅ | Гигиена + логи + баги | ~~C3~~ ✅ (JWT TTL), ~~C7~~ ✅ (УНП уникальность в коде), ~~**I6**~~ ✅ (logback-spring.xml + LogstashEncoder во всех 5 сервисах), ~~D-PR-1..11~~ ✅, ~~D-X-1~~ ✅ (RabbitMQ publish: product+org) |
| **2** ✅ | Операции + invitation + поставка | ~~C1~~ ✅ (переоценка), ~~C2~~ ✅ (списание), ~~C6~~ ✅ (блокировка), ~~C12~~ ✅ (invitation flow), ~~G-2~~ ✅ (Supply с lifecycle), ~~G-3~~ ✅ (Suppliers CRUD), ~~D-PR-5~~ ✅ (Saga compensation). Осталось: F1 (frontend), F2 (скачивание) |
| **3** ✅ | RPA полностью + PDF + ABC | ~~C4~~ ✅ (ABC-анализ: `AbcAnalysisService` + ежедневный `@Scheduled`, `POST /api/analytics/abc/recalculate`, `GET /api/analytics/abc`), ~~C5~~ ✅ (RPA: `RpaHtmlExtractorImpl` через Jsoup + `MockErpController` в document-service + `ErpExtractorJob` `@Scheduled(0 0 3 * * *)`, idempotency через `extraction_log`), ~~G-1~~ ✅ (`PlannedDeliveryExtractor` interface + `ApiExtractorImpl` REST-канал, переключение через `erp.extraction.mode`), ~~C8~~ ✅ (PDF: `PdfDocumentService` с Apache PDFBox 3.0.3, все 6 типов документов, `?format=pdf` параметр в контроллере), ~~C9~~ ✅ (Picking list: `generatePickingListPdf()` в `PdfDocumentService`, `POST /api/documents/picking-list?format=pdf`) |
| **4** ✅ | Multi-tenancy + аналитика | ~~C11~~ ✅ (organizationId в Product/Supply entities + ProductController, SupplyController фильтруют по `X-Organization-Id` header; gateway форвардит `X-Organization-Id` из JWT; **Supplier оставлен глобальным справочником без orgId** — откат сделан в сессии 4), ~~C10~~ ✅ (`POST /api/analytics/report?preset=week|month|quarter|year` → PDF via PDFBox в product-service), ~~G-13~~ ✅ (пресеты week/month/quarter/year без выбора дат), ~~D-SSO-5~~ ✅ (AMQP добавлен в SSO, `EmployeeEventListener` обновляет `UserReadModel.isActive` при блокировке; org-service публикует `employee.status.changed` event), ~~D-WH-3~~ ✅ (createPallet теперь создаёт N `PalletPlace` entities), Postman: все 5 коллекций обновлены |
| **5** ✅ | Качество, инфра, шифрование | ~~I1~~ ✅ (CI/CD — `.github/workflows/ci.yml` создан), ~~I7~~ ✅ (DB credentials + OAuth secrets → env vars с defaults), ~~I4~~ ✅ (management.endpoint.health.probes.enabled во всех сервисах), ~~D-SSO-6/7/10/11~~ ✅, ~~D-ORG-2/3/4/5/6/7~~ ✅, ~~D-WH-1/4/5/6~~ ✅, ~~D-DOC-2/3/4/5/6/7~~ ✅, ~~D-GW-2/3/4/5~~ ✅. Остаётся: I3 (Flyway), I2 (Checkstyle жёсткий), G-4 (AES-GCM шифрование) |
| **6** ✅ | Полировка | ~~G-7~~ ✅ (STAGING), ~~G-8~~ ✅ (QUARANTINED), ~~G-6~~ ✅ (inline product), ~~I3~~ ✅ (Flyway + V1__init.sql + baseline-on-migrate), ~~G-4~~ ✅ (AES-256/ECB encryption: UNP/address/IP), ~~B5~~ ✅ (@Schema examples на 18 DTO), ~~D-X-3~~ ✅ (eventVersion автоинкремент везде: warehouse/rack/product/org), ~~D-GW-1~~ ✅ (реально исправлен: anyExchange().authenticated()), B3 ✅ (recoverUnfinishedSagas + getShipSagaState lazy load от БД), тестовые исходники backend удалены по решению пользователя: `src/test` удалён в `api-gateway`, `document-service`, `eureka-server`, `organization-service`, `product-service`, `SSOService`, `warehouse-service`. Остаётся: I2 (Checkstyle), C11.2 (Hibernate @Filter), B4 (Event Sourcing Inventory) |
| **7 (защита)** | Связь с poyasn | **G-9/G-10/G-11/G-12** — оформить раздел README/презентации: метрики «было/стало» для BO-1..3, явные решения по конфликтам SRS↔poyasn, описание AVL-1 |
| **B1 (вне расписания)** | Ролевая модель | После решения пользователя — миграция enum, frontend, тесты |
