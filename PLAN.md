# План работ по WMS-проекту

> Компактная версия после чистки 2026-05-09. Все ✅ DONE-задачи и закрытые дефекты удалены — оставлено только открытое.
> История реализации — в `git log` и memory-сводках сессий.
> Источник истины по требованиям — **`poyasn.pdf`** (приоритет №1) + `Спецификация_требований_разработчика_SRS.pdf` (приоритет №2). При конфликте побеждает poyasn.

---

## 0. Контекст

WMS-платформа для предприятий РБ:
- **Backend:** Java 21 + Spring Boot 3.5, 5 микросервисов (`SSOService`, `organization-service`, `warehouse-service`, `product-service`, `document-service`) + `eureka-server` + `api-gateway`. PostgreSQL × 4 + Redis + RabbitMQ.
- **Frontend:** React 19 SPA, Redux Toolkit, MUI.
- **RPA:** программные роботы для извлечения плановых поставок из ERP и автогенерации документов РБ.

Готовность: ~95% backend (закрыты Sprints 0-6 + большая часть Sprint 7), ~95% frontend (закрыты Sprint 6-7, остался D.10 low-priority).

---

## 0.1 Открытые решения

| Тема | Статус | Комментарий |
|---|---|---|
| Централизация логов | ❌ Не зафиксировано | I6 закрыл минимум по EXP-1: JSON в stdout + файл с ротацией. Куда слать дальше (Loki / ELK) — отдельный вопрос. |
| **Секция/Ярус/№ для Shelf** (G-9) | ✅ Зафиксировано 2026-05-09 | Оставлено «как есть». Текущей модели стеллажа (`name` + `kind` + `storageConditions`) и слота полки (`shelfCapacityKg` + `lengthCm/widthCm/heightCm`) достаточно для покрытия UC по приёмке/размещению/инвентаризации. Явных полей «секция»/«ярус»/«номер позиции» вводить не будем — детализация для poyasn не критична, а адресация осуществляется через `shelfId`/`cellId`/`fridgeId`/`placeId` (UUID). |
| **Сканеры штрихкодов** (G-11, конфликт SRS↔poyasn) | ✅ Зафиксировано 2026-05-09 | SRS FR-3.5 предусматривает интеграцию со сканерами штрихкодов как функциональное требование; poyasn относит сканеры к «периферии» (внешние устройства, не часть системы). **Решение: делаем по poyasn** — поддержка сканеров не входит в scope текущей реализации (см. §2 п. 1 как будущее расширение). UI работает с обычным вводом полей; если периферийный сканер настроен как HID-keyboard, ввод будет приходить в TextField без изменений в коде. |

Все остальные ключевые решения (JWT TTL, multi-tenancy подход, RPA-канал, регистрация, ролевая модель из 3 ролей, Apache PDFBox для PDF) — **зафиксированы** ранее и реализованы.

---

## 0.2 База требований (источники истины)

### 0.2.1 Иерархия источников

| Приоритет | Источник | Как использовать |
|---|---|---|
| 1 | `poyasn.pdf` | Источник истины: предметная область, BO/BR/UC/FR/SI/NFR, форматы документов, бизнес-цели защиты |
| 2 | `Спецификация_требований_разработчика_SRS.pdf` | Уточнение по стеку, архитектуре, паттернам, тестам, Swagger/Postman |
| 3 | `Требования к *Service.txt` (5 файлов в корне) | Authoritative бизнес-требования по каждому сервису + DB-схема |
| 4 | Текущий код | Фактическое состояние; если расходится с poyasn — задача открытая |

### 0.2.2 Бизнес-цели poyasn (для метрик защиты)

| ID | Цель | Как доказать |
|---|---|---|
| BO-1 | Повысить эффективность управления запасами | FEFO/ABC, инвентаризация, аналитика, отсутствие `findAll` на крупных отчётах |
| BO-2 | Прозрачность и отслеживаемость операций | audit/event store, операции, RabbitMQ-события, Postman-сценарии |
| BO-3 | Снизить трудозатраты на документы на 60-70%, ошибки до <1% | Расчёт «ручное заполнение vs автогенерация» + автоподстановка + DTO-валидация |

### 0.2.3 Роли poyasn ↔ кодовые

| Роль poyasn | Кодовая | UC | Ограничения |
|---|---|---|---|
| Кладовщик | `WORKER` | UC-1..UC-5 | Не управляет организацией, сотрудниками, бухгалтерией |
| Заведующий складом | `DIRECTOR` | UC-6..UC-10 | Видит только свою организацию |
| Бухгалтер | `ACCOUNTANT` | UC-11..UC-16 | Переоценка, инвентаризация, списание, акты |

### 0.2.4 NFR poyasn (открытые критерии)

| ID | Требование | Статус |
|---|---|---|
| **PER-2** | Ответ на запросы ≤ 5 секунд | ❌ Бенчмарков нет — см. **G-5** |
| AVL-1 | Доступность в рабочее время | 🟡 покрыто probes, нужен явный абзац в README — см. **G-10** |

---

## 0.3 Highest-priority backlog 🔥

> **См. отдельный файл [`BACKEND_HP_BACKLOG.md`](./BACKEND_HP_BACKLOG.md)** — поднято 2026-05-08. Эти задачи **выше** Sprint 7 и Sprint 8.

- **HP-1** Полный набор документов РБ — RPA-шаблоны для 8 пропущенных типов (release-order, transport-note, cmr, invoice-fact, invoice, picking-list, receipt-act, discrepancy-act). PDF работает для всех 14, RPA только для 5. Оценка: **2-3 дня**.
- **HP-2** Пагинация на всех list-endpoints — сейчас `List<X>` через `findAll()`, риск OOM на 10k+ записей и нарушение PER-2. Backend `Page<X>` + frontend `<TablePagination>`. Оценка: **2-3 дня**.

**HP-1 + HP-2 ≈ 4-6 дней** на бэкендера + ~1 день на фронте для HP-2.

---

## 1. Открытые задачи

### 1.1 Backend

#### **C11.2. Hibernate `@Filter` для multi-tenancy** ✅ DONE (2026-05-08)

**Сделано в product-service**:
- `model/entity/package-info.java` — `@FilterDef(name = "orgFilter", parameters = @ParamDef(name = "orgId", type = UUID.class))`.
- `@Filter(name = "orgFilter", condition = "organization_id = :orgId")` на: `ProductReadModel`, `Inventory`, `ProductOperation`, `Supply`, `ShipmentRequest`, `ProductBatch`, `InventoryCount`, `InventorySession`. (`Supplier` намеренно НЕ помечен — глобальный справочник.)
- `config/tenant/TenantContext.java` — ThreadLocal-хранилище для текущего orgId.
- `config/tenant/TenantInterceptor.java` — `HandlerInterceptor`, читает `X-Organization-Id` из заголовка (gateway пробрасывает из JWT) и кладёт в `TenantContext`. В `afterCompletion` чистит ThreadLocal. Исключения: `/api/internal/**`, `/actuator/**`, swagger-ui.
- `config/tenant/TenantFilterAspect.java` — `@Aspect` с `@Order(LOWEST_PRECEDENCE)` оборачивает все `@Transactional` методы в `service.*`; внутри транзакции включает Hibernate-filter `enableFilter("orgFilter").setParameter("orgId", orgId)`. Если `TenantContext.get() == null` (saga-recovery, internal calls) — filter не активируется, доступ ко всем tenant'ам.
- `config/WebMvcConfig.java` — регистрирует `TenantInterceptor`.
- `build.gradle` — добавлен `spring-boot-starter-aop`.

**Сделано в warehouse-service** (2026-05-08):
- `model/entity/package-info.java` — `@FilterDef`.
- `@Filter` на: `WarehouseReadModel` (`org_id = :orgId`), `Shelf`/`Cell`/`Fridge`/`PalletPlace` (`organization_id = :orgId` — денормализовано через D-X-2). `RackReadModel` фильтруется через подзапрос `warehouse_id IN (SELECT w.warehouse_id FROM warehouse_read_model w WHERE w.org_id = :orgId)` — у rack нет своей tenant-колонки.
- `config/tenant/{TenantContext,TenantInterceptor,TenantFilterAspect}.java` + `config/WebMvcConfig.java` — по образцу product-service.
- `build.gradle` — добавлен `spring-boot-starter-aop`.
- compileJava ✅ для warehouse-service и product-service.

**Что осталось** (P2):
- Опционально — убрать ручные `findByOrganizationId(...)` / `findByOrgId(...)` в repository (теперь излишни). Не критично — сейчас double-filter работает безопасно (defense in depth).
- **Runtime-проверка**: тест «фабрикация ID» (пользователь из org-A → `GET /api/products/{idIzOrgB}` → 404, аналогично для warehouse). Без интеграционных тестов (Sprint 8) валидация только ручная.

Требует пересборки product-service и warehouse-service.

#### **B4. Event Sourcing для `Inventory`** ❌ PENDING (P2)

Сейчас `Inventory` — простой JPA. Для соответствия CQRS-парадигме:

- Добавить `InventoryEvent` с типами `ITEM_ADDED`, `ITEM_REMOVED`, `REVALUED`, `WRITTEN_OFF`.
- `Inventory` становится Read Model, проектируемой из событий.
- Это упростит саги и даст полный audit-trail.

**Оценка:** 2-3 дня.

#### **B7. Общий модуль `common-security`** (P2)

`JwtAuthenticationFilter`, `GlobalExceptionHandler`, `ErrorResponse` дублируются в каждом сервисе. Вынести в Gradle-модуль `common-security`, подключить как `implementation project(':common-security')`.

**Оценка:** 1-2 дня.

#### **I2. Checkstyle строгий** 🟡 В ПРОЦЕССЕ

В `backend/build.gradle` снять `ignoreFailures = true`. Сейчас прогон чистый по компиляции, но: 763 PMD violations + 120 SpotBugs issues — нужно проанализировать и либо исправить, либо обоснованно подавить через `@SuppressWarnings`. После — `failOnViolation = true` в CI.

**Оценка:** 1-2 дня.

#### **I5. Распределённый кэш api-gateway**

Сейчас Caffeine in-memory. При нескольких инстансах за балансировщиком — рассогласование. Перевести на Redis (тот же, что в SSO, но с отдельным namespace).

**Оценка:** 0.5-1 день.

#### **G-5. PER-2 benchmarks** ❌ (P1)

Нет performance-тестов. С учётом риска OOM (закрывается **HP-2**) и DB-side filtering (закрыт через D-PR-7) — добавить:

- Бенчмарк-тесты ключевых endpoints: `/api/analytics/...`, `/api/inventory/available`, `/api/operations/ship`.
- Фикстура ≥10k операций.
- Assertion `< 5s p95`.

JMH или `@RepeatedTest` с `Duration.ofSeconds(5)` assertion. Включить в Sprint 8.

**Оценка:** 1-2 дня.

#### **Sprint 7 для защиты — G-10/G-12**

| ID | Что | Оценка |
|---|---|---|
| **G-10** | Абзац в `DEPLOYMENT.md`: «как обеспечена доступность AVL-1: probes + replica + persistent volumes». | 0.5 дня |
| **G-12** | Раздел в `README.md`: расчёт «было/стало» для BO-1..3 на 1-2 типичных операциях (приёмка партии 50 SKU: было — Х минут ручного ввода, стало — Y, % экономии). | 1 день |

**Итого Sprint 7:** ~1.5 дня.

> G-9 (Секция/Ярус для Shelf) и G-11 (конфликт SRS↔poyasn по сканерам) зафиксированы в `§0.1` 2026-05-09 — закрыты документально.

### 1.2 Frontend

#### **F5. Дизайн-система (UX/UI poyasn)**

**Должно быть:**
- `primary.main = '#1976D2'` (синий)
- `secondary.main = '#FFE673'` (жёлтый)
- Семантические: `#D32F2F` (error), `#ED6C02` (warning), `#2E7D32` (success)
- `fontFamily = 'Gantari, Jost, Arial, sans-serif'`

**Сейчас в `client/src/theme.js`:** `primary.main = '#005FF9'`, `secondary.main = '#FFD600'`, `fontFamily = 'Manrope'`.

**Шаги:**
- `npm install @fontsource/gantari @fontsource/jost`
- Импорт в `index.js`, миграция `theme.js`
- Иерархия H1-H4: `h1 { fontSize: '2.5rem', fontWeight: 800 }` … `h4 { fontWeight: 500 }`
- Прогнать страницы: `variant="h5/h6"` → консистентные `h2/h3`

**Оценка:** 1-2 дня.

#### **F6. Кэширование UI и offline-устойчивость (ROB-1)**

- `npm install redux-persist`
- `persistReducer` для `auth` slice (whitelist: `user`, `tokens`)
- Незавершённые формы (приёмка, инвентаризация) — `localStorage`-черновик с автосохранением каждые 5 секунд (`useDraft(formId)` хук)
- На axios-перехватчике — обработка `network error` → toast «Соединение потеряно, изменения сохранены локально»

**Оценка:** 1-2 дня.

#### **D.10 Quick-actions расширение MainPage** (CLIENT_PLAN — low-priority)

Drag/sort плитки, закрепление любимых действий, кастомный порядок per user, persistence в `localStorage`/Redux-persist. Цена: средняя.

**Оценка:** 1-2 дня.

### 1.3 Backend-тесты — Sprint 8 ⏳

**Контекст**: в Sprint 6 (2026-05-02) `src/test/**` был удалён во всех 7 проектах backend по решению пользователя. JaCoCo с минимумом 50% настроен, но без тестов не срабатывает. Также за Sprint 6-7 добавлены **новые непокрытые backend-точки**:

- `product-service`: `DocumentClient`, `OperationController.receive/writeOff/revaluate` (синхронный вызов document-service для `documentId`), `ProductAnalyticsService.getOperationsComparison/getInventoryComparison`, `InventoryCheckService.getInventorySession.records[]` с lookup продуктов.
- `warehouse-service`: `RackService.getSlotsByRack`.
- ранее: AES-шифрование (`EncryptedStringConverter`), Saga rehydrate, RabbitMQ-каскады.

#### Объём задач

##### Unit-тесты (Mockito + AssertJ + JUnit 5)

| Сервис | Что тестируем | Приоритет |
|---|---|---|
| **product-service** | `ProductOperationService.receiveProduct/writeOffProduct/revaluateProduct` (golden + AppException edge), `InventoryCheckService.startInventory/recordActualCount/completeInventory/getInventorySession`, `ProductAnalyticsService.getOperationsComparison/getInventoryComparison` (с фикстурой), `WriteOffService.getMarkedItems`, `SagaOrchestrator.runReceiveSaga/runShipSaga` (incl. failure path) | P0 |
| **product-service** | `DocumentClient.generateXxx` — Mockito `RestTemplate`, ассерты на graceful null | P1 |
| **SSOService** | `UserService.register*` (3 пути), `JwtTokenService` (RS256 claims), `RefreshTokenService.deleteAllUserTokensExcept`, `OAuthService.completeRegistration` (incl. invitation email-match) | P0 |
| **organization-service** | `OrganizationService.create/update/archive` (incl. ARCHIVED + событие), `EmployeeManagementService.setStatus/deleteEmployee` (`employee.status.changed`), `InvitationService.create/validate/markAsUsed` | P0 |
| **warehouse-service** | `WarehouseService.create/delete` (с `warehouse.deleted`), `RackService.createRack/createShelf/createCell/createFridge/createPallet` (incl. `getSlotsByRack`) | P0 |
| **document-service** | `DocumentService.generate*` (всех 14 типов), `PdfDocumentService` рендер, `DocumentRpaService` Apache POI | P1 |

##### Controller-тесты (`@WebMvcTest` + `MockMvc`)

- RBAC: 403 на отсутствие `X-User-Role` или роли вне whitelist.
- DTO validation: `@NotBlank`/`@Email`/`@Pattern` → 400 с русскими сообщениями.
- JSON-сериализация на критичных endpoint'ах: `/api/auth/login`, `/api/operations/receive`, `/api/analytics/inventory`.

##### Integration-тесты (Testcontainers PostgreSQL + Redis + RabbitMQ)

- **Receive Saga end-to-end**: создать товар → склад → стеллаж → ячейка → `POST /api/operations/receive` → проверить `inventory`, `product_operation`, событие `product.received` в RabbitMQ.
- **Ship Saga end-to-end**: + проверка `STAGING`/`COMPLETED` и публикация документа.
- **Inventory check полный цикл**: `start` → `record` × N → `complete` → `discrepancies` + `marked_for_writeoff`.
- **Cross-service event flows** (с `RabbitMQContainer`): SSO `user.director.deleted` → org-service archive + warehouse-service delete; org-service `organization.archived` → SSO clears `organization_id`.
- **AES-шифрование** (`organization-service`, `SSOService`): сохранить с УНП → прочитать → значения совпадают (с `APP_DB_ENCRYPTION_KEY` из test-properties).

##### Performance-тесты (PER-2 ≤5 сек)

- Бенчмарк `/api/analytics/inventory`, `/api/inventory/available`, `/api/operations/ship` с фикстурой ≥10k операций. JMH или `@RepeatedTest` с `Duration.ofSeconds(5)` assertion p95.

##### Contract-тесты (опционально, P2)

- Spring Cloud Contract или Pact: product-service ↔ document-service (`DocumentClient`), SSO ↔ org-service (`InternalEmployeeController`), warehouse-service ↔ product-service (`WarehouseClient`).

#### Acceptance criteria Sprint 8

- [ ] JaCoCo coverage ≥ 50% во всех 5 включённых в `codeQualityServices`.
- [ ] `./gradlew allTestWithCoverage` зелёный без `--continue`.
- [ ] CI pipeline (`.github/workflows/ci.yml`) запускает тесты с Postgres×4 + Redis + RabbitMQ через Testcontainers.
- [ ] Controller-тесты используют `@WebMvcTest(controllers = X.class)` + `@AutoConfigureMockMvc(addFilters = false)` + `@MockBean`.
- [ ] @DisplayName на русском (как было в исходных тестах до удаления).
- [ ] Test-классы в `src/test/java/by/bsuir/<service>/{controller,service,integration,utils}/` (зеркалят main).

#### Оценка трудозатрат

**5-7 рабочих дней** на одного бэкендера: 2 дня unit (5 сервисов × ~10 классов) + 2 дня controller + 2 дня integration (Testcontainers + saga end-to-end) + 1 день performance + ревью CI.

---

## 2. Будущие расширения 💡

Не требуется ни poyasn, ни SRS — повышает зрелость дипломного решения. Закрыть после HP-1/HP-2 + Sprint 7 + Sprint 8:

1. Поддержка сканеров штрихкодов в UI (`<BarcodeScannerInput>` с автофокусом, debounce, beep, scan-mode).
2. Offline-mode для кладовщика (Service Worker + IndexedDB как очередь операций; отложенная синхронизация).
3. WebSocket / SSE-канал «склад → заведующий» (poyasn TO-BE 2.1.2 «информация в режиме реального времени»).
4. Печать наклеек / штрихкодов на принтерах этикеток (ZPL-генератор + endpoint в `document-service` + UI «Распечатать ярлык»).
5. Endpoint `/api/products/{id}/history` — лента событий по товару из Event Store (UI-таб).
6. ⬆️ Пагинация — поднято в **HP-2**.
7. Rate limiting на api-gateway (`RequestRateLimiter` + Redis) — защита от brute-force на login. См. **I5**.
8. ~~Multi-tenancy на уровне ORM — Hibernate `@Filter`~~ — закрыто (C11.2).
9. Chaos-тест Saga: остановить product-service между `BATCH_CREATION` и `INVENTORY_UPDATE` и убедиться в recovery после рестарта.
10. Контракт-тесты между сервисами (Spring Cloud Contract или Pact).
11. ⬆️ Полный набор документов РБ — поднято в **HP-1**.
12. Валидация бизнес-правил BR-3..BR-6 как Strategy + Chain of Responsibility (`PlacementValidator` chain) — сейчас часть проверок захардкожена в DTO.
13. ~~i18n на фронте~~ — отвергнуто (CLIENT_PLAN E.18).
14. Импорт справочников из Excel (товары, поставщики).
15. e2e-тесты Playwright на критические сценарии: логин, приёмка, отгрузка с FEFO, инвентаризация, переоценка, списание.

---

## 3. Приоритезация

**Highest priority (см. `BACKEND_HP_BACKLOG.md`):**
- HP-1 Полный набор документов РБ (2-3 дня)
- HP-2 Пагинация (2-3 дня)

**P0 (для защиты):**
- Sprint 7 docs G-10/G-12 (~1.5 дня)
- Sprint 8 unit + critical integration (4-5 дней)
- I2 Checkstyle строгий (1-2 дня)

**P1 (улучшат оценку):**
- G-5 PER-2 benchmarks (1-2 дня — закрывается в Sprint 8)
- F5 design system (1-2 дня)
- F6 Redux-persist + offline drafts (1-2 дня)

**P2 (задел):**
- B4 Event Sourcing для Inventory (2-3 дня)
- B7 common-security модуль (1-2 дня)
- I5 Redis для gateway (0.5-1 день)
- D.10 Quick-actions расширение MainPage (1-2 дня) — low-priority
- §2 пп. 1, 2, 3, 4, 5, 9, 10, 12, 14, 15.

---

## 4. Дорожная карта (только открытое)

| Спринт | Цель | Оценка |
|---|---|---|
| **HP** 🔥 | HP-1 (документы РБ) + HP-2 (пагинация) | 4-6 дней + 1 день фронт |
| **7 (защита)** | Документация G-10/G-12 для защиты | ~1.5 дня |
| **8** ⏳ | Восстановление backend-тестов (см. §1.3) | 5-7 дней |
| **+ парал.** | I2 Checkstyle, F5/F6 | по графику |

**Минимум до защиты:** HP + Sprint 7 + Sprint 8 unit + I2 = **~2 рабочих недели на одного бэкендера**.

**Полный план:** + B4, B7, I5, F5, F6 = **~5 недель**.

**Двое разработчиков:** ~1 неделя минимум, ~2.5 недели полно.

---

## 5. Где смотреть детали

- **HP-1 / HP-2** — `BACKEND_HP_BACKLOG.md` (полный контекст, файлы, acceptance, оценки).
- **Sprint 8** — выше §1.3.
- **CLIENT_PLAN.md** — клиентский трек (закрыт, остался только D.10 low-priority).
- **`Требования к *Service.txt`** — authoritative business requirements, читать при сомнениях «правильно ли мы это понимаем».
- **`backend/CLAUDE.md`** — конвенции backend (Gradle, package layout, DTO, JWT, RabbitMQ topology, Saga, RPA).
- **`client/CLAUDE.md`** — конвенции frontend (RHF+yup, Redux slices, FormWizard, PageBreadcrumbs, useSnackbar).
