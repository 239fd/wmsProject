# План работ по WMS-проекту

> Содержит только открытое. История закрытого — в `git log` и memory-сводках.
> Источник истины — **`poyasn.pdf`** > `Спецификация_требований_разработчика_SRS.pdf` > `Требования к *Service.txt` > текущий код.

---

## 0. Контекст проекта

**WMS (Warehouse Management System)** — дипломный проект, система автоматизации складского учёта для предприятий РБ. Закрывает три бизнес-цели poyasn: повышение эффективности управления запасами (BO-1), прозрачность операций (BO-2), снижение трудозатрат на документы на 60-70% и ошибок <1% (BO-3).

### Стек

- **Backend:** Java 21, Spring Boot 3.5.7, Gradle multi-module. 7 проектов: `eureka-server` (8761), `api-gateway` (8765, Kotlin DSL), `SSOService` (8000), `organization-service` (8010), `warehouse-service` (8020), `product-service` (8030), `document-service` (8040).
- **БД:** PostgreSQL × 4 (user_db, organization_db, warehouse_db, product_db, порты 5432-5435), Redis (refresh-tokens), RabbitMQ (event-bus).
- **Frontend:** React 19, Redux Toolkit, MUI v7, react-hook-form + yup, redux-persist + offline-drafts. 22 страницы.
- **DevOps:** Docker Compose + Kubernetes manifests, мониторинг через Prometheus + Grafana + Loki + Jaeger.

### Ключевые архитектурные решения

| Паттерн | Где |
|---|---|
| **CQRS + Event Sourcing (light)** | Write пишет в `*_events` + обновляет `*_read_model` в одной транзакции. Применено к User, Organization, Warehouse, Rack, Product, Inventory, ProductOperation. |
| **Saga (персистентная)** | `product-service/saga/SagaOrchestrator` управляет двумя long-running flows: Receive (BATCH_CREATION → INVENTORY_UPDATE → OPERATION_RECORD) и Ship (STOCK_RESERVATION → STAGING → DOCUMENT_GENERATION → INVENTORY_UPDATE → OPERATION_RECORD). State в `saga_state`, восстанавливается на `ContextRefreshedEvent`. Компенсация реально откатывает (`compensate(...)`). |
| **RPA (2 вида)** | (1) **Генерация документов РБ** через Apache POI шаблоны в `document-service/rpa/DocumentRpaService` (XLS/DOCX) + Apache PDFBox в `PdfDocumentService` (PDF, DejaVu Sans для кириллицы). (2) **Extract плановых поставок из ERP** через Jsoup HTML scraping + REST API в `product-service/rpa/ErpExtractorJob` (cron 03:00). См. §1.3 и §5. |
| **Multi-tenancy** | По `organization_id` на каждой entity. Gateway пробрасывает `X-Organization-Id` из JWT, сервисы фильтруют. Hibernate `@Filter("orgFilter")` где применимо. |
| **Auth** | JWT RS256 (4h access / 30d refresh в Redis), 3 роли: `WORKER` / `ACCOUNTANT` / `DIRECTOR`. SSO + OAuth (Google/Yandex). |
| **RabbitMQ topology** | Топик-обменники per-service (`sso.exchange`, `organization.exchange`, `warehouse.exchange`, `product.exchange`). Cross-service flows: `user.director.deleted`, `organization.archived`, `warehouse.deleted`, `employee.status.changed`, `product.planned_delivery_received`. |
| **Document audit-trail** | `GET /api/inventory/{id}/history` — лента событий ITEM_ADDED/REMOVED/REVALUED/WRITTEN_OFF из event-store. |

### Что открыто (актуально на 2026-05-18)

**Закрыто в этой и прошлых сессиях** (полный список в §2.x и §4): §1.5 P0+P1, HP-1, HP-2, Frontend миграция, RPA-2 Office bot, §2.7/§2.7.bis/§2.8/§2.9-2.20/§2.24/§2.25/§2.26/§2.27, §4 I5 (Redis cache + JWT filter, включая reactive-fix 2026-05-18), миграции Flyway удалены, rate-limit снят.

**Осталось открытое:**
- **§2.6 RPA-1** — read-only парсинг 1С толстого через WinAppDriver. Доступ получен 2026-05-15 (база `utdemo`), e2e не прогонялся, требует калибровки XPath. Зависит от Windows + WinAppDriver.
- **§2.8 ENV-BOUND** — Gmail SMTP работает через `JavaMailSender` (port 587 STARTTLS), но ISP пользователя блокирует исходящие SMTP-порты (25/465/587 ко всем mail-провайдерам, проверено 2026-05-18). Решение: VPN на машине отправителя или MailHog-fallback. Защита: либо VPN в аудитории, либо локальный MailHog как demo-канал.
- **§2.21** CORS gateway, **§2.22** OAuth secrets, **§2.23** SSO smoke-test — отложены пользователем.
- **§2.28** Keystore ротация — приватный ключ JWT был закоммичен в git history (`keystore/jwt-private.key`). Сейчас untracked + gitignored (2026-05-18, см. §2.26), но в истории остался. Полная очистка требует `git filter-repo` или ротации keypair.
- **§4.2 End-to-end docker-compose** — обязательная проверка перед защитой.
- **§5.1** Test coverage 51.7% → 80% — отложено.

### Где какой код

```
backend/
├── eureka-server/                — Spring Cloud Eureka, порт 8761
├── api-gateway/                  — WebFlux Gateway (Kotlin DSL), JWT-валидация
├── SSOService/                   — OAuth2-сервер, JWT-issuer, 3 роли, refresh-tokens в Redis
│   └── src/main/java/by/bsuir/ssoservice/{controller,service,model,dto,repository,config,utils}
├── organization-service/         — Org CRUD, employees, invitations, SMTP
├── warehouse-service/            — Warehouses + racks (SHELF/CELL/FRIDGE/PALLET) + pallet places
├── product-service/              — самый большой; products/batches/inventory/operations/saga/rpa
│   └── src/main/java/by/bsuir/productservice/
│       ├── controller/           — REST endpoints
│       ├── service/              — бизнес-логика (FEFO, ABC, InventoryEventService, ...)
│       ├── saga/                 — SagaOrchestrator + ReceiveSagaState + ShipSagaState
│       ├── rpa/                  — ErpExtractorJob + RpaHtmlExtractorImpl + ApiExtractorImpl
│       ├── validation/           — BusinessValidator
│       └── client/               — Feign-style WarehouseClient, DocumentClient
├── document-service/             — без БД, stateless
│   └── src/main/java/by/bsuir/documentservice/
│       ├── controller/           — DocumentController (10 endpoint'ов после cleanup), MockErpController
│       ├── service/              — DocumentService, DataEnrichmentService
│       └── rpa/                  — DocumentRpaService (Apache POI), PdfDocumentService (PDFBox)
│   └── src/main/resources/
│       ├── fonts/                — DejaVuSans.ttf + DejaVuSans-Bold.ttf (для cyrillic PDF)
│       └── (documents template/)— XLS/DOCX шаблоны (5 готовых, 8 pending)
└── build.gradle                  — root: spotless, checkstyle, JaCoCo агрегат, allTestWithCoverage

client/src/
├── pages/                        — 22 страницы (Receive, Ship, Inventory, Suppliers, ...)
├── components/{layout,shared}    — Navbar, FormWizard, ConfirmDialog, ErrorBoundary, ...
├── services/                     — httpService + 11 domain-сервисов
├── store/                        — Redux Toolkit, slices (auth, warehouses, suppliers, employees)
├── hooks/                        — useWarehouses/useSuppliers/useEmployees/useDraft
├── validation/schemas.js         — yup-схемы, RU-сообщения
└── config/{api,theme}.js         — endpoints + MUI theme

sql-scripts/{userDB,organizationDB,warehouseDB,productDB}.sql  — DDL, монтируются в Postgres-контейнеры
docker-compose.yml                                              — всё разом локально
k8s/{00..09}-*.yaml                                             — Kubernetes manifests, apply по порядку
```

### Готовность

~95% backend, ~95% frontend (на 2026-05-12). До защиты: **§1.5 P0 (MinIO + DocNumber + Workflow PAUSED) + HP-1 + HP-2 + §2 RPA-2 (Office bot) + RPA-1 (1С парсинг)**.

---

## 0.1 Зафиксированные решения (не открыты)

| Тема | Решение |
|---|---|
| **Секция/Ярус/№ для Shelf** (G-9) | Оставлено «как есть» — адресация через UUID `shelfId`/`cellId`/`fridgeId`/`placeId`. |
| **Сканеры штрихкодов** (G-11) | По poyasn — не входит в scope; работают как HID-keyboard в TextField. См. §3 п.1 как будущее расширение. |
| **JWT TTL, multi-tenancy, RPA-канал, регистрация, 3 роли, Apache PDFBox** | Зафиксированы и реализованы ранее. |
| **Q1 + Q3 (QUESTIONS.md)** Акт приёмки | Единый endpoint `receipt-act`, **всегда** генерится после приёмки. Если расхождений нет → шаблон `Акт приемки.RTF`. Если есть `discrepancies` → шаблон `Акт расхождения.xls` (богаче по реквизитам п.40 N 1290). Endpoint `discrepancy-act` дропнут, расхождения — раздел внутри `receipt-act`. Workflow: при приёмке статус операции `RECEIVED → PAUSED` (ждёт «продолжить» или «завершить»). SMTP-уведомление поставщику не делаем — это операционная ответственность сотрудников. |
| **Q2 (QUESTIONS.md)** Хранение документов | **MinIO** для бинарного хранилища (S3-совместимый, в docker-compose). В `product_db` — таблица `generated_documents` + entity `GeneratedDocument` (operationId, type, number, minioObjectKey, generatedBy, generatedAt). Document-service остаётся stateless: после генерации PDF возвращает bytes → product-service кладёт в MinIO, регистрирует в БД. `GET /api/documents/{id}` отдаёт по MinIO-ключу. Появляется страница «Документы по операции» для WORKER/ACCOUNTANT. |
| **Q4 (QUESTIONS.md)** Экспорт + ТН/ТТН | На ShipPage чекбокс **«На экспорт»**. Если включён — генерируется пакет {**ТН + CMR + инвойс**} (в одной транзакции, все три uploadятся в MinIO). Если выключен — пользователь выбирает **ТН или ТТН** + **ориентация** (горизонтальная/вертикальная, шаблоны `tn-gor.xls`/`tn-vert.xls`/`ttn-gor.xls`/`ttn-vert.xls`). Данные подтягиваются из БД максимум, недостающие — из формы (форма меняется в зависимости от чекбокса). В DTO появляется `shipmentType: DOMESTIC\|EXPORT` и `currency: String`. В saga step `DOCUMENT_GENERATION` сохраняется `List<UUID> documentIds`, не один `documentId`. |
| **Q5** Скоропортящиеся | **Не реализуем** (фиксируем как ограничение). |
| **Q6** Инвентаризация — НСБУ N 126 | Только **tooltip-подсказка** на кнопке «Создать инвентаризацию», без accordion. |
| **Q7** Документ-нумерация | **`DocumentNumberService`** в product-service: serial counter в БД per `(organizationId, type, year)`. Префиксы: ПО (приходный ордер), АП (акт приёмки/расхождения), ТТН, ТН, CMR, ИНВ (инвентаризация), ПЕР (переоценка), СПС (списание), И (инвойс), ЛП (лист подбора). Формат: `{ПРЕФИКС}-{YYYY}-{NNNNN}` (например `ПО-2026-00042`). |
| **Q8** picking-list | 6 колонок: **`Товар \| SKU \| Поставка \| Место \| Кол-во \| Ед.`**. Шапка — «Лист подбора № {shipmentNumber}». PDF через PdfDocumentService, без POI-шаблона. |
| **Q9** ЭТТН/ЭТН (электронные накладные) | **Игнорируем** — не упоминаем как ограничение даже в README. Scope нашего диплома — только бумажные ПУД. |
| **Q10** CMR-шаблон | `CMR Международная товарно-транспортная накладная.doc` подтверждён как **актуальный** на новые правила с 01.01.2026 (постановление N 9/75/35/26). |

---

## 0.2 Бизнес-цели poyasn (для метрик защиты)

| ID | Цель | Как доказать |
|---|---|---|
| BO-1 | Повысить эффективность управления запасами | FEFO/ABC, инвентаризация, аналитика, пагинация (HP-2). |
| BO-2 | Прозрачность и отслеживаемость операций | event store (`inventory_events`, `product_operation_events`), RabbitMQ-события, Postman. |
| BO-3 | Снизить трудозатраты на документы на 60-70%, ошибки <1% | RPA + автоподстановка + DTO-валидация. Расчёт «было/стало» — в README. |

### Роли poyasn ↔ кодовые

| Роль poyasn | Кодовая | UC |
|---|---|---|
| Кладовщик | `WORKER` | UC-1..UC-5 |
| Заведующий складом | `DIRECTOR` | UC-6..UC-10 |
| Бухгалтер | `ACCOUNTANT` | UC-11..UC-16 |

---

## 0.3 Конвенции для новой сессии

1. **Перед работой прочитай:** `PLAN.md` (этот файл), `backend/CLAUDE.md`, `client/CLAUDE.md`. Memory-сводки уже подгружаются автоматически.

2. **Test split (важно):** новые тесты — обычные `*Test.java` (попадают в `gradle test` → запускаются всегда без Docker). Только Testcontainers-based интеграционные — `*ContainerTest.java` (попадают в `gradle integrationTest`, требуют Docker daemon). Конфиг split'а в `<service>/build.gradle` (`exclude '**/*ContainerTest.class'` в задаче `test`, отдельная задача `integrationTest`).

3. **Schema ownership:** DDL в `sql-scripts/{userDB,organizationDB,warehouseDB,productDB}.sql` (монтируется в Postgres-контейнеры на первый старт) + Flyway-миграции в `<service>/src/main/resources/db/migration/V*.sql`. Hibernate `ddl-auto=validate` во **всех 4 сервисах с БД** (SSO, organization, warehouse, product). `document-service` без БД (stateless). При добавлении поля в entity — миграция в `db/migration/V*.sql` обязательна, иначе старт упадёт на schema-validation.

4. **HP-2 эталон Suppliers** (паттерн для раскатки на остальные list-endpoints):
   - Backend: `backend/product-service/src/main/java/by/bsuir/productservice/repository/SupplierRepository.java`, `service/SupplierService.java`, `controller/SupplierController.java`.
   - Frontend: `client/src/services/supplierService.js`, `client/src/pages/SuppliersPage.js`.
   - Контракт ответа: `Page<X>` (Spring Data) — `content`, `totalElements`, `totalPages`, `number`, `size`. Default `size=20`, max `100`.

5. **MockErpController** (`backend/document-service/src/main/java/by/bsuir/documentservice/controller/MockErpController.java`) — **dev-fallback**: тестовая заглушка ERP, отдаёт login-форму + HTML-таблицу `<table id="deliveries-table">`. Используется существующим `RpaHtmlExtractorImpl` (Jsoup) и `ApiExtractorImpl` (REST) для разработки без реального 1С. В production-режиме (RPA-1 через WinAppDriver на толстом 1С) не задействован. Не часть document-service по смыслу, переедет в отдельный модуль после защиты.

6. **Текущее coverage** (2026-05-15): **473 backend-теста** (`gradle allTestWithCoverage` без Docker). JaCoCo aggregate: **51.7% INSTRUCTION / 40% BRANCH** после exclusions, добавленных 2026-05-15 (см. `backend/build.gradle ext.jacocoExcludes`): `config/dto/model.entity/model.event/model.enums/rpa/exception/client/*Application`. **80% не достигнуто** — это потолок при подходе «только exclusions» (см. §8.1). До 80% нужно ~150-170 новых тестов на service+controller — отложено. Per-service `jacocoTestCoverageVerification.minimum = 0.50` — текущее условие пройдено. **Не ронять.** Запуск: `gradle allTestWithCoverage` (без Docker), `gradle allIntegrationTest` (с Docker).

7. **Backend conventions** (полностью в `backend/CLAUDE.md`):
   - Java records для DTO, Russian-language `@DisplayName` в тестах.
   - `AppException` с factory-методами (`badRequest`/`notFound`/`forbidden`/`conflict`) вместо raw RuntimeException.
   - Все мутации Inventory эмитят `InventoryEvent` через `InventoryEventService` (B4 done) — типы `ITEM_ADDED`/`ITEM_REMOVED`/`REVALUED`/`WRITTEN_OFF`.
   - Cross-service вызовы через `/api/internal/**` whitelisted на JWT-фильтре. Не выставлять через gateway.

8. **Frontend conventions** (полностью в `client/CLAUDE.md`):
   - Все формы через `react-hook-form + yup` (схемы в `client/src/validation/schemas.js`, RU-сообщения).
   - Snackbar глобально через `useSnackbar()` (не локальный state в страницах).
   - HTTP только через `httpService` (axios), Redux thunks через `store/api.js` — единый axios-инстанс.
   - **3 роли** `WORKER`/`ACCOUNTANT`/`DIRECTOR` — не вводить четвёртую.
   - **ИНН вместо УНП** в UI-текстах (валидация 9 цифр оставлена для РБ). Поле `unp` в API-DTO остаётся.
   - **redux-persist + useDraft** уже подключены (F6). Черновики приёмки автосохраняются.

9. **PDF cyrillic:** `document-service` использует **DejaVuSans.ttf** (`src/main/resources/fonts/`). PDF generate-методы в `PdfDocumentService` корректно рендерят кириллицу — НЕ возвращайте `Standard14Fonts.HELVETICA`, иначе всё развалится на любом русском тексте. После cleanup §1 в `PdfDocumentService` должно остаться **10 generate-методов** (под 10 типов после удаления `release-order`/`shipment-order`/`invoice-fact`/`discrepancy-act`).

10. **Memory feedback (важно):** no comments в коде, no tests без явного запроса, no commits без явного запроса, backend first приоритет, дата в PLAN.md в Russian формате.

---

## 0.4 Роли — функции и БП (трекинг)

> Активный трекер: что работает, что сломано (со ссылками на баги в §2.x), что в работе, что не реализовано.
> Легенда: ✅ работает · ❌ сломано · ⏳ в работе / частично · ⬜ не начато · ⛔ scope-out (зафиксировано не делать)

### Древо функций по ролям

```
WMS
│
├── 🔐 Общее (auth, профиль, инфра) — до всех ролей
│   ├── ✅ Регистрация директора + создание организации
│   ├── ✅ Регистрация по invitation-token (email-link)
│   ├── ✅ Login (JWT RS256, 4h access + 30d refresh в Redis)
│   ├── ✅ Logout (revoke refresh + login_audit)
│   ├── ✅ Активные сессии (по login_audit hash)
│   ├── ✅ Смена пароля
│   ├── ✅ OAuth Yandex / Google (callback URL через @Value)
│   ├── ⏳ Email-инвайт (URL фикс + Resend HTTPS + .env wiring) — но Resend sandbox только свой email → §2.8
│   ├── ✅ JWT issuer вынесен в @Value
│   ├── ❌ CORS в SSO + gateway без CORS          → §2.21
│   ├── ❌ OAuth secrets закоммичены в репо       → §2.22
│   └── ⛔ Четвёртая роль (STOREKEEPER)
│
├── 👷 WORKER (кладовщик = МОЛ, UC-1..UC-5)
│   ├── Приёмка
│   │   ├── ✅ Открыть ReceiptSession (одна поставка = одна сессия = один акт)
│   │   ├── ✅ Принять без замечаний → receipt-order + receipt-act (RTF)
│   │   ├── ✅ Зафиксировать расхождение → receipt-act (xls) с типами SHORTAGE / SURPLUS / DEFECT / MISGRADE / OTHER
│   │   ├── ✅ Placement по ячейкам (FEFO / адресация)
│   │   └── ✅ Inventory unit_sku (auto INV-XXXXXXXX) + batch_id (auto-create по batchNumber)
│   ├── Отгрузка
│   │   ├── ✅ Pick по штрихкоду / unit_sku             с fallback batchId IS NULL
│   │   ├── ✅ Прогресс заявки (saga state)
│   │   └── ✅ Лист подбора (picking-list PDF)
│   ├── Инвентаризация
│   │   ├── ✅ Открыть session (tooltip НСБУ № 126)
│   │   ├── ✅ Внести фактические остатки (count)
│   │   ├── ✅ Завершить session → adjustments + inventory-report
│   │   └── ✅ История расхождений
│   ├── Перемещение
│   │   └── ✅ Transfer между warehouse / cell (operation TRANSFER)
│   └── Просмотр
│       ├── ✅ Текущий Inventory (paginated)
│       ├── ✅ История операций (paginated)
│       └── ✅ Lookup партий
│
├── 🧾 ACCOUNTANT (бухгалтер, UC-11..UC-16)
│   ├── Переоценка
│   │   └── ✅ Revaluate → акт переоценки на Map.of
│   ├── Списание
│   │   └── ✅ Write-off с причиной, основанием, комиссией → write-off-act
│   ├── Документы
│   │   ├── ✅ Реестр (paginated, фильтр по типу) — /api/document-registry
│   │   ├── ✅ Скачать (inline bytes) / Presigned MinIO URL
│   │   └── ✅ Документы по операции
│   ├── Аналитика
│   │   ├── ✅ ABC-анализ (cron 02:00, abc_class A/B/C)
│   │   ├── ✅ Динамика операций (по периодам)
│   │   ├── ✅ Аналитика остатков (по складу / товару)
│   │   ├── ✅ Marked-for-write-off (paginated)
│   │   └── ✅ ABC-блок в PDF-отчёте показывает кол-во товаров
│   └── ⛔ Скоропортящиеся товары (Q5)
│
└── 👔 DIRECTOR (заведующий складом, UC-6..UC-10)
    ├── Управление складом
    │   ├── ✅ CRUD склады
    │   ├── ✅ CRUD стеллажи (SHELF / CELL / FRIDGE / PALLET)
    │   └── ✅ CRUD ячейки + pallet places
    ├── Управление организацией / сотрудниками
    │   ├── ✅ CRUD сотрудники (status, block / unblock, delete)
    │   ├── ✅ Создание invitation token + ссылка
    │   ├── ⏳ Email отправка инвайта (только на свой email из-за Resend sandbox → §2.8)
    │   └── ✅ Employee analytics (tenure-only, ops-stats удалены)
    ├── Справочники
    │   ├── ✅ CRUD поставщики (paginated)
    │   ├── ✅ CRUD товары + категории
    │   └── ✅ CRUD партии (batches)
    ├── Поставки и отгрузки
    │   ├── ✅ Список Supply (paginated)
    │   ├── ✅ Список ShipmentRequest (paginated)
    │   ├── ✅ Создать ShipmentRequest — DOMESTIC (ТН / ТТН + horizontal / vertical)
    │   └── ✅ Создать ShipmentRequest — EXPORT (ТН + CMR + invoice; USD / EUR / RUB / CNY)
    ├── ERP-интеграция (плановые поставки)
    │   ├── ✅ ApiExtractor (REST mock) — dev-fallback
    │   ├── ✅ RpaHtmlExtractor (Jsoup mock) — dev-fallback
    │   ├── ⏳ OneCWinAppExtractor (RPA-1, WinAppDriver на 1С толстом) — ждёт E2E калибровки
    │   ├── ✅ ApiExtractor login (form-encoded) + default mode=onec
    │   ├── ✅ Credentials ERP в БД (AES-encrypted, CRUD + UI)
    │   └── ✅ planned_deliveries → RabbitMQ → продукт-сервис
    └── Системные настройки
        ├── ✅ RPA mode toggle (auto / rpa) — X-Generation-Mode header
        └── ✅ OfficeBot health-check

⛔ Не делаем (scope-out, зафиксировано): ЭТТН/ЭТН (Q9), perishable + 24h таймер (Q5), SMTP-уведомление поставщику при расхождении, ручное утверждение DIRECTOR'ом receipt-act (кладовщик-МОЛ закрывает сам), 4-я роль.
```

### Сквозные БП (end-to-end happy path)

| # | БП | Шаги | Документы | Статус |
|---|---|---|---|---|
| BP-1 | **Приёмка** | DIRECTOR создаёт Supply → WORKER `POST /api/receipt-sessions` → размещение по ячейкам → complete / discrepancy | receipt-order (ПО) + receipt-act (АП) | ✅ |
| BP-2 | **Отгрузка DOMESTIC** | DIRECTOR создаёт ShipmentRequest (ТН / ТТН) → WORKER pick → saga STOCK_RESERVATION→STAGING→DOC_GEN→INV→OP | transport-note (ТН) или waybill (ТТН) + picking-list (ЛП) | ✅ |
| BP-3 | **Отгрузка EXPORT** | DIRECTOR создаёт ShipmentRequest (export, currency) → saga (тот же) → пакет 3 документов | ТН + CMR + invoice (И) + picking-list (ЛП) | ✅ |
| BP-4 | **Переоценка** | ACCOUNTANT revaluate → InventoryEvent REVALUED | revaluation-act (ПЕР) | ✅ |
| BP-5 | **Списание** | ACCOUNTANT writeOff + комиссия → InventoryEvent WRITTEN_OFF | write-off-act (СПС) | ✅ |
| BP-6 | **Инвентаризация** | WORKER startSession → внести count → completeSession → adjustments | inventory-report (ИНВ) | ✅ |
| BP-7 | **Перемещение** | WORKER transfer → operation TRANSFER + 2 InventoryEvents | — | ✅ |
| BP-8 | **Регистрация сотрудника** | DIRECTOR invite → email-link → invitee `/register/invitation` → SSO addEmployee | — | ⏳ Resend sandbox only |
| BP-9 | **ERP-импорт поставок** | cron 03:00 (или manual `POST /run`) → extractor → planned_deliveries → RabbitMQ. Credentials берутся из БД (`erp_connection`, AES-зашифрованы) либо inline body | — | ✅ (credentials wiring сделан; реальный override в extractor'ах — TODO в §2.7.bis MVP-limitation) |

### Что использовать этот раздел как трэкер

- Поле статус (✅/❌/⏳/⬜) меняется по мере работы — это **источник правды до защиты**.
- Каждое `❌` обязано иметь ссылку на параграф §2.x с разверткой бага.
- Когда баг закрыт — заменить `❌ ... → §2.x` на `✅` и зачеркнуть §2.x в роадмапе (§6).
- Когда добавляется новая функция в коде — обязательно отметить в этом дереве.

---

## 1. Highest priority 🔥 (см. `BACKEND_HP_BACKLOG.md`)

### HP-1. RPA-шаблоны документов РБ ❌ PENDING

**Контекст.** Scope сокращён с 14 до **10 типов** документов (2026-05-12, после QUESTIONS.md). Удалены 4 типа: `release-order`/`shipment-order` (alias-пара), `invoice-fact` (счёт-фактура), `discrepancy-act` (теперь — раздел внутри `receipt-act`, см. §0.1 Q1).

**Статус cleanup на 2026-05-13:**
- ✅ Endpoint'ы для этих 4 типов удалены из `DocumentController.java` (осталось 10 POST'ов).
- ❌ **Switch-case'ы** в `DocumentService.generateViaPdf` (`release-order` line 46, `invoice-fact` line 53, `discrepancy-act` line 57) **ещё живы**.
- ❌ **PDF-методы** `generateReleaseOrderPdf` / `generateInvoiceFactPdf` / `generateDiscrepancyActPdf` в `PdfDocumentService.java` (lines 121/158/234) **ещё живы**.
- ❌ Соответствующие mapper-методы в `DocumentService` (`generateShipmentOrder`/`generateInvoiceFact`/`generateDiscrepancyAct`) **ещё живы**.
- ❌ Строки в `PdfDocumentServiceParameterizedTest` для удалённых типов **ещё живы**.
- ❌ `stub-info` массив `documentTypes` — проверить и снять 4 строки.
- ❌ Postman-коллекция `docs/postman/WMS-API-Collection.json` — снять 4 запроса.

| # | Тип | PDF (PdfDocumentService, DejaVu Sans) | RPA POI шаблон (DocumentRpaService) |
|---|---|---|---|
| 1 | receipt-order (приходный ордер) | ✅ | ✅ `Приходной ордер.XLS` |
| 2 | revaluation-act (акт переоценки) | ✅ | ✅ `акт переоценки.xls` |
| 3 | inventory-report (инвентаризационная опись) | ✅ | ✅ `инвентарихационная опись.xls` |
| 4 | write-off-act (акт списания) | ✅ | ✅ `списание.docx` |
| 5 | waybill / ТТН | ✅ | ✅ `ттнls.xls` (+ `ttn-gor.xls` / `ttn-vert.xls` — выбор ориентации в payload) |
| 6 | picking-list (лист подбора) | ✅ DONE 2026-05-13. PDF: шапка «Лист подбора № {shipmentNumber}» + таблица `Товар \| SKU \| Поставка \| Место \| Кол-во \| Ед.` через новый `buildTablePdf` helper в `PdfDocumentService`. | ⚠️ Без POI-шаблона — только PDF. |
| 7 | receipt-act (акт приёмки) | ✅ | ✅ DONE 2026-05-13. Выбор внутри `generateReceiptAct(ReceiptActData)` по `data.hasDiscrepancies()`: `Акт расхождения.xls` (HSSF, богатые поля п.40 N 1290 с таблицей расхождений) / `Акт приемки.RTF` (text-replacement по `{{tokens}}` — токены добавит пользователь в шаблон). DTO `ReceiptActData` + mapper + кейс в `DocumentService.generateViaRpa`. **Калибровка ячеек (row, col) в xls — через Accessibility/Excel пользователя**, текущие позиции — baseline по паттерну `Приходной ордер.XLS`. |
| 8 | invoice (инвойс) | ✅ | ✅ DONE 2026-05-13. `generateInvoice(InvoiceData)` через `HWPFDocument.getRange().replaceText(...)` на шаблоне `blank-invojs.doc`. Поле `currency` есть в DTO (для экспорта). DTO + mapper + кейс в `DocumentService.generateViaRpa`. **Шаблон требует `{{tokens}}`** в теле документа — пользователь добавит/откалибрует токены вручную. Поддерживаемые токены: `{{documentNumber}}`, `{{documentDate}}`, `{{currency}}`, `{{sellerName/Inn/Address}}`, `{{buyerName/Inn/Address}}`, `{{contractNumber/Date}}`, `{{totalAmount}}`, `{{totalAmountInWords}}`, `{{vatRate/Amount}}`, `{{responsiblePerson}}`, `{{notes}}`, `{{itemsTable}}` (multi-line список товаров). Если токена в шаблоне нет — replace тихо пропускается. |
| 9 | transport-note (ТН / товарная накладная) | ✅ | ✅ DONE 2026-05-13. `generateTransportNote(TransportNoteData)` через HSSF. Выбор шаблона по `data.layout`: `tn-gor.xls` (horizontal — default) / `tn-vert.xls` (vertical). DTO `TransportNoteData` + `TransportItem` с НДС-полями + `currency` (для экспорта). Endpoint `POST /api/documents/transport-note?layout=horizontal\|vertical`. Шапка/реквизиты/таблица товаров с НДС/итоги/строка «Товар к доставке принял»/подписи. **Координаты ячеек — baseline**, точная калибровка под шаблон при первом запуске. |
| 10 | cmr (международная) | ✅ | ✅ DONE 2026-05-13. `generateCmr(CmrData)` через `HWPFDocument.replaceText` на шаблоне `CMR Международная товарно-транспортная накладная.doc`. DTO с международными реквизитами: `shipperCountry/Gln`, `consigneeCountry/Gln`, `carrierName/vehicleNumber/driverName`, `placeOfLoading/Delivery`, `loadingDate/deliveryDate`, `currency` (default EUR), `hsCode` для HS-классификации товаров, веса/объёмы/задекл. стоимость, 3 подписи (shipper/carrier/consignee). Mapper + кейс в `DocumentService.generateViaRpa`. **Шаблон требует `{{tokens}}` вручную** — список токенов и `{{itemsTable}}` см. `DocumentRpaService.generateCmr`. |

**Generator'ы для 5 типов закрыты 2026-05-13** (receipt-act с 2 шаблонами, invoice, transport-note, cmr, picking-list PDF). picking-list — только PDF, без POI-шаблона.

> **СТАТУС HP-1 НА 2026-05-13 ✅ ВСЁ ЗАКРЫТО.** Все 5 итераций generator'ов завершены: picking-list (PDF table) ✅, receipt-act (2 шаблона: HSSF xls для расхождений / RTF token-replace для нормальной приёмки) ✅, invoice (HWPF token-replace) ✅, transport-note (HSSF, 2 layout горизонт./вертик.) ✅, cmr (HWPF token-replace, междунар. реквизиты + currency) ✅. **Cleanup мёртвых типов** (`release-order`/`shipment-order`/`invoice-fact`/`discrepancy-act`) выполнен 2026-05-13 — удалены 3 case'а в `DocumentService.generateViaPdf` + 3 метода `generateReleaseOrderPdf/generateInvoiceFactPdf/generateDiscrepancyActPdf` в `PdfDocumentService` + 3 строки в `PdfDocumentServiceParameterizedTest` + DisplayName переписан с 14 на 10 типов. Compile + `:document-service:test` зелёные.
>
> **Что осталось у пользователя** (не код): калибровка координат ячеек в xls-шаблонах (`generateReceiptActXls`, `generateTransportNote` — baseline coords) + расстановка `{{tokens}}` в `.doc`/`.rtf` шаблонах (`blank-invojs.doc`, `Акт приемки.RTF`, `CMR ....doc`). Без этого generation запускается, но значения подставляются только в helper'ные клеточные позиции — текстовые токены пропускаются тихо.
>
> Дальше: HP-2 (warehouse-service + frontend) → Frontend миграция (DocumentsPage + ReceivePage кнопки) → §1.5.C export flow → §2 RPA каналы.

**Что нужно сделать:**

1. **Удалить `release-order`/`shipment-order`, `invoice-fact`, `discrepancy-act`** из:
   - `DocumentController` (4 endpoint'а).
   - `DocumentService` (методы `generateShipmentOrder`, `generateInvoiceFact`, `generateDiscrepancyAct`).
   - `DocumentRpaService` / `PdfDocumentService` (PDF-методы для них).
   - `stub-info` (массив `documentTypes` — снять 4 строки).
   - Тестов и Postman-коллекции `docs/postman/WMS-API-Collection.json`.

2. **Шаблоны уже в `backend/document-service/documents template/`**. Привязать в `DocumentRpaService`:
   - `Акт приемки.RTF` — для `receipt-act` **без расхождений** (RTF: парсить через Apache POI Scratchpad `HWPFDocument`).
   - `Акт расхождения.xls` — для `receipt-act` **с расхождениями** (выбор шаблона внутри `generateReceiptAct` по `data.hasDiscrepancies()`).
   - `blank-invojs.doc` — для `invoice` (`obrazec-invojs.doc` — образец для reference).
   - `tn-gor.xls` + `tn-vert.xls` — для `transport-note`. Параметр `?layout=horizontal|vertical` (default — horizontal).
   - `ttn-gor.xls` + `ttn-vert.xls` — для `waybill` (доп. формы). Параметр `?layout=horizontal|vertical`. Существующий `ттнls.xls` оставить как default-шаблон.
   - `CMR Международная товарно-транспортная накладная.doc` — для `cmr`.

3. **В `DocumentService.java`** добавить case'ы:
   ```java
   case "receipt-act"     -> rpaService.generateReceiptAct(mapToReceiptActData(data));   // выбор шаблона внутри
   case "invoice"         -> rpaService.generateInvoice(mapToInvoiceData(data));
   case "transport-note"  -> rpaService.generateTransportNote(mapToTransportNoteData(data), layout);
   case "cmr"             -> rpaService.generateCmr(mapToCmrData(data));
   case "picking-list"    -> pdfService.generatePickingListPdf(mapToPickingListData(data));  // только PDF
   ```

4. **В `DocumentRpaService.java`** добавить 4 generate-метода (receipt-act, invoice, transport-note, cmr) по паттерну существующего `generateReceiptOrder`.
   - `generateReceiptAct(ReceiptActData)` — внутри `if (data.hasDiscrepancies()) loadTemplate("Акт расхождения.xls"); else loadTemplate("Акт приемки.RTF");`.
   - Для `transport-note` / `waybill` — выбор шаблона по `layout` параметру.
   - В `PdfDocumentService` — `generatePickingListPdf(PickingListData)`: шапка «Лист подбора № {shipmentNumber}» + 6-колоночная таблица.

5. **DTO в `document-service/dto/`**:
   - `ReceiptActData` — поля п.40 N 1290 (см. §0.1 Q1): шапка, организация, поставщик, договор, время начала/окончания приёмки, состояние пломб/тары, способ определения количества, **List<DiscrepancyItem> discrepancies** (опционально, если empty → нет расхождений), излишки, заключение о причинах, утверждение руководителем, ТНПА, председатель комиссии.
   - `InvoiceData`, `TransportNoteData`, `CmrData` — стандартные реквизиты + `currency: String` для invoice/transport-note (см. §0.1 Q4).
   - `PickingListData` — `shipmentNumber: String` + `List<PickingItem>(productName, sku, batchNumber, location, quantity, unit)`.

6. **Сверка с обязательными реквизитами БР-законодательства** (то что **должно** быть на каждом документе):
   - **УНП плательщика и получателя** (Беларусь, 9 цифр) — у нас в коде поле `unp` остаётся.
   - **БИК / ОКПО / юр. адрес** — нужны на формальных формах (ТН, ТТН, инвойс-фактура).
   - **Серия и номер документа** — `documentNumber` уже есть в DTO.
   - **Реквизиты ответственного** — `responsiblePerson`/`acceptedBy`/`receivedBy`.
   - **Место для печати/подписи** — оставляется пустым в шаблоне POI, заполняется в типографии при печати.

7. **PDF-генераторы** в `PdfDocumentService` уже работают для всех 14 — но они отрисовывают **простые table-row построчно**, без реквизитов БР. Если надо привести PDF в соответствие с госформами — переделать через `PDPageContentStream.drawImage()` с embedded формой как фон + наложение текста в координаты.

**Acceptance:**
- Все **10 типов** работают на `?format=pdf`, `?format=xls`, `?format=docx`.
- `release-order`, `shipment-order`, `invoice-fact` полностью удалены (endpoint, DTO, generator, PDF-метод, маппер, тесты, Postman).
- В сгенерированных XLS/DOCX присутствуют все обязательные реквизиты РБ.
- `transport-note` принимает `?layout=horizontal|vertical`, выбирает соответствующий шаблон.
- Тесты для маппера/генератора — **только по явному запросу пользователя** (memory `feedback_backend_first_no_tests`).

**Файлы для изменения:**
- `backend/document-service/documents template/` — шаблоны уже на месте, добавлять не нужно.
- `backend/document-service/src/main/java/by/bsuir/documentservice/controller/DocumentController.java` — удалить 3 endpoint'а.
- `backend/document-service/src/main/java/by/bsuir/documentservice/service/DocumentService.java` — снять 2 метода, добавить 5 `case`'ов + mappers.
- `backend/document-service/src/main/java/by/bsuir/documentservice/rpa/DocumentRpaService.java` — добавить 5 generate-методов.
- `backend/document-service/src/main/java/by/bsuir/documentservice/rpa/PdfDocumentService.java` — удалить методы для дропнутых типов.
- `backend/document-service/src/main/java/by/bsuir/documentservice/dto/` — 5 новых DTO.
- `docs/postman/WMS-API-Collection.json` — снять 3 запроса.

**Оценка: 1.5-2 дня** (шаблоны готовы → отпадает закупка форм; 5 mappers + generate-методов × ~30 мин + удаление 2 типов × ~15 мин + ревью БР-полей).

### HP-2. Пагинация на всех list-endpoints 🟡 В ПРОЦЕССЕ

**Эталон готов на Suppliers + product-service закрыт 2026-05-13:**
- Backend pattern: `*Repository` (рядом со старыми `List<>` — `Page<>` перегрузки с `Pageable`), `*Service` (overload `getAll(..., Pageable) → Page<X>` рядом со старым `List<X>`), `*Controller` (`@PageableDefault(size=20, sort="...", direction=...)` + локальный `MAX_PAGE_SIZE=100` + `capSize()` helper). Контракт ответа — `Page<X>` (`content`, `totalElements`, `totalPages`, `number`, `size`) — **breaking** для фронта.
- Frontend pattern (по эталону Suppliers): сервис принимает `{page,size,sort}`, default `size=1000` для autocomplete-кейсов; страница — локальный state + MUI `<TablePagination>` с 10/20/50/100 и RU-локализацией.

**✅ product-service — 10 endpoint'ов закрыто 2026-05-13** (15 файлов изменено, compile + 186 тестов зелёные):

| Endpoint | Default sort |
|---|---|
| `GET /api/supplies` | `createdAt DESC` |
| `GET /api/operations/ship-requests` | `createdAt DESC` |
| `GET /api/products` | `name ASC` |
| `GET /api/products/category/{c}` | `name ASC` |
| `GET /api/products/{p}/batches` | `createdAt DESC` |
| `GET /api/batches` | `createdAt DESC` |
| `GET /api/inventory/warehouse/{w}` | `lastUpdated DESC` |
| `GET /api/inventory/product/{p}` | `lastUpdated DESC` |
| `GET /api/operations/write-off/marked-items` | `countId DESC` |
| `GET /api/erp-extractor/deliveries` | `expectedDate ASC` |

Старые `List<X>` методы в service-слое **сохранены** для autocomplete-кейсов и внутренних вызовов (FEFOService и пр.). Только controller теперь возвращает `Page<X>`.

**Тесты, поправленные под Page-контракт:**
- `ProductControllerTest.java` — добавлен `import org.springframework.data.domain.{Page,PageImpl,PageRequest,Pageable}`, замокан `getAllProducts(Pageable)` и `getProductsByCategory(eq("..."), any(Pageable.class))`.
- `ProductControllerIntegrationTest.java` — добавлен `PageableHandlerMethodArgumentResolver` в `MockMvcBuilders`, jsonPath переписан с `$.length()` на `$.content.length()` + `$.totalElements`.

**✅ warehouse-service — 3 endpoint'а закрыто 2026-05-13** (6 файлов: 2 repo + 2 service + 2 controller, + 2 test class):

| Endpoint | Default sort |
|---|---|
| `GET /api/warehouses` (свои склады) | `name ASC` |
| `GET /api/warehouses/organization/{orgId}` | `name ASC` |
| `GET /api/racks/warehouse/{warehouseId}` | `name ASC` |

**Не пагинированы намеренно:** `GET /api/racks/{rackId}/cells` (`getCellsByRack`) и `GET /api/racks/{rackId}/slots` (`getSlotsByRack`) — polymorphic response по `rack.kind` (4 разных entity-типа SHELF/CELL/FRIDGE/PALLET через 4 разных repository), типично ≤100 элементов на стеллаж, Page-friendly контракт смешанной коллекции потребовал бы либо общего интерфейса для всех 4 entity, либо отдельных endpoint'ов per-kind. Не оправдано на текущем этапе.

**Тесты warehouse-service, поправленные под Page-контракт:**
- `WarehouseControllerTest.java` — `getWarehousesByOrganization_ShouldReturnPageOfWarehouses` (мок на `getWarehousesByOrganization(eq(orgId), any(Pageable.class))` через `PageImpl<>`).
- `WarehouseControllerIntegrationTest.java` — добавлен `PageableHandlerMethodArgumentResolver` в `MockMvcBuilders`, 3 теста переписаны на `$.content.length()` + `$.content[0].name` + `$.totalElements`.

**⏳ Открыто (frontend, ~1 день):**
- `SuppliesPage` — добавить `<TablePagination>`, локальный state `{page, rowsPerPage}`, сервис принимает `{page,size}`.
- `ShipPage` — requests + history табы (потребитель `shipRequestService` + `productService.getOperationsHistory`).
- `ReceivePage` history tab.
- `AnalyticsPage` Operations tab.
- `DocumentsPage` (новый — это §1.5 Frontend миграция, UI поверх уже-paginated `/api/document-registry`).
- Сервисы фронта (`supplyService`, `shipRequestService`, `productService.getOperationsHistory`) — менять сигнатуру `list({page, size, sort})` по эталону `supplierService` с default `size=1000` для autocomplete-кейсов.

Acceptance в `BACKEND_HP_BACKLOG.md §HP-2`.

---

## 1.5 Сопутствующие задачи (QUESTIONS.md ответы) 🔥 NEW

Производные от решений в `QUESTIONS.md` (см. §0.1). Делаются **в связке с HP-1**, так как HP-1 без них работает «в воздух» (документы in-memory, нет номеров, нет flow PAUSED).

> **СТАТУС НА 2026-05-13.** Фундамент §1.5 P0 закрыт: §1.5.D ✅, §1.5.A (compose + entity + registry + endpoints) ✅, §1.5.A (stateless document-service) ✅, §1.5.B (status PAUSED + всегда-акт + 3 endpoint'а complete/discrepancy/approve) ✅. Compile + unit-tests зелёные на обоих сервисах. Что НЕ сделано в этом sprint'е: §1.5.C export flow (P1), §1.5.E inventory tooltip (P1, фронт), HP-1 generator'ы новых шаблонов, миграция фронта на `/api/document-registry`, RPA-канал документа `receipt-act` использует один шаблон (PDF) — выбор между `Акт приемки.RTF` (без расхождений) и `Акт расхождения.xls` (с расхождениями) сделаем в HP-1 при подключении POI-шаблонов.

### Wiring справка для §1.5 (DONE)

Полная wiring-карта документной подсистемы (MinIO + GeneratedDocument + DocumentNumberService + DocumentRegistryService + 10 типов + RPA-канал) — в memory `project_wms_subsystems`. Schema в `sql-scripts/productDB.sql` (Flyway удалён 2026-05-17, см. §4.1).

> Примечание для новой сессии: ниже в §1.5.A/B/C/D описаны **исторические TODO** — все DONE. Acceptance secs полезны для контекста, реализация — в коде + git log.

### Детали (✅ сделано, ⏳ осталось)

### 1.5.A. MinIO + GeneratedDocument registry (Q1+Q2) — ✅ DONE (2026-05-13)

**Что:**
1. **MinIO** в `docker-compose.yml`: сервис `minio/minio` с томом, портами 9000 (API) и 9001 (console). Bucket `wms-documents`. Креды через env.
2. **`product_db` → таблица `generated_documents`** (DDL в `sql-scripts/productDB.sql` + Flyway `V5__generated_documents.sql`):
   ```sql
   CREATE TABLE generated_documents (
       id UUID PRIMARY KEY,
       organization_id UUID NOT NULL,
       operation_id UUID,                    -- FK к product_operation_events, может быть NULL для standalone
       document_type VARCHAR(50) NOT NULL,
       document_number VARCHAR(50) NOT NULL,
       minio_object_key VARCHAR(255) NOT NULL,
       file_format VARCHAR(10) NOT NULL,      -- pdf / xls / docx
       generated_by UUID NOT NULL,
       generated_at TIMESTAMP NOT NULL,
       payload JSONB,                          -- для регенерации
       UNIQUE(organization_id, document_type, document_number)
   );
   CREATE INDEX idx_gen_docs_org_op ON generated_documents(organization_id, operation_id);
   ```
3. **product-service**:
   - Entity `GeneratedDocument` (по pattern read-model) + `GeneratedDocumentRepository`.
   - `DocumentRegistryService.register(operationId, type, payload, organizationId, userId) → GeneratedDocument`:
     - Дёрнуть `DocumentClient.generate*(payload)` → получить PDF bytes.
     - Сгенерить номер через `DocumentNumberService.next(orgId, type)`.
     - Залить в MinIO под ключ `{orgId}/{year}/{type}/{number}.pdf`.
     - Сохранить row в `generated_documents`.
   - `MinioClient` (Spring bean) — стандартный `io.minio:minio:8.5.x`.
4. **Заменить in-memory `DocumentService.records`** в document-service на stateless: document-service просто возвращает bytes. Регистрация — в product-service.
5. **Новые endpoint'ы в product-service**:
   - `GET /api/operations/{operationId}/documents` → список (paginated).
   - `GET /api/documents/{id}/download` → presigned URL MinIO (TTL 15 минут) или прямой stream.
   - `GET /api/documents` (paginated, фильтры: тип, дата, отделение).
6. **Frontend**:
   - Новая страница `DocumentsPage` (для WORKER + ACCOUNTANT): список документов с фильтрами по типу/дате/операции, скачивание.
   - На ReceivePage/ShipPage — секция «Документы операции» с inline-списком.

**Зависимости (`product-service/build.gradle`):**
```groovy
implementation 'io.minio:minio:8.5.10'
```

**Оценка: 2-2.5 дня** (compose + миграция + entity/service + 3 endpoint'а + 1 страница фронта).

### 1.5.B. Receive workflow: статус PAUSED + всегда-акт приёмки (Q1+Q3) — ✅ DONE (2026-05-13)

**Что:**
1. **ProductOperation** — добавить enum `OperationStatus { PENDING, RECEIVED, PAUSED, COMPLETED }`. Колонка `status` в `product_operation_events` + read-model. Миграция Flyway `V6__operation_status.sql`.
2. **OperationController.receiveProduct** — после `receiveProduct()`:
   - Создать `ReceiveSagaState` (уже есть).
   - **Всегда** генерить `receipt-act` через `DocumentRegistryService.register("receipt-act", payload, ...)` с пустым `discrepancies: []` → шаблон `Акт приемки.RTF`.
   - Также генерить `receipt-order` (как сейчас).
   - Установить `OperationStatus.PAUSED` — операция ждёт «продолжить» (WORKER подтверждает приёмку) или «зафиксировать расхождение» (WORKER заполняет форму расхождений).
3. **Endpoint'ы** (WORKER, кладовщик = МОЛ, директорское утверждение снято 2026-05-13 — кладовщик материально-ответственное лицо и подписывает акт сам):
   - `POST /api/operations/{id}/complete` (WORKER) — статус `PAUSED → COMPLETED`.
   - `POST /api/operations/{id}/discrepancy` (WORKER) — принимает `List<DiscrepancyItem> discrepancies` (productId, expectedQty, actualQty, defectDescription). **Перегенерирует** `receipt-act` с шаблоном `Акт расхождения.xls`, новый документ в MinIO + БД, **сразу `PAUSED → COMPLETED`**.
   - ~~`POST /api/operations/{id}/approve`~~ — удалён (мёртвый код, не нужен).
4. **Frontend ReceivePage**:
   - После приёмки на странице операции — два больших action-button'а: «Принять без замечаний» / «Зафиксировать расхождение».
   - Форма расхождений: для каждого товара — фактическое количество + описание дефекта.
   - После submit'а — операция в `PAUSED`, видна в списке «Незавершённые приёмки».

**Что НЕ делаем** (Q3 ответ): SMTP-уведомления поставщику, 24-часовой таймер, регистрация ответа представителя. Это операционная ответственность сотрудников вне системы.

**Оценка: 2-3 дня** (статус + 3 endpoint'а + миграция + 2 формы фронта).

### 1.5.C. Export flow: чекбокс + ТН/ТТН/CMR пакет (Q4) — ✅ DONE (2026-05-13)

**Что:**
1. **ShipmentRequest** — добавить `shipmentType: ShipmentType { DOMESTIC, EXPORT }` + `currency: String` (ISO 4217 — BYN/USD/EUR/RUB; default `BYN`). Миграция `V7__shipment_export.sql` (V4-V6 уже заняты, см. §1.5 «Что появилось в коде»).
2. **ShipPage**:
   - Чекбокс **«На экспорт»**. По умолчанию выключен.
   - **Выключен** (внутренняя отгрузка): radio «ТН / ТТН» + radio «горизонтальная / вертикальная». При submit генерируется один документ.
   - **Включён** (экспорт): валюта (dropdown USD/EUR/RUB), GLN получателя (опционально), страна получателя. При submit генерируется пакет **{ТН + CMR + invoice}**.
3. **Saga** — `DOCUMENT_GENERATION` step: вместо одного `documentId` массив `documentIds: List<UUID>`. `ShipSagaState.documentId` → `documentIds: List<UUID>`. Миграция `saga_state.payload` JSON.
4. **product-service** — `ShipmentService.generateShipmentDocuments(request)`:
   - Если `DOMESTIC`: `DocumentRegistryService.register(layout == HORIZONTAL ? "tn-gor" : "tn-vert", ...)` — один документ. (по выбору ТТН/ТН аналогично).
   - Если `EXPORT`: три вызова подряд (ТН + CMR + invoice), все три uploadятся в MinIO, привязаны к одной `operationId`. Транзакционная семантика на уровне saga: если один из трёх упал — компенсация откатывает уже залитые.
5. **Saga compensation** — расширить `compensateShipSaga`: удалить все объекты в MinIO по ключам в `documentIds`, чистить `generated_documents` rows.

**Оценка: 2-3 дня** (миграции + DTO + saga правки + 1 страница фронта расширение).

**Что закрыто 2026-05-13 (backend):**
- Миграция `V7__shipment_export.sql` + DDL в `sql-scripts/productDB.sql`: 6 колонок (`shipment_type`, `currency`, `document_layout`, `domestic_document_kind`, `recipient_country`, `recipient_gln`).
- Enums: `ShipmentType { DOMESTIC, EXPORT }`, `DocumentLayout { HORIZONTAL, VERTICAL }`, `DomesticDocumentKind { TN, TTN }`.
- `ShipmentRequest` entity — 6 новых полей + дефолты в `@PrePersist`.
- `CreateShipmentRequestRequest` + `ShipmentRequestResponse` records — расширены (включая `documentIds: List<UUID>` в response для свежего complete-ответа).
- `ShipSagaState.documentId: UUID` → `documentIds: List<UUID>` + helper `addDocumentId(...)`.
- `SagaOrchestrator.markShipStepCompleted` — switch `DOCUMENT_GENERATION` теперь принимает и legacy `documentId`, и новый `documentIds: List<UUID>` через `extractDocumentIds(...)` (backward-compat для тестов).
- `SagaOrchestrator.compensateShipSaga` — реально удаляет все документы из MinIO + `generated_documents` через `documentRegistryService.deleteDocument(...)` (optional autowire — если bean не доступен, log.warn).
- `DocumentRegistryService.deleteDocument(documentId, organizationId)` — новый метод: `RemoveObjectArgs` в MinIO + `repository.delete(...)`. Идемпотентно.
- `ShipmentRequestService.create(...)` — пробрасывает 6 новых полей + валидация «EXPORT с BYN запрещено».
- `ShipmentRequestService.complete(requestId, userId, organizationId)` — после inventory/operations вызывает `generateShipmentDocuments(...)`:
  - `DOMESTIC` + `TN` → `transport-note`; `DOMESTIC` + `TTN` → `waybill`; layout (HORIZONTAL/VERTICAL) уходит в payload `layout`.
  - `EXPORT` → пакет `transport-note` + `cmr` + `invoice` (все три привязаны к первой `operationId` отгрузки, currency в payload).
- `ShipmentRequestController.complete` — больше не принимает `body.documentTypes`, берёт `X-User-Id` + `X-Organization-Id` из headers.
- Тесты: `ShipmentRequestServiceTest` (+ `@Mock DocumentRegistryService` + 6 null-параметров в DTO), `ShipmentRequestContainerTest`, `ShipSagaFullContainerTest` — поправлены под новый constructor `CreateShipmentRequestRequest`. `:product-service:test` зелёный.

**Что закрыто 2026-05-13 (frontend):**
- `client/src/validation/schemas.js` — `shipRequestSchema` расширена: `shipmentType` (DOMESTIC/EXPORT, default DOMESTIC), `currency` (ISO 4217, **conditional** через `yup.when` — EXPORT запрещает BYN), `documentLayout` (HORIZONTAL/VERTICAL, default HORIZONTAL), `domesticDocumentKind` (TN/TTN, default TN), `recipientCountry`, `recipientGln`.
- `client/src/pages/ShipPage.js` `CreateRequestDialog`:
  - `defaultValues` + `reset(...)` — 6 новых полей.
  - Шаг 1 «Получатель и документы»: после комментария — divider «Документы отгрузки», чекбокс «На экспорт» (Controller, при переключении сбрасывает `currency` через `reset({...getValues(), shipmentType, currency})` чтобы yup не блокировал).
  - **DOMESTIC** (чекбокс выключен): два радио-блока — `domesticDocumentKind` (ТН/ТТН) + `documentLayout` (горизонтальная/вертикальная).
  - **EXPORT** (чекбокс включён): dropdown валюта (`EXPORT_CURRENCIES = [USD, EUR, RUB, CNY]`) + `recipientCountry` + `recipientGln`.
  - Шаг 3 «Подтверждение» — добавлено summary: «Тип отгрузки», «Документы» (ТТН/ТН+ориентация или «ТН + CMR + инвойс»), «Получатель (экспорт)» с GLN.
  - `onSubmit` пробрасывает 6 новых полей в `shipRequestService.create(...)`. DOMESTIC-поля nullable при EXPORT, и наоборот.
  - `steps[0].fields` расширен — RHF проверяет все новые поля перед переходом на шаг 2.
- `client/src/services/shipRequestService.js` — `complete(requestId)` без параметра `body` (раньше принимал `body.documentTypes`).
- `client/src/pages/ShipPage.js handleComplete` — снят `{}`-параметр в вызове `complete()`.
- `npm run build` (DISABLE_ESLINT_PLUGIN=true) — **Compiled successfully**. Только pre-existing warnings про неиспользуемый `React`-импорт.

### 1.5.D. DocumentNumberService (Q7) — ✅ DONE (2026-05-13)

**Что:**
1. **`product_db` → таблица `document_counters`** (Flyway `V4__document_counters.sql`):
   ```sql
   CREATE TABLE document_counters (
       organization_id UUID NOT NULL,
       document_type VARCHAR(50) NOT NULL,
       year INT NOT NULL,
       counter BIGINT NOT NULL DEFAULT 0,
       PRIMARY KEY (organization_id, document_type, year)
   );
   ```
2. **product-service** — `DocumentNumberService.next(orgId, type) → String`:
   - SELECT FOR UPDATE по `(orgId, type, currentYear)`, INSERT если нет (counter=0).
   - `UPDATE document_counters SET counter = counter + 1 WHERE ... RETURNING counter`.
   - Префикс по типу: `ПО` (receipt-order), `АП` (receipt-act), `ТТН` (waybill), `ТН` (transport-note), `CMR`, `ИНВ` (inventory-report), `ПЕР` (revaluation), `СПС` (write-off), `И` (invoice), `ЛП` (picking-list).
   - Формат: `{ПРЕФИКС}-{YYYY}-{NNNNN}` (5 цифр с ведущими нулями).
3. Использовать из `DocumentRegistryService.register(...)`.

**Оценка: 0.5 дня.**

### 1.5.E. Frontend мелочи (Q6) — ✅ DONE (2026-05-13)

- **Q6**: ✅ Tooltip на кнопке «Начать сессию» в `InventoryPage.js`: «По НСБУ № 126 — не ранее 30 сентября для активов, не ранее 30 ноября для денежных средств; обязательна перед годовой отчётностью, при реорганизации, смене МОЛ, факте хищения». MUI `<Tooltip arrow placement="bottom">`. `EmptyState` теперь без `actionLabel/onAction` — кнопка вынесена в отдельный `Box` ниже, обёрнута в Tooltip.

### 1.5.F. Что НЕ делаем (зафиксировано)

- **Q5** скоропортящиеся товары (поле `perishable` + таймеры приёмки) — не реализуем.
- **Q9** ЭТТН/ЭТН — игнорируем, не упоминаем в README.
- SMTP-уведомления поставщику при расхождении (часть Q3) — не делаем.
- 24-часовой таймер для актов о скрытых недостатках — не делаем.

### 1.5.G. Итого по §1.5

| Подзадача | Оценка | Приоритет |
|---|---|---|
| 1.5.A MinIO + GeneratedDocument | 2-2.5 дня | **P0** |
| 1.5.B Workflow PAUSED + всегда-акт | 2-3 дня | **P0** |
| 1.5.D DocumentNumberService | 0.5 дня | **P0** |
| 1.5.C Export flow | 2-3 дня | P1 |
| 1.5.E Inventory tooltip | 0.5 ч | P1 |

**Итого: ~5 дней (P0) + ~2.5 дня (P1).**

Порядок: **1.5.D → 1.5.A → HP-1 → 1.5.B → 1.5.C → 1.5.E**. 1.5.D и 1.5.A — фундамент, без них HP-1 регистрировать документы некуда. После 1.5.A можно подключать HP-1 generator'ы. После HP-1 — workflow B. C и E — параллельно.

---

## 2. RPA-расширение ⏳ PARTIAL (RPA-2 ✅, RPA-1 ждёт E2E)

**Контекст.** Зафиксировано 2026-05-12: RPA-блок включает **два независимых вида**:
1. **RPA-1: чтение данных из локального 1С** (плановые поставки и т.п.).
2. **RPA-2: заполнение Office-шаблонов локально** (Word/Excel боты для документов на машине пользователя).

Селениум-каналы (web-ERP бот, Google Docs бот) **отброшены** — Selenium для web, а нам нужно работать с локальным 1С и локальным Office.

### 2.0 Сводная картина — 2 канала RPA

| # | Канал | Тип | Где живёт | Что делает | Приоритет |
|---|---|---|---|---|---|
| **RPA-1** | **1С → read-only парсинг** | Desktop UI bot | `product-service/rpa/OneCWinAppExtractorImpl` | У используемой инсталляции 1С **нет открытого API** (нет OData / HTTP-сервисов). Бот через WinAppDriver запускает 1С толстый клиент, логинится read-only пользователем, открывает журнал «Поступление товаров и услуг», **парсит таблицу** строки за строкой, маппит в `PlannedDelivery`, закрывает 1С. Никаких записей/проведений документов. | **P0** |
| **RPA-2** | **Office → заполнение шаблона** | Desktop UI bot | `document-service/rpa/OfficeDocumentBot` | Бот реально открывает MS Word / Excel локально, заполняет шаблон из `documents template/`, сохраняет PDF/XLSX/DOCX. Демонстрирует «настоящий RPA» на защите. WinAppDriver/Appium (рекомендуемый — общий стек с RPA-1) или JACOB (COM bridge, резерв). | **P0** (для защиты) |

Existing Apache POI + PDFBox (server-side генерация документов, `DocumentRpaService` / `PdfDocumentService`) — **primary** способ генерации. RPA-2 (`OfficeDocumentBot`) — это RPA-демо поверх, не замена POI.

Существующие `RpaHtmlExtractorImpl` (Jsoup) и `ApiExtractorImpl` (REST к mock-erp) — **dev-fallback'и** для разработки без реального доступа к 1С, в production-режиме (RPA-1) не используются. MockErpController остаётся для локального тестирования.

WinAppDriver/Appium стек переиспользуется в RPA-1 и RPA-2 — один driver-процесс, общая зависимость `io.appium:java-client`. **OData/HTTP-сервисы 1С не рассматриваются** — пользователь зафиксировал что в его инсталляции их нет.

### 2.1 Текущее состояние (dev-fallback)

Существующие классы остаются как fallback для разработки без реального 1С. В production-режиме (RPA-1) переключаемся на `OneCWinAppExtractorImpl` через `erp.extraction.mode=onec`.



```
product-service/src/main/java/by/bsuir/productservice/rpa/
├── PlannedDeliveryExtractor.java       — интерфейс (extractDeliveries() : List<Map>)
├── RpaHtmlExtractorImpl.java           — @Component("rpaExtractor"), Jsoup HTML scraping
│                                          ├── POST /mock-erp/login (form-encoded admin/admin)
│                                          ├── GET  /mock-erp/deliveries  (с cookies)
│                                          └── parse <table#deliveries-table>
├── ApiExtractorImpl.java               — @Component("apiExtractor"), REST/JSON
└── ErpExtractorJob.java                — @Scheduled(cron="0 0 3 * * *"), 
                                          @Qualifier(rpaExtractor|apiExtractor) по settings
                                          erp.extraction.mode=rpa|api
                                          манул через POST /api/erp-extractor/run
```

**Что делает `ErpExtractorJob`:**
1. Берёт `extractor.extractDeliveries()` → `List<Map<String,Object>>` с полями `externalId`, `supplierName`, `productName`, `expectedQuantity`, `expectedDate`.
2. По `externalId` дедупликация — если `planned_deliveries.externalId` уже есть, пропускает.
3. Сохраняет `PlannedDelivery` в БД.
4. Логирует в `extraction_log` (success/failure, найдено/новых).
5. Публикует RabbitMQ-событие `product.planned_delivery_received` для downstream.

### 2.2 RPA-2 — `OfficeDocumentBot` (локальная автоматизация MS Word / MS Excel)

**Цель.** Бот реально открывает **MS Word или MS Excel** на машине, открывает шаблон из `documents template/`, заполняет placeholder'ы / ячейки данными из WMS, сохраняет результат как `.docx`/`.xlsx`/`.pdf`. На защите — запускаем не-headless, комиссия видит как Word/Excel открывается, бот печатает в поля, сохраняет файл. **Это и есть «настоящий RPA»** (UI Automation на desktop), в отличие от Apache POI (server-side library).

**Selenium здесь не используется** — он для web. Для локального Office берём один из двух движков:

| Движок | Что делает | Плюсы | Минусы |
|---|---|---|---|
| **WinAppDriver (Appium)** | UI Automation API Windows: ищет элементы по `AccessibilityId`/`Name`, кликает, печатает | Тот же стек что RPA-1 (1С толстый) — один driver, общие зависимости `io.appium:java-client` + WinAppDriver.exe. Универсально работает с любым Win-app. | Чуть хрупче на формулах Excel (нужно ждать пересчёта); ребро по селекторам в Office Ribbon. |
| **JACOB (Java COM Bridge)** | Драйвит `Word.Application` / `Excel.Application` через COM | Чистый COM API: `app.Workbooks.Open`, `sheet.Cells(row,col).Value = "..."`. Стабильно, не зависит от UI-разметки. | Только Windows + MS Office установлен. Native DLL `jacob-x64.dll` нужно положить в PATH. |

**Рекомендованный путь — WinAppDriver** для консистентности с RPA-1 (один стек на оба desktop-канала). JACOB — резерв для случаев когда Excel-formulas нестабильно отрабатывают через UI Automation.

**Расположение:** `document-service/src/main/java/by/bsuir/documentservice/rpa/OfficeDocumentBot.java`

**Зависимости (`document-service/build.gradle`):**
```groovy
// Вариант 1 — WinAppDriver (общий с каналом D)
implementation 'io.appium:java-client:9.3.0'
implementation 'org.seleniumhq.selenium:selenium-java:4.27.0'

// Вариант 2 — JACOB (резерв)
implementation 'com.hynnet:jacob:1.18'   // или net.sf.jacob-project:jacob
```

**Среда (одноразово):**
1. **Windows 10+** с **MS Word + MS Excel** установленным (часть Office 365 или 2019+).
2. WinAppDriver запущен как сервис (`http://127.0.0.1:4723`) — тот же что для RPA-1 варианта B.
3. Для JACOB: положить `jacob-1.20-x64.dll` в `java.library.path` (либо в `<JDK>/bin`).

**Сценарий бота (на примере приходного ордера):**
1. Получает `templatePath` (например `documents template/Приходной ордер.XLS`) + `Map<String,Object> placeholders`.
2. Открывает Excel: либо WinAppDriver запускает `excel.exe` с шаблоном, либо JACOB: `new ActiveXComponent("Excel.Application")` → `Workbooks.Open(templatePath)`.
3. По карте placeholder'ов проходит по ячейкам / параграфам и записывает значения.
4. Сохраняет через `File → Save As → PDF` (или COM: `wb.SaveAs(filename, FileFormat=57)` — `xlTypePDF`).
5. Возвращает `byte[]` сгенерированного файла.

**Скетч (WinAppDriver вариант):**
```java
@Component @Slf4j @RequiredArgsConstructor
public class OfficeDocumentBot {

    @Value("${rpa.office.driver-url:http://127.0.0.1:4723}") private String driverUrl;
    @Value("${rpa.office.headless:false}") private boolean headless;
    @Value("${rpa.office.downloads-dir:logs/rpa-office}") private String downloadsDir;

    public Path fillExcelTemplate(Path templatePath, Map<String,Object> placeholders) throws Exception {
        DesiredCapabilities caps = new DesiredCapabilities();
        caps.setCapability("app", "C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE");
        caps.setCapability("appArguments", "\"" + templatePath.toAbsolutePath() + "\"");

        WindowsDriver driver = new WindowsDriver(new URL(driverUrl), caps);
        try {
            // Ждём загрузки книги
            new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(d -> driver.findElementByAccessibilityId("NetUIHWND"));

            // Заполняем ячейки через Name Box (адресная строка ячеек, AccessibilityId="NameBox")
            for (var entry : placeholders.entrySet()) {
                String cellAddress = entry.getKey();     // например "B3"
                String value       = String.valueOf(entry.getValue());

                WebElement nameBox = driver.findElementByAccessibilityId("NameBox");
                nameBox.clear();
                nameBox.sendKeys(cellAddress + Keys.ENTER);
                driver.getKeyboard().sendKeys(value + Keys.TAB);
            }

            // Save As PDF: File → Export → Create PDF (Ctrl+P → PDF)
            return saveAsPdf(driver, downloadsDir);
        } finally {
            driver.quit();
        }
    }
}
```

**Скетч (JACOB вариант, как резерв):**
```java
ActiveXComponent excel = new ActiveXComponent("Excel.Application");
excel.setProperty("Visible", new Variant(!headless));
Dispatch workbooks = excel.getProperty("Workbooks").toDispatch();
Dispatch wb = Dispatch.call(workbooks, "Open", templatePath.toString()).toDispatch();
Dispatch sheet = Dispatch.get(wb, "ActiveSheet").toDispatch();

for (var e : placeholders.entrySet()) {
    Dispatch cell = Dispatch.invoke(sheet, "Range", Dispatch.Get, new Object[]{e.getKey()}, new int[1]).toDispatch();
    Dispatch.put(cell, "Value", e.getValue().toString());
}

Path out = Paths.get(downloadsDir, UUID.randomUUID() + ".pdf");
Dispatch.call(wb, "ExportAsFixedFormat", 0 /*xlTypePDF*/, out.toString());
Dispatch.call(wb, "Close", false);
excel.invoke("Quit");
```

**Endpoint в `DocumentController`:**
```java
@PostMapping("/office/fill")
public ResponseEntity<byte[]> fillOfficeTemplate(@RequestBody OfficeFillRequest req) {
    Path pdf = bot.fillExcelTemplate(req.templatePath(), req.placeholders());
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_PDF)
        .body(Files.readAllBytes(pdf));
}
```

**Конфиги:**
```properties
rpa.office.engine=winapp                            # winapp | jacob
rpa.office.driver-url=http://127.0.0.1:4723
rpa.office.headless=false                            # на защите false
rpa.office.downloads-dir=logs/rpa-office
rpa.office.word-exe=C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE
rpa.office.excel-exe=C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE
```

**Подводные камни:**
- Если Office не установлен — оба варианта падают сразу при старте. Acceptance: на машине защиты MS Office должен быть.
- WinAppDriver видит элементы по `AccessibilityId` — для адресной строки ячеек Excel это `NameBox`, для ленты — `Ribbon`. Селекторы калибруются через **Accessibility Insights for Windows**.
- JACOB требует разрядность совпадающую с Java и Office (x64 для x64-Java + x64-Office).
- Сохранение в PDF через UI-флоу (`Ctrl+P → PDF`) дольше чем через COM `ExportAsFixedFormat`.

**Acceptance:**
- Endpoint `POST /api/documents/office/fill` с входным `templatePath` + `placeholders` возвращает PDF.
- На защите запуск с `rpa.office.headless=false` — комиссия видит как Excel/Word открывается, бот заполняет, сохраняет.
- Reuse: тот же endpoint покрывает все 10 типов документов через выбор `templatePath`.

**Оценка:** 1-1.5 дня (WinAppDriver + калибровка селекторов Excel/Word). +0.5 дня резервный JACOB-путь.

**Риски:**
- Office Ribbon/Save-as-PDF UI отличается между 2019/2021/365 — селекторы могут потребовать подстройки на машине защиты.
- На headless-CI работать не будет (нужен реальный Windows Desktop). Это RPA-демо для защиты, не auto-prod-канал.

### 2.3 RPA-1 — `OneCWinAppExtractorImpl` (read-only парсинг 1С через WinAppDriver)

**Цель.** Бот **только читает** данные из толстого клиента 1С (1cv8.exe). У используемой инсталляции 1С **нет открытого API** (нет OData-публикации, нет HTTP-сервисов) — единственный путь извлечь плановые поставки = UI-автоматизация поверх UI Automation API Windows. Никаких записей/проведений документов **не делаем**: только открыть нужный справочник/журнал, прочитать таблицу, выйти. Доступ к 1С — ожидаем.

**Что именно бот делает:**
1. Запускает `1cv8.exe`/`1cestart.exe` через WinAppDriver.
2. Логинится в выданную тестовую информационную базу (выданный пользователь с **read-only** правами).
3. Идёт в нужный журнал — обычно `Документы → Поступление товаров и услуг` (точное название зависит от конфигурации 1С пользователя).
4. Открывает список документов, итерирует строки видимой таблицы: дата, контрагент, номенклатура, количество, статус (проведён / не проведён).
5. Маппит каждую строку в `PlannedDelivery` (externalId = номер документа 1С, supplierName = контрагент, productName = номенклатура, expectedQuantity, expectedDate).
6. Закрывает 1С.
7. Возвращает `List<Map<String,Object>>` — тот же контракт что `PlannedDeliveryExtractor.extractDeliveries()`.

**Технический стек:**
- **WinAppDriver** ([https://github.com/microsoft/WinAppDriver](https://github.com/microsoft/WinAppDriver)) — официальный Microsoft, 4 МБ exe. Слушает на порту 4723. Реализует WebDriver-протокол для Windows-приложений.
- **Appium Java client** (`io.appium:java-client:9.x`) — Java SDK для WebDriver.
- **Selenium-core** транзитивно подтягивается с Appium (общий WebDriver-протокол).

**Расположение:** `product-service/src/main/java/by/bsuir/productservice/rpa/OneCWinAppExtractorImpl.java`

**Зависимости** (`product-service/build.gradle`):
```groovy
implementation 'io.appium:java-client:9.3.0'
implementation 'org.seleniumhq.selenium:selenium-java:4.27.0'
```

**Скетч:**
```java
@Component("oneCExtractor")
@Slf4j @RequiredArgsConstructor
public class OneCWinAppExtractorImpl implements PlannedDeliveryExtractor {

    @Value("${rpa.onec.driver-url:http://127.0.0.1:4723}") private String driverUrl;
    @Value("${rpa.onec.executable}") private String oneCExe;        // C:\\Program Files\\1cv8\\common\\1cestart.exe
    @Value("${rpa.onec.base-connection}") private String baseConn;  // "/IBConnectionString Srvr=...;Ref=..." или путь к файловой базе
    @Value("${rpa.onec.username}") private String username;
    @Value("${rpa.onec.password}") private String password;
    @Value("${rpa.onec.journal-name:Поступление товаров и услуг}") private String journalName;

    @Override public String getSourceName() { return "1C-RPA"; }

    @Override public List<Map<String,Object>> extractDeliveries() {
        DesiredCapabilities caps = new DesiredCapabilities();
        caps.setCapability("app", oneCExe);
        caps.setCapability("appArguments", "ENTERPRISE " + baseConn);

        WindowsDriver driver = new WindowsDriver(new URL(driverUrl), caps);
        try {
            // 1. Логин
            new WebDriverWait(driver, Duration.ofSeconds(30))
                .until(d -> driver.findElementByAccessibilityId("UsernameField"));
            driver.findElementByAccessibilityId("UsernameField").sendKeys(username);
            driver.findElementByAccessibilityId("PasswordField").sendKeys(password);
            driver.findElementByName("ОК").click();

            // 2. Открыть журнал документов поступления
            driver.findElementByName("Документы").click();
            driver.findElementByName(journalName).click();

            // 3. Прочитать таблицу строки за строкой
            WebElement table = new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(d -> driver.findElementByAccessibilityId("DocumentListTable"));
            List<WebElement> rows = table.findElements(By.xpath(".//*[@LocalizedControlType='элемент таблицы']"));

            List<Map<String,Object>> result = new ArrayList<>();
            for (WebElement row : rows) {
                List<WebElement> cells = row.findElements(By.xpath("./*"));
                if (cells.size() < 5) continue;
                Map<String,Object> d = new HashMap<>();
                d.put("externalId", cells.get(0).getText().trim());     // номер документа 1С
                d.put("expectedDate", cells.get(1).getText().trim());   // дата
                d.put("supplierName", cells.get(2).getText().trim());   // контрагент
                d.put("productName", cells.get(3).getText().trim());    // номенклатура (первая или агрегированная)
                d.put("expectedQuantity", cells.get(4).getText().trim());
                result.add(d);
            }
            return result;
        } finally {
            driver.quit();
        }
    }
}
```

**Конфиги:**
```properties
erp.extraction.mode=onec
rpa.onec.driver-url=http://127.0.0.1:4723
rpa.onec.executable=C:\\Program Files\\1cv8\\common\\1cestart.exe
rpa.onec.base-connection=/IBConnectionString Srvr=1c-srv;Ref=wms-test
rpa.onec.username=integration_user
rpa.onec.password=${ONEC_PASSWORD}
rpa.onec.journal-name=Поступление товаров и услуг
```

**Дедупликация и downstream — без изменений.** `ErpExtractorJob` берёт `List<Map>` от extractor'а, по `externalId` дедуплицирует, пишет в `planned_deliveries`, публикует RabbitMQ.

**Тесты:** только manual run. Автоматизировать в CI невозможно (нужен Windows + установленный 1С). Unit-тесты — на маппинг (нарезаем mocked `WebElement.getText()`).

**Что критично — read-only режим:**
- Пользователь 1С имеет **только право чтения** на нужные справочники/документы. Если бот случайно нажмёт «Удалить» — операция должна заблокироваться правами.
- Никаких `findElementByName("Удалить")`/`findElementByName("Провести")` в коде бота — только навигация и `.getText()`.
- На защите — запуск только на **тестовой копии** базы.

**Альтернативный demo-сценарий** если 1С не дадут вовремя:
- Macros в Excel-файле имитирующем 1С-журнал — бот читает строки.
- **Notepad/Calculator** для базового proof-of-concept (бот печатает текст / читает результат).

**Оценка:** 1-1.5 дня после получения доступа к 1С. +0.5-1 дня на калибровку селекторов через Accessibility Insights (зависит от конфигурации 1С пользователя — типовой УТ/УНФ/Бухгалтерия отличаются названиями журналов и структурой форм).

### 2.4 Архитектура (итоговая)

```
product-service/src/main/java/by/bsuir/productservice/rpa/
├── PlannedDeliveryExtractor.java       — interface
├── RpaHtmlExtractorImpl                — есть, Jsoup, dev-fallback (mode=rpa)
├── ApiExtractorImpl                    — есть, REST, dev-fallback (mode=api)
├── OneCWinAppExtractorImpl             — НОВОЕ (RPA-1, mode=onec) — read-only парсинг 1С через WinAppDriver
└── ErpExtractorJob                     — orchestrator (Strategy: @Qualifier по mode)

document-service/src/main/java/by/bsuir/documentservice/rpa/
├── DocumentRpaService                  — есть, Apache POI (server-side template, primary)
├── PdfDocumentService                  — есть, PDFBox (server-side PDF, primary)
└── OfficeDocumentBot                   — НОВОЕ (RPA-2), desktop UI bot для локального MS Word / MS Excel (WinAppDriver/Appium или JACOB)
```

**Reuse:** WinAppDriver/Appium стек (`io.appium:java-client`) — общая зависимость и общий driver-процесс для RPA-1 (1С толстый клиент, read-only) и RPA-2 (Office). Запускается один раз как Windows-сервис на dev/защитной машине.

### 2.5 Acceptance (целевое состояние RPA-блока)

- ✅ **RPA-1**: `erp.extraction.mode=onec` подключает `OneCWinAppExtractorImpl`. Бот через WinAppDriver открывает 1С толстый клиент, логинится read-only пользователем, парсит журнал «Поступление товаров и услуг», возвращает `List<Map>` строк. `POST /api/erp-extractor/run` пишет в `planned_deliveries`, лог в `extraction_log`. Никаких записей в 1С бот не делает.
- ✅ **RPA-2**: `POST /api/documents/office/fill` — бот реально открывает локальный MS Word/Excel, заполняет placeholder'ы из payload, сохраняет PDF. На защите запуск с `rpa.office.headless=false` — комиссия видит весь процесс.
- В пояснительной записке — скриншоты работы каждого бота, объяснение классификации RPA: server-side integration (POI, PDFBox) vs desktop UI automation (WinAppDriver на 1С и Office).

### 2.6 RPA-1: E2E прогон OneCWinAppExtractorImpl ⏳ PENDING

Код `OneCWinAppExtractorImpl` написан в прошлых сессиях. Доступ к базе `utdemo` получен 2026-05-15. **Не прогонялся end-to-end** из-за нескольких блокеров (теперь все закрыты в session 2026-05-16/17, см. §2.7). Осталось:

1. Поднять WinAppDriver (`http://127.0.0.1:4723`) на Windows + открыть базу 1С `utdemo`.
2. Через UI запустить `POST /api/erp-extractor/run?mode=onec` с body `{connectionId}` (см. §2.7.bis).
3. По логам `1C-RPA: найдено окон-кандидатов: N` / `найдено строк: M` калибровать XPath в `OneCWinAppExtractorImpl.readJournalTable` через **Accessibility Insights for Windows**.
4. Проверить маппинг колонок `0-4` (`externalId / expectedDate / supplierName / productName / expectedQuantity`).

**Оценка:** 0.5-1 день (зависит от того насколько журнал `Заказы поставщикам` в `utdemo` соответствует ожиданиям бота).

**RPA-2 Office bot уже закрыт** (см. memory `project_rpa_office_done` + §6 дорожная карта).

### 2.7 Открытые баги извлечения / отправки сообщений ✅ DONE 2026-05-16

**Контекст.** Доступ к 1С получен 2026-05-15 (база `utdemo`, конфигурация типовая, attach-mode на запущенное окно). При первом ручном прогоне `POST /api/erp-extractor/run` (без mode-параметра) запрос ушёл в режим `api` и упал на mock-erp с `MissingServletRequestParameterException: 'username'`. RPA-1 ветка `onec` пока **не проверена end-to-end**.

**Что чинить:**

1. **Извлечение данных — переключить дефолт на `onec`.** Сейчас:
   - `ErpExtractorJob.extractionMode` дефолтится `${erp.extraction.mode:rpa}` → попадает в `RpaHtmlExtractorImpl` (Jsoup на mock-erp). Если параметр `mode` не передан в `POST /run` — экстракшн идёт мимо 1С.
   - `client/src/pages/SuppliesPage.js:134` — кнопка «Импорт из ERP» **хардкодит** `erpExtractorService.run('api')`. Поменять на `'onec'` (или сделать селектор).
   - `client/src/pages/ErpExtractorPage.js` — проверить что в выпадающем списке режима есть опция `onec` (сейчас, вероятно, только `api`/`rpa`).
   - Сменить дефолт `erp.extraction.mode` на `onec` в `product-service/src/main/resources/application.properties` (либо оставить `rpa` но фронт всегда явно слать `onec`).

2. **Отправка сообщений / mock-erp login — баг ApiExtractorImpl.** Не относится к 1С напрямую, но всплыло сейчас и блокирует fallback-канал:
   - `ApiExtractorImpl.login` (`backend/product-service/src/main/java/by/bsuir/productservice/rpa/ApiExtractorImpl.java:64-75`) шлёт `Map<String,String> {username, password}` в **body** через `restTemplate.postForObject(url, credentials, Map.class)`.
   - `MockErpController.login` (document-service) ожидает `@RequestParam username/password` — то есть **query string**, не body. Отсюда 400 `Required parameter 'username' is not present`.
   - **Fix:** в `ApiExtractorImpl.login` собрать URL с query-параметрами: `String url = erpBaseUrl + "/login?username={u}&password={p}"` + `restTemplate.postForObject(url, null, Map.class, erpUsername, erpPassword)`. ИЛИ переписать `MockErpController.login` принимать `@RequestBody Map<String,String>` (но тогда сломаются ручные curl-проверки). Первый вариант предпочтительнее — bug на стороне клиента.

3. **Проверка end-to-end RPA-1** (после 1+2):
   - Запустить WinAppDriver, открыть 1С `utdemo`, залогиниться.
   - `POST http://localhost:8765/api/erp-extractor/run?mode=onec`.
   - В логах ожидать `1C-RPA: найдено окон-кандидатов: 1`, `1C-RPA: открыт журнал «Закупки → Заказы поставщикам»`, `1C-RPA: найдено строк: N`.
   - Если строки не найдены — калибровать XPath в `OneCWinAppExtractorImpl.readJournalTable` через **Accessibility Insights for Windows** на реальном окне 1С. Сейчас три fallback'а (`@LocalizedControlType='элемент таблицы'` / `//DataItem` / `//Custom[contains(@Name,'.')]`), допилить четвёртый по факту.
   - Проверить маппинг колонок 0-4 (`externalId / expectedDate / supplierName / productName / expectedQuantity`) — порядок в журнале «Заказы поставщикам» может отличаться от ожиданий бота.

**Оценка:** 0.5 дня — фикс 1 (фронт + дефолт) + фикс 2 (ApiExtractorImpl.login) + end-to-end прогон. Калибровка XPath/колонок — отдельно, по факту первого запуска.

**Frontend частично закрыт 2026-05-15** (`ErpExtractorPage.js`):
- Двухшаговая форма: шаг 1 — выбор агрегатора ERP (1С / Mock API / Mock RPA), шаг 2 — credentials (для 1С: username, password, basePath, sectionName, journalName).
- `erpExtractorService.run(mode, connection)` принимает body с credentials (раньше только query `?mode=`).
- В UI Alert предупреждает что бэкенд пока игнорирует body credentials — параметры читаются из `rpa.properties`.

**РЕАЛИЗОВАНО 2026-05-16:**
- `ApiExtractorImpl.login` — переписан с JSON body на `application/x-www-form-urlencoded` через `MultiValueMap` + `HttpEntity`. Теперь Spring `@RequestParam` в `MockErpController.login` корректно парсит креды. ApiExtractor-канал работает end-to-end.
- `ErpExtractorJob.extractionMode` — default `@Value("${erp.extraction.mode:rpa}")` → `:onec`. Плановый прогон (cron 03:00) теперь идёт через 1С, а не через mock-erp.
- `client/src/services/erpExtractorService.js` — default параметра `run(mode = 'api')` → `run(mode = 'onec')`. Frontend в `ExtractDataDialog` уже корректно выбирает агрегатор (default `onec` в state), пользователь явно подтверждает.
- Note: `SuppliesPage.js` хардкод `'api'` который упомянут в issue — оказался устаревшим. Фактический хук — `ExtractDataDialog`, который имеет dropdown с тремя опциями и default `'onec'`. PLAN.md был неточен в исходной формулировке.
- Compile + `:product-service:test` (186 тестов) зелёные. E2E прогон через 1С ждёт калибровки XPath (§2.6).

### 2.7.bis Backend: credentials ERP в БД, а не в properties ✅ DONE 2026-05-17 (MVP)

**Сейчас.** Параметры подключения к 1С (username, password, basePath, sectionName, journalName) хардкодированы в `backend/product-service/src/main/resources/rpa.properties`. Это:
- Один набор на весь сервис — нельзя иметь разные конфиги per-organization / per-user.
- Пароль в plain text в репозитории.
- При смене реквизитов нужен deploy.

**Что делать:**
1. Миграция `V9__erp_connection.sql` (`product_service`) — таблица `erp_connection`:
   ```sql
   CREATE TABLE erp_connection (
       id              UUID PRIMARY KEY,
       organization_id UUID NOT NULL,
       aggregator      VARCHAR(32) NOT NULL,    -- 'onec' / 'api' / 'rpa'
       name            VARCHAR(255),            -- человекочитаемое имя (опционально)
       username        VARCHAR(255),
       password_enc    TEXT,                    -- AES-encrypted (по примеру SSOService.EncryptedStringConverter)
       base_path       VARCHAR(512),
       section_name    VARCHAR(255),
       journal_name    VARCHAR(255),
       driver_url      VARCHAR(255),            -- override default 127.0.0.1:4723
       is_default      BOOLEAN DEFAULT FALSE,
       created_by      UUID NOT NULL,
       created_at      TIMESTAMP NOT NULL DEFAULT now(),
       updated_at      TIMESTAMP NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_erp_connection_org_agg ON erp_connection(organization_id, aggregator);
   ```
2. Entity `ErpConnection` + `ErpConnectionRepository`.
3. AES-converter (можно скопировать `EncryptedStringConverter` из SSOService, либо вынести в shared utility).
4. Service `ErpConnectionService` (CRUD): `create/update/delete/findByOrgAndAggregator/findDefault`.
5. REST endpoints (только DIRECTOR/ACCOUNTANT):
   - `POST /api/erp-connections` — создать
   - `GET /api/erp-connections` — список по `organization_id`
   - `PUT /api/erp-connections/{id}` — обновить
   - `DELETE /api/erp-connections/{id}` — удалить
   - `PATCH /api/erp-connections/{id}/default` — set default
6. **Расширить `POST /api/erp-extractor/run`** — принимать `@RequestBody Optional<ErpConnectionRequest>` (приоритет: body → default из БД → fallback на `rpa.properties` для backward compat).
7. `OneCWinAppExtractorImpl` — конструктор/builder принимающий `ErpConnectionParams` вместо `@Value("${rpa.onec...}")`. `RpaProperties` остаётся как fallback default.
8. `ErpExtractorJob.runManually(mode, connection)` — пробрасывает connection в extractor.
9. Шифрование `password_enc` через `${APP_DB_ENCRYPTION_KEY}` (env var, как в SSOService для `login_audit.ip`).
10. UI: на ErpExtractorPage добавить кнопку «Сохранить как подключение» в форму credentials → CRUD через `/api/erp-connections`. Уже введённая форма (2026-05-15) станет «использовать существующее подключение или ввести разовые credentials».

**Acceptance:**
- 1С credentials хранятся в БД (encrypted password), per-organization.
- `rpa.properties` секция `rpa.onec.*` либо удалена, либо помечена как «dev-fallback default».
- При запуске извлечения из UI используется выбранное подключение, без необходимости править properties и пересобирать.

**Оценка:** 1-1.5 дня.

**РЕАЛИЗОВАНО 2026-05-17 (MVP):**
- **Backend:** таблица `erp_connection` в `productDB.sql` (AES-encrypted `password_enc`), entity + repo + service + REST controller `/api/erp-connections` (CRUD + `PATCH /default`, доступ DIRECTOR/ACCOUNTANT). `EncryptedStringConverter` (AES-256-ECB через `APP_DB_ENCRYPTION_KEY`). `ErpExtractorController.runExtraction` принимает body с `connectionId` или inline-creds, резолвит в `ErpConnectionParams` и передаёт в `ErpExtractorJob.runManually(mode, params)`.
- **Frontend:** `erpConnectionService.js` + `ERP_CONNECTIONS` endpoints + dropdown сохранённых подключений в `ExtractDataDialog` + чекбокс «Сохранить как подключение».
- **Env-var:** `APP_DB_ENCRYPTION_KEY` в `.env` (генерить `openssl rand -base64 32`). Без ключа AES в pass-through режиме с warning.
- **Известное ограничение MVP:** существующие 3 extractor'а (`OneCWinAppExtractorImpl`/`Api`/`Rpa`) пока используют `@Value` из properties и **не учитывают** передаваемые params — default-метод в interface игнорирует. CRUD + UI работают, override в extractor'ах — TODO.

---

### 2.8 Разобраться с почтой (отправка приглашений) ⏳ PARTIAL 2026-05-17

**Контекст.** `organization-service` использует SMTP через `mail.gmail.com` (`spring.mail.host=smtp.gmail.com`) для отправки приглашений сотрудникам в организацию. Креды и app-password лежат в `backend/organization-service/src/main/resources/application.properties`. Поток: DIRECTOR создаёт `Invitation` → `InvitationService` шлёт email со ссылкой `/register/invitation?token={uuid}` → invitee кликает → попадает на `RegisterByInvitationPage` → `POST /api/auth/register/invitation` валидирует токен через `GET /api/invitations/validate?token=...`.

Заявка от пользователя 2026-05-15: «разобраться с почтой» — текущее состояние отправки писем неизвестно (письма не доходят / SMTP не отвечает / app-password устарел).

**Что проверить:**

1. **SMTP-креды актуальны?**
   - `organization-service/src/main/resources/application.properties` → `spring.mail.username` / `spring.mail.password` (для Gmail — app password 16 символов, не пароль аккаунта).
   - Если Google account имеет 2FA — обычный пароль не работает, нужен app-password (Google → Security → App passwords).
   - Если 2FA выключена + «Less secure apps» — больше не поддерживается Gmail с 2022, обязательно app-password.

2. **`InvitationService` / `EmailService` реально отправляет?**
   - Найти класс отвечающий за отправку (видимо `organization-service/src/main/java/by/bsuir/organizationservice/service/EmailService.java` или внутри `InvitationService`).
   - Логи `organization-service` при создании invitation: ожидать `JavaMailSender.send(...)` без ошибок. Если `MailAuthenticationException` → wrong creds; `MailSendException` с timeout → host/port/SSL неверен.
   - SMTP host `smtp.gmail.com`, порт `587` (STARTTLS) или `465` (SSL). Проверить `spring.mail.properties.mail.smtp.*`.

3. **URL invitation в письме корректный?**
   - Письмо шлёт ссылку вида `${app.frontend-url}/register/invitation?token={token}`. Если `app.frontend-url` = `http://localhost:3000` — работает только локально; для прода/staging нужно реальное доменное имя.
   - `client/src/pages/RegisterByInvitationPage.js` принимает `?token=` query param.

4. **`InvitationCodeScheduler` (cron hourly):**
   - Помечает истёкшие коды `is_active=false`. Проверить что cron реально срабатывает (`@Scheduled(cron="0 0 * * * *")` в `organizationservice/scheduler/`).
   - Если scheduler не работает — старые invitation остаются valid → security issue.

5. **OAuth invitation flow.**
   - При регистрации через OAuth (Google/Yandex) email из OAuth провайдера должен совпадать с email в `Invitation`. Backend (`OAuthService.completeRegistration` в SSO) бросает ошибку «Email mismatch» при расхождении.
   - Проверить что error message доходит до фронта понятным текстом.

**Acceptance:**
- Письмо с приглашением приходит на реальный email-ящик (тест на ваш `pavelkarliuk1@gmail.com`).
- Ссылка из письма открывает страницу регистрации, токен валидируется, регистрация проходит до конца.
- Логи `organization-service` без `MailException`.
- Истёкшие invitations реально помечаются inactive.

**Оценка:** 0.5-1 день (зависит от состояния SMTP creds).

**РЕАЛИЗОВАНО 2026-05-16:** Главный баг найден — невалидный URL приглашения (`/register?invite=` → `/register/invitation?token=`, фикс в `EmailService` + `InvitationService.mapToResponse`). `InvitationResponse.emailSent` пробрасывает silent failure на фронт. `cleanupExpiredInvitations()` теперь `@Scheduled` (был не вызывался). Фронт `EmployeesPage` показывает warning + reason при `emailSent=false`.

**ДОБИТО 2026-05-17:** ранее переписали на **Resend HTTPS API** из-за подозрений на блокировку SMTP-портов ISP. Позже выяснилось — порты не блокированы, **2026-05-18 откат на классический Gmail SMTP** через `JavaMailSender` (`spring-boot-starter-mail` уже был в build.gradle). Конфиг: `spring.mail.host=smtp.gmail.com`, `port=587`, STARTTLS, app-password в `MAIL_PASSWORD`. Секреты в корневом `.env` (gitignored) + `DotEnvEnvironmentPostProcessor` подгружает их при любом способе старта. `docker-compose.yml` пробрасывает `MAIL_HOST`/`MAIL_PORT`/`MAIL_USERNAME`/`MAIL_PASSWORD`/`MAIL_FROM_NAME`/`APP_FRONTEND_URL` через `${VAR:-default}`. Resend-ветка/код-зависимости удалены.

**Преимущество классики:** sandbox-ограничение Resend (только email владельца) снято — отправка идёт с реального ящика `pavelkarliuk1@gmail.com` на любой recipient.

**UI пробрасывает причину:** `InvitationResponse` поле `emailError` сохранено. `EmployeesPage.onInviteSubmit` показывает warning с полным сообщением `MailException` — DIRECTOR видит точную причину, не дженерик.

**Verified 2026-05-17:** `[DotEnv] Loaded N entries from .env` в startup-логе, приглашение → SMTP 220 → письмо приходит в inbox. Auto-cleanup истёкших приглашений (`@Scheduled cron = "0 0 * * * *"`) работает.

---

### 2.9 Приёмка не генерит unit_sku и не привязывает batch_id ✅ DONE 2026-05-16

**Контекст.** При приёмке через `POST /api/receipt-sessions` → `ProductOperationService.doReceive(...)` создаётся `Inventory` запись со следующими значениями:
- `unit_sku = NULL`
- `batch_id = NULL` (даже если ReceiptItem.batchId передан — он попадает в ProductOperation, но НЕ в Inventory.batchId, либо передаётся `null` из фронта)
- `cell_id = X` (присваивается из формы)
- `quantity = N`

**Подтверждено SQL 2026-05-15** на свежепринятой партии:
```
 product_id                           | batch_id | unit_sku | quantity
--------------------------------------+----------+----------+----------
 ed849a67-d9f6-4139-9171-f6c0a4d627a2 | NULL     | NULL     |  100.000
```

**Последствие — pick в заявке отгрузки не работает:**
- `ShipmentRequestService.pickItem(...)` (line 145-157) ищет позицию заявки через `inventoryRepository.findByUnitSku(unitSku)` → fallback на `findByProductIdAndBatchId(productId, batchId)`. Оба завязаны на `unit_sku` / `batch_id` в inventory.
- Если оба NULL — pick **гарантированно** возвращает `AppException.notFound("Позиция для штрихкода не найдена в заявке")`.
- ShipSaga full cycle сломан: невозможно подобрать товар → невозможно завершить заявку.

**Что чинить:**

1. **При приёмке (`ProductOperationService.doReceive` + ReceiptSessionService):**
   - Генерить `unit_sku` per inventory-запись. Простейший формат: `{productSku}-{batchNumber|short-uuid}-{idx}` (или фронт передаёт штрихкод печатной маркировки). Хранится в `Inventory.unit_sku`.
   - Записывать `batch_id` в `Inventory.batch_id` (сейчас передаётся, но возможно не доходит — проверить `Inventory.builder().batchId(request.batchId())` в `doReceive`: оно ЕСТЬ, значит проблема в том что фронт `cellId/batchId` шлёт null).
   - Альтернатива (для MVP): один `unit_sku == productSku + "-" + inventoryId.toString().substring(0,8)`, чтобы pick хотя бы по `productSku` работал.

2. **При создании Batch (через `ProductBatchService`?):**
   - Если фронт не создаёт Batch перед приёмкой, ReceiveItem.batchId = null. В `doReceive` тогда нужно либо автосоздавать `ProductBatch` (с `batch_number = "auto-{timestamp}"`), либо требовать batchId как обязательный.
   - Логически: каждая приёмка должна привязываться к Batch (партия = поступление с определённой датой/поставщиком).

3. **На фронте (ReceivePage):**
   - В `CreateReceiptSessionRequest.ReceiptItem` есть поля `batchNumber` и `expiryDate`. Сейчас они уходят в `request.notes`, но `Batch` не создаётся. Нужен явный шаг «создать Batch» → потом приёмка с `batchId`.
   - Минимум: после успешного `receiveItemInSession` найти/создать `ProductBatch(productId, batchNumber, expiryDate, supplyId)` и записать `batchId` в Inventory.

4. **`ShipmentRequestService.findItemByInventorySku`** как fallback:
   - Если unitSku не дал inventory → попробовать `inventoryRepository.findByProductIdAndWarehouseId(productId, warehouseId)` где productId парсим из позиции заявки (а не из inventory).
   - Это позволит «грубый» pick по productId даже без unit_sku, для MVP.

**Acceptance:**
- После приёмки `Inventory.unit_sku` НЕ NULL (генерируется автоматически или через печать штрихкода).
- `batch_id` корректно установлен (как в Inventory, так и в ProductOperation).
- На ShipPage в детальной модалке заявки `pick` по `productSku` (или сгенерированному unit_sku) завершает позицию, прогресс растёт до 100%.
- Тест `ShipSagaFullContainerTest` (Testcontainers) — заявка PLANNED → pick → PICKING → complete → 0 → 100% — действительно отрабатывает без mock'а `unitSku = "PROD-001-A"`.

**Оценка:** 0.5-1 день. Главное решение — где генерировать unit_sku (бэк auto vs UI с печатью штрихкода). Для диплома быстро — auto на стороне `doReceive`.

**РЕАЛИЗОВАНО 2026-05-16:**
- `Inventory.@PrePersist` — авто-генерит `unit_sku = "INV-" + 8 hex chars от inventoryId` (12 символов, под 20-char колонку). Срабатывает для **любой** новой Inventory-записи (приёмка, перемещение, placement, инвентаризация). Идемпотентно: если `unitSku` уже задан — не перезаписывает.
- Миграция `V9__inventory_unit_sku_backfill.sql` — backfill старых NULL-rows тем же форматом.
- `ReceiptSessionService.resolveBatchId(...)` — авто-создаёт `ProductBatch` если фронт не передал `batchId`, но передал `batchNumber`. Партия получает `productId`, `organizationId`, `supplyId` сессии, `expiryDate`, `purchasePrice` из формы + `supplier.name` если supplierId задан. Без `batchNumber` — батч не создаётся, `Inventory.batchId` остаётся null (legacy-совместимо).
- `ShipmentRequestItemRepository.findFirstByRequestIdAndProductIdAndBatchIdIsNull(...)` — новый метод.
- `ShipmentRequestService.findItemByInventorySku` — расширен: сначала ищет exact-match по `(productId, batchId)`, потом fallback на item с `batchId IS NULL` того же продукта. Закрывает кейс «директор создал заявку без batch, worker сканит лейбл с inventory.batchId=X».
- Compile + `:product-service:test` (186 тестов) зелёные.

---

### 2.10 RevaluationService — NPE в Map.of payload ✅ DONE 2026-05-16

**Контекст.** При вызове `POST /api/operations/revaluate` (бухгалтер меняет учётную цену) backend падает с `NullPointerException` на `RevaluationService.java:89`:

```java
inventoryEventService.record(inv.getInventoryId(), InventoryEventType.REVALUED, Map.of(
        "productId", request.productId(),
        "warehouseId", request.warehouseId(),
        "oldPrice", oldPrice,                    // ← может быть null если product.price = null
        "newPrice", request.newPrice(),
        "operationId", operation.getOperationId(),
        "userId", request.userId(),
        "reason", request.reason()));            // ← может быть null (поле опциональное)
```

`Map.of(...)` (immutable map) **не принимает null** для key/value — бросает NPE через `Objects.requireNonNull`. Логи это подтверждают:
```
java.lang.NullPointerException
  at java.base/java.util.Objects.requireNonNull(Objects.java:233)
  at java.base/java.util.ImmutableCollections$MapN.<init>(ImmutableCollections.java:1193)
  at java.base/java.util.Map.of(Map.java:1518)
  at by.bsuir.productservice.service.RevaluationService.revaluate(RevaluationService.java:89)
```

Воспроизводится при первой переоценке только-что принятого товара — у него `product.price` может быть null (фронт `ReceivePage` не обязывает выставлять цену при первой приёмке), плюс `request.reason()` опционален.

**Что чинить:**

Заменить `Map.of(...)` на `HashMap` с условной добавкой null-safe значений:

```java
Map<String, Object> payload = new HashMap<>();
payload.put("productId", request.productId());
payload.put("warehouseId", request.warehouseId());
if (oldPrice != null) payload.put("oldPrice", oldPrice);
payload.put("newPrice", request.newPrice());
payload.put("operationId", operation.getOperationId());
payload.put("userId", request.userId());
if (request.reason() != null) payload.put("reason", request.reason());
inventoryEventService.record(inv.getInventoryId(), InventoryEventType.REVALUED, payload);
```

Аналогично проверить остальные `Map.of(...)` в product-service — если хоть один аргумент опциональный, это бомба замедленного действия. Кандидаты:
- `WriteOffService` (`Map.of` для WRITTEN_OFF event)
- `InventoryEventService.record` сам по себе — если внутри тоже `Map.of`
- Любые места где формируется event payload

**Acceptance:**
- `POST /api/operations/revaluate` без `reason` и для товара с `price=null` отрабатывает успешно.
- `inventory_events.event_data` содержит только не-null поля.
- Никаких NPE на `Map.of` в логах при операциях revaluate / write-off / inventory.

**Оценка:** 0.5 ч на `RevaluationService` + ~1 ч на audit остальных `Map.of` payload-ов.

**РЕАЛИЗОВАНО 2026-05-16 (вместе с §2.16):**
- `RevaluationService:89` — `Map.of(...)` заменён на `HashMap` + явные `.put(...)`. Допускает null для `oldPrice` и `reason`.
- `InventoryCheckService:203` — `Map.of` в stream-lambda заменён на HashMap с null-safe `.toString()` per-поле. `discrepancies` response теперь не падает на новых InventoryCount с null actualQuantity.
- `InventoryCheckService:251` — `Map.of("source", ..., "countId", ..., "sessionId", ...)` заменён на HashMap (sessionId может быть null для standalone counts).
- `ShipmentSagaService:146, 246` — `Map.of(...)` для OPERATION_RECORDED заменены на helper `buildOperationEventPayload(operation)` с null-safe putIfNotNull для каждого поля entity.
- **Центральная защита:** `InventoryEventService.record(...)` теперь делает defensive-copy в HashMap и **отбрасывает null ключи и значения** перед `objectMapper.valueToTree`. Belt-and-suspenders — даже если новый caller просочит null, инцидент не разрушит транзакцию.
- `ProductOperationService:267` (transferMeta) **не трогал**: `TransferProductRequest.fromWarehouseId/toWarehouseId` уже валидируются `@NotNull` на DTO + центральная защита.
- Compile + `:product-service:test` (186 тестов) зелёные.

---

### 2.11 Eureka instance hardcoded на `127.0.0.1` / `localhost` во всех 5 сервисах ✅ DONE 2026-05-16

**Контекст.** Code review 2026-05-16. Во всех 5 сервисах в `application.properties` прописано:
```properties
eureka.instance.prefer-ip-address=true
eureka.instance.ip-address=127.0.0.1
eureka.instance.hostname=localhost
```

Файлы: `SSOService/application.properties:43-44`, `organization-service/application.properties:6-7`, `warehouse-service/application.properties:6-7`, `product-service/application.properties:20-21`, `document-service/application.properties:6-7`.

**Последствия:**
- В Docker Compose: каждый контейнер регистрируется в Eureka со своим адресом `127.0.0.1:<port>`. Когда api-gateway резолвит `lb://PRODUCT-SERVICE`, Ribbon берёт `127.0.0.1:8030` из Eureka и стучится **на свой loopback** (в контейнер gateway, не product-service). Все `/api/products/**` запросы 502/connection refused.
- В Kubernetes: тот же эффект — поды видят чужие `127.0.0.1` и пытаются ходить к себе же.
- Локальный одно-process запуск (всё на хосте) — единственный сценарий, где это работает.

**Что чинить:**
1. **Снять hardcoded `eureka.instance.ip-address=127.0.0.1` и `eureka.instance.hostname=localhost`** во всех 5 properties — Eureka возьмёт реальный сетевой адрес контейнера автоматически.
2. Для Docker Compose: добавить env-override в `docker-compose.yml` для каждого сервиса:
   ```yaml
   environment:
     - EUREKA_INSTANCE_PREFER_IP_ADDRESS=true
     - EUREKA_INSTANCE_HOSTNAME=${HOSTNAME}
   ```
3. Для k8s: аналогично через ConfigMap / env, либо использовать downward API (`fieldRef: status.podIP`).
4. **Проверить, что `eureka.client.service-url.defaultZone`** в `docker-compose.yml` уже указывает на `http://eureka-server:8761/eureka/`, не на `localhost`.
5. Прогнать end-to-end: поднять стек через `docker-compose up`, дёрнуть `GET http://localhost:8765/api/products`, убедиться что нет 502.

**Acceptance:**
- `docker-compose up` поднимает стек, и любой эндпоинт через gateway отрабатывает (не 502/connection refused).
- В Eureka-UI (`http://localhost:8761`) каждый сервис имеет нормальный IP (например `172.18.0.x`), не `127.0.0.1`.

**Оценка:** 0.5 дня.

**РЕАЛИЗОВАНО 2026-05-16:**
- Из `application.properties` всех 5 сервисов (`SSOService`, `organization-service`, `warehouse-service`, `product-service`, `document-service`) удалены 2 строки `eureka.instance.ip-address=127.0.0.1` + `eureka.instance.hostname=localhost`. `eureka.instance.prefer-ip-address=true` оставлен — Eureka resolve'ит реальный сетевой адрес контейнера автоматически.
- `docker-compose.yml` уже корректно ставит `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://eureka-server:8761/eureka` + `EUREKA_INSTANCE_PREFER_IP_ADDRESS=true` для каждого сервиса. После снятия hardcoded properties эти env-vars больше не конфликтуют.
- Для локального запуска (без Docker) — `eureka.client.service-url.defaultZone=http://localhost:8761/eureka` остался, IP контейнера = IP хоста = localhost, работает как раньше.
- `:allTestWithCoverage` — BUILD SUCCESSFUL (все 5 сервисов).

---

### 2.12 OAuth callback hardcoded на `http://localhost:3000` ✅ DONE 2026-05-17

**Контекст.** Code review 2026-05-16. `SSOService/controller/OAuthController.java` (5 мест: lines 72, 80, 98, 107, 116) и `SSOService/service/OAuthService.java:195` содержат hardcoded `http://localhost:3000/auth/callback?...` для редиректа после OAuth. Параллельно `InvitationService.java:30` и `EmailService.java:22` уже используют `@Value("${app.frontend.url:http://localhost:3000}")` корректно.

**Последствия:** в проде/staging OAuth-callback редиректит браузер пользователя на `http://localhost:3000` (которого там нет) → OAuth-логин не работает.

**Что чинить:**
1. В `OAuthController` и `OAuthService` инжектить `@Value("${app.frontend.url}")` (default `http://localhost:3000`).
2. Заменить все 6 хардкодов на `String.format(frontendUrl + "/auth/callback?...", ...)`.
3. Унифицировать с уже работающим паттерном из `InvitationService` / `EmailService`.

**Оценка:** 0.5 ч.

---

### 2.13 JWT issuer hardcoded `http://localhost:7777` ✅ DONE 2026-05-17

**Контекст.** `SSOService/service/JwtTokenService.java:45` — `.issuer("http://localhost:7777")`. Порт 7777 в проекте **не используется** (SSO на 8000) — выглядит как legacy от ранней версии. Issuer claim попадает в каждый выданный access-token (`iss: "http://localhost:7777"`).

**Последствия:** косметика — но если когда-нибудь добавим validate-issuer в downstream-сервисах или внешних потребителях, токены сразу станут невалидными. Также сбивает с толку при отладке JWT в jwt.io.

**Что чинить:**
1. Вынести в `@Value("${app.security.jwt.issuer:wms-sso}")` или константу `"wms-sso"` (внутренний идентификатор), а не URL.
2. Если хочется URL — указать актуальный `http://localhost:8000` (или env-aware через config).

**Оценка:** 15 мин.

---

### 2.14 EmployeeAnalyticsService обращается к несуществующему endpoint через `localhost:8030` ✅ DONE 2026-05-16

**Контекст.** `organization-service/service/EmployeeAnalyticsService.java:90`:
```java
String url = "http://localhost:8030/api/operations/user/" + userId + "/stats";
return restTemplate.getForObject(url, Map.class);
```

**Два бага сразу:**
1. **Hardcoded `http://localhost:8030`** — `new RestTemplate()` без LoadBalanced, обходит Eureka. В Docker/k8s `localhost:8030` — это собственный контейнер org-service, не product-service.
2. **Endpoint `/api/operations/user/{userId}/stats` НЕ существует в product-service** — grep по `product-service/controller/**/*.java` не находит ни одного матча. Запрос **всегда** попадает в `catch (Exception)` и возвращает заглушку `{totalOperations: 0, available: false}`.

**Эффективно:** `getEmployeeOperationsStats` — мёртвый код, аналитика производительности сотрудников всегда показывает `LOW` rating с нулём операций.

**Что чинить:**
1. **Решить feature scope:** нужна ли вообще аналитика сотрудников? Если да — реализовать endpoint в product-service (`GET /api/operations/user/{userId}/stats` → агрегат по `product_operation` за период) и переключить на LoadBalanced RestTemplate (`http://PRODUCT-SERVICE/api/...`).
2. Если нет — удалить `EmployeeAnalyticsService` (или вырезать обращение к product-service) и upstream-вызовы, не оставлять мёртвую заглушку, маскирующую отсутствие данных.

**Оценка:** 0.5-1 день если реализовывать stats endpoint в product-service; 30 мин если просто удалить мёртвый код.

**РЕАЛИЗОВАНО 2026-05-16 (вариант 2 — cleanup):**
- `EmployeeAnalyticsService` очищен: удалены `RestTemplate` field, `getEmployeeOperationsStats(...)`, `calculatePerformanceRating(...)`, все `try/catch` блоки и поля `operationsStats` / `avgOperationsPerDay` / `performanceRating` из response. Метрики performance НЕ оценивались (endpoint не существовал, всегда возвращал `available: false`).
- Response теперь содержит только реальные данные: `userId` / `role` / `joinedAt` / `daysWorked` (+ `orgId` / `monthsWorked` для одного сотрудника).
- Фронт `AnalyticsPage.js` — удалены 2 колонки «Всего операций» + «Разбивка по типам» из таблицы аналитики сотрудников. Сортировка теперь по `daysWorked DESC` (раньше по `totalOperations` который всегда был 0).
- Существующие тесты `EmployeeAnalyticsServiceTest` (5 тестов) проверяют только `userId/role/joinedAt/daysWorked/monthsWorked` — поломки не словили.
- Эталон уважает фактическую функциональность: WMS показывает «кто в штате и сколько дней», а не маскирует отсутствующую интеграцию с product-service.

---

### 2.15 Lost-update в Inventory: нет `@Lock` / `@Version` на конкурентных update'ах ✅ DONE 2026-05-16

**Контекст.** `InventoryRepository.findByProductIdAndWarehouseId(...)` (и связанные методы) не используют ни `@Lock(PESSIMISTIC_WRITE)`, ни `@Version` на `Inventory`. Сейчас `@Lock` есть **только** в `DocumentCounterRepository` (для serial counter — это правильно). Inventory mutation pattern read-modify-save: read через `findByProductIdAndWarehouseId`, потом `inv.setQuantity(qtyBefore.subtract(qty))`, потом `save(inv)`.

**Где это паттерн:**
- `WriteOffService.writeOff` (line 43-64).
- `RevaluationService.revaluate` (line 85+).
- `ProductOperationService.doReceive` / `receiveProduct` / `transfer` (lines 96, 199, 221).
- `ShipmentSagaService.executeInventoryUpdate` (line 192-217).
- `InventoryCheckService.adjustInventory` (line 215+).
- `SagaOrchestrator.compensate` / `compensateShipSaga` — тоже модифицирует quantity.

**Сценарий бага:**
1. Кладовщик A списывает 5 единиц product X (quantity=10, reservedQuantity=0).
2. Параллельно saga отгрузки B списывает 5 единиц того же X.
3. Оба читают `quantity=10`, оба считают `10-5=5`, оба `save`.
4. Итог в БД: `quantity=5` (вместо `0`). 5 единиц «появились из воздуха».

**Что чинить:**
1. **Добавить `@Lock(LockModeType.PESSIMISTIC_WRITE)` на read-методы**, используемые перед write'ом:
   ```java
   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("SELECT i FROM Inventory i WHERE i.productId = :pid AND i.warehouseId = :wid")
   Optional<Inventory> findByProductIdAndWarehouseIdForUpdate(@Param("pid") UUID productId,
                                                              @Param("wid") UUID warehouseId);
   ```
   Существующий `findByProductIdAndWarehouseId` оставить для read-only сценариев (UI-листинги, analytics).
2. **Альтернатива** — добавить `@Version Long version` в `Inventory` (optimistic locking). На конфликте — `OptimisticLockException`, в saga вернуть retry. Дешевле под нагрузкой, но требует обработки retry в каждом writer'е.
3. Прогнать stress-тест: 50 параллельных отгрузок одной позиции через JMeter / простой Java-скрипт с `ExecutorService` — итоговый `quantity` должен быть консистентным.

**Acceptance:**
- 100 параллельных списаний 1 единицы из inventory с `quantity=100` дают итог `quantity=0`, не положительное число.
- Saga compensation не теряет изменения при конкурентном write'е.

**Оценка:** 1 день (миграция, новый repo-метод, рефакторинг 5 writer'ов на ForUpdate, stress-тест).

**РЕАЛИЗОВАНО 2026-05-16:**
- **Note:** `Inventory` уже имеет `@Version Long version` + DDL `version BIGINT NOT NULL DEFAULT 0` (оптимистическое блокирование было). Реальная проблема была не «lost-update», а **отсутствие retry на `OptimisticLockException`** + защита от долгих read-then-write окон.
- `InventoryRepository` — добавлены 2 новых метода с `@Lock(LockModeType.PESSIMISTIC_WRITE)`:
  - `findByProductIdAndWarehouseIdForUpdate(productId, warehouseId)` — для receive/writeoff/inventory-check/transfer.
  - `findByIdForUpdate(inventoryId)` — для saga (ship-saga inventory update, обе компенсации).
- Read-only `findByProductIdAndWarehouseId` / `findById` оставлены — нужны для UI-листингов, FEFO selection, read-only выборок.
- **6 writer-сайтов мигрированы на ForUpdate:**
  - `ProductOperationService.doReceive` (приёмка)
  - `ProductOperationService.transferProduct` (source + dest, 2 места)
  - `WriteOffService.writeOff`
  - `ShipmentSagaService.executeInventoryUpdate`
  - `InventoryCheckService.adjustInventory`
  - `SagaOrchestrator.compensate` / `compensateShipSaga` (3 места: INVENTORY_UPDATE receive, INVENTORY_UPDATE ship, STOCK_RESERVATION ship)
  - `ShipmentRequestService.complete` (FEFO allocation)
- **Bonus fix:** в `ProductOperationService.transferProduct` убран `dest.setUnitSku(null)` (line 233) — затирал unit_sku при merge в существующую ячейку, ломал §2.9 (pick по штрихкоду). Теперь unit_sku сохраняется across transfers.
- Тесты `WriteOffServiceTest`, `ProductOperationServiceTest`, `SagaOrchestratorTest` обновлены — моки переименованы на `findByProductIdAndWarehouseIdForUpdate` / `findByIdForUpdate`.
- `:product-service:test` + `:allTestWithCoverage` — BUILD SUCCESSFUL.

---

### 2.16 `Map.of` NPE — расширенный audit ✅ DONE 2026-05-16 — закрыт вместе с §2.10

**Контекст.** Помимо `RevaluationService.java:89` (§2.10), grep нашёл ещё кандидатов на NPE через `Map.of(...)` с `BigDecimal.toString()` / `getName()` на возможно-null полях:

| Файл:строка | Риск |
|---|---|
| `ProductOperationService.java:267` | `fromWarehouseId` / `toWarehouseId` — для transfer обязательны, но если фронт пришлёт null → NPE до validation |
| `InventoryCheckService.java:203` | `expectedQuantity.toString()` / `actualQuantity.toString()` / `discrepancy.toString()` — NPE если хоть один BigDecimal null (а они могут быть null у новых counts до save) |
| `ShipmentSagaService.java:146` | `productId.toString()` / `warehouseId.toString()` / `quantity.toString()` на staging operation — entity может не иметь warehouseId если ShipProductRequest некорректен |
| `ShipmentSagaService.java:246` | то же на финальной operation отгрузки |

**Что чинить:**
1. Применить тот же фикс что в §2.10 — `HashMap` + null-safe `put`-ы.
2. Лучше — в `InventoryEventService.record(...)` сделать **defensive copy** в `HashMap` и `entrySet().removeIf(e -> e.getValue() == null)` — централизованная защита от NPE для всех event payload.

**Оценка:** 1 ч (2 файла + защита в InventoryEventService).

---

### 2.17 `AnalyticsReportService.generateReport` — ABC-данные потеряны ✅ DONE 2026-05-17

**Контекст.** `product-service/service/AnalyticsReportService.java:38`:
```java
Map<String, Object> abcReport = Map.of(
        "abcItems", abcAnalysisService.getAbcReport().size()
);

return buildPdf(preset, from, to, dynamics, inventory);  // ← abcReport НЕ передан
```

`abcReport` создаётся, но **никогда не используется** — `buildPdf(...)` не принимает 4-й аргумент. ABC-анализ должен быть разделом PDF-отчёта, но в финальный PDF не попадает.

**Что чинить:**
1. Расширить сигнатуру `buildPdf(...)` на 4-й параметр `Map<String, Object> abc`.
2. Добавить раздел «ABC-анализ» в PDF (число позиций / процент по классам A/B/C, если есть).
3. Либо удалить мёртвую строку, если ABC не требуется в отчёте.

**Оценка:** 30 мин (если просто добавить раздел в PDF) или 5 мин (если удалить мёртвый код).

---

### 2.18 OperationController.findById без org-фильтра ✅ DONE 2026-05-17

**Контекст.** `product-service/controller/OperationController.java`:
- Line 283 (`revaluate`): `productRepository.findById(request.productId()).ifPresent(p -> { docPayload.put("productName", p.getName()); docPayload.put("productSku", p.getSku()); });`
- Line 319 (`writeOff`): то же самое.

**Риск.** Defense-in-depth gap: `revaluationService` / `writeOffService` уже проверяют что Inventory принадлежит организации, и без существующего Inventory документ не сгенерится. Но если злоумышленник передаст productId чужой организации, у которой случайно есть Inventory с тем же warehouseId (теоретически возможно при cross-org cell sharing), — он получит имя/SKU чужого продукта в payload документа. На практике сейчас warehouses скоупятся per-org, так что реальный exploit маловероятен.

**Что чинить:**
- Использовать `productRepository.findByIdAndOrganizationId(productId, organizationId)` (нужно добавить метод в `ProductReadModelRepository`).

**Оценка:** 30 мин.

---

### 2.19 `@Scheduled` cron jobs запустятся на каждой реплике ✅ DONE 2026-05-17 (вариант A — replicas=1 enforced)

**Контекст.** Три `@Scheduled` job-а в product-service / organization-service:
- `AbcAnalysisService.computeAbcAnalysis` — `0 0 2 * * *` (ежедневно в 02:00).
- `ErpExtractorJob.run` — `0 0 3 * * *` (ежедневно в 03:00).
- `InvitationCodeScheduler.cleanup` — `0 0 * * * *` (ежечасно).

Все они без any `ShedLock` / `@SchedulerLock`. При `replicas > 1` в k8s все реплики запустят job одновременно → дубль ABC-пересчёта, дубль ERP-вытяжки (если PlannedDelivery `externalId` UNIQUE — словит constraint violation, но потеряет диагностику; если не UNIQUE — реальные дубли).

**Сейчас:** все services развёрнуты с `replicas=1` (см. `project-k8s-state` memory) → бага не воспроизвести. Но при scale-out внезапно.

**Что чинить:**
1. Добавить `net.javacrumbs.shedlock:shedlock-spring + shedlock-provider-jdbc-template` в `product-service/build.gradle` и `organization-service/build.gradle`.
2. Создать таблицу `shedlock` (миграция Flyway).
3. Аннотировать каждый `@Scheduled` метод `@SchedulerLock(name = "abc-analysis", lockAtMostFor = "10m", lockAtLeastFor = "5m")`.
4. Либо проще для диплома: оставить `replicas=1` и **задокументировать в k8s manifests + DEPLOYMENT.md** что эти deployments **нельзя скейлить**.

**Оценка:** 0.5 дня для ShedLock; 5 мин для документирования ограничения.

**РЕАЛИЗОВАНО 2026-05-17 (вариант A):**
- `k8s/04-backend.yaml` — `organization-service` и `product-service` явно установлены в `replicas: 1` с inline-комментарием про `@Scheduled` + ShedLock-зависимость.
- Остальные сервисы (`warehouse-service`, `document-service`, `sso-service`) остались `replicas: 2` — в них нет cron-задач.
- ShedLock-вариант B оставлен как future task (см. memory `project_wms_subsystems` если когда-нибудь планируется scale-out для cron-сервисов).

---

### 2.20 Мелкие config issues — `logging.level` на чужой пакет ✅ DONE 2026-05-17

**Контекст.** В трёх properties-файлах прописан DEBUG на пакет `by.bsuir.organizationservice`, которого в этих сервисах **нет**:
- `product-service/application.properties:52`
- `warehouse-service/application.properties:44`
- `api-gateway/application.properties:38`

Эффект нулевой (логгер для несуществующего класса просто никогда не сработает), но конфиг enmertled.

**Что чинить:** заменить на корректный пакет для каждого сервиса (`by.bsuir.productservice`, `by.bsuir.warehouseservice`, `by.bsuir.apigateway`) или удалить строку.

**Оценка:** 5 мин.

---

### 2.21 CORS в SSOService жёстко на `localhost:3000` + api-gateway вообще без CORS (2026-05-16) ❌ PENDING

**Контекст.**
- `SSOService/config/CORSConfig.java:28` — `config.setAllowedOrigins(List.of("http://localhost:3000", "http://127.0.0.1:3000"))`. Hardcoded, не работает в проде.
- `api-gateway` — grep по `Cors|corsConfigurationSource|setAllowedOrigins` ничего не находит. Gateway вообще без CORS-фильтра.

**Последствия:**
- В dev: фронт `localhost:3000` бьёт **на gateway** `localhost:8765`. Браузер отправляет preflight `OPTIONS` → gateway возвращает без `Access-Control-Allow-Origin` → CORS error в консоли. Работает только если frontend проксирует через nginx (prod-сборка) или CRA dev-proxy.
- В проде: nginx на `client/nginx.conf` проксирует `/api → api-gateway:8765` — это обходит CORS, потому что browser видит один origin.
- Но прямой dev-режим (CRA dev server + gateway без proxy) — не работает.

**Что чинить:**
1. Добавить `CorsWebFilter` в `api-gateway` (это WebFlux, нужен `CorsWebFilter`, не `WebMvc.CorsRegistry`):
   ```kotlin
   @Bean
   fun corsWebFilter(): CorsWebFilter {
       val config = CorsConfiguration()
       config.allowedOriginPatterns = listOf("*")  // dev: разрешить всё; prod: env-aware
       config.allowedMethods = listOf("GET","POST","PUT","PATCH","DELETE","OPTIONS")
       config.allowedHeaders = listOf("*")
       config.allowCredentials = true
       val source = UrlBasedCorsConfigurationSource()
       source.registerCorsConfiguration("/**", config)
       return CorsWebFilter(source)
   }
   ```
2. `SSOService/CORSConfig.java:28` — вынести allowed origins в `@Value("${app.cors.allowed-origins}")` (comma-separated).

**Оценка:** 0.5-1 ч.

---

### 2.22 OAuth client secrets закоммичены в репо (2026-05-16) ❌ PENDING — **security**

**Контекст.** `SSOService/src/main/resources/application.properties`:
```
oauth.yandex.client-secret=357160e2fd874d7ba916e1ce758d379c
oauth.google.client-secret=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
```

Эти секреты лежат в git и видны в публичном репо. Тот же файл содержит OAuth client-id и redirect uri. У memory `feedback_backend_first_no_tests` / `backend/CLAUDE.md` есть прямое предупреждение: «Treat that file as sensitive — don't rotate or regenerate without coordinating with the user».

**Риск.** Любой кто склонит репо получит креды для Yandex/Google OAuth-приложений → может выдавать токены от имени проекта или перехватывать пользователей. Для дипломного проекта — низкий импакт, но badpractice.

**Что чинить:**
1. **Ротировать оба secret'а** в Yandex и Google Cloud Console (создать новые, старые сразу отозвать).
2. Перевести на env-var:
   ```properties
   oauth.yandex.client-secret=${YANDEX_OAUTH_CLIENT_SECRET:}
   oauth.google.client-secret=${GOOGLE_OAUTH_CLIENT_SECRET:}
   ```
3. Прописать в `docker-compose.yml` и k8s `Secret`.
4. **`git filter-repo`** для удаления из истории (опционально для диплома, обязательно для production).

**Оценка:** 1-2 ч (ротация + правки конфига); +1 день если зачищать git-историю.

---

### 2.23 Тест `SsoServiceApplicationTests` отключён ❌ PENDING — выходит за scope cosmetic (нужен полный H2 + Redis mock)

**Контекст.** `backend/SSOService/src/test/java/by/bsuir/ssoservice/SsoServiceApplicationTests.java:7` — `@Disabled()`. Это smoke-test что Spring context поднимается. Сейчас не проверяется — поломка bean wiring словится только при реальном `bootRun`.

**Что чинить:**
1. Снять `@Disabled`.
2. Если контекст падает — починить (вероятно Redis/Postgres недоступны в unit-тестовом профиле, нужно подсунуть `@MockBean` для них или переключить на Testcontainers).

**Оценка:** 1-2 ч.

---

### 2.24 Frontend: `API_BASE_URL` продублирован в 4 файлах ✅ DONE 2026-05-17

---

### 2.25 `JwtAuthenticationFilter` в api-gateway не был зарегистрирован ✅ DONE 2026-05-17 — найден по ходу §4 I5

**Контекст.** При работе над §4 I5 обнаружено: `backend/api-gateway/src/main/java/by/bsuir/apigateway/filter/JwtAuthenticationFilter.java` объявлен как `public class JwtAuthenticationFilter implements GlobalFilter, Ordered` **без `@Component`**. Spring его не подхватывал → JWT на gateway **не валидировался**. `SecurityConfig` стоял `.anyExchange().permitAll()`. Defence-in-depth работала только на уровне downstream-сервисов (каждый имеет свой `JwtAuthenticationFilter`), но gateway пропускал любые запросы с любыми (или без) токенами.

**РЕАЛИЗОВАНО:** добавлен `@Component` + `@RequiredArgsConstructor` на `JwtAuthenticationFilter` (вместе с §4 I5 (b) — переходом на `ReactiveStringRedisTemplate`). Теперь фильтр реально работает: каждый non-excluded запрос валидирует JWT, кладёт `X-User-Id`/`X-User-Role`/etc заголовки в downstream-request.

---

### 2.26 Дубликат `keystore/` + закоммиченный JWT private-key ✅ DONE 2026-05-18 (partial)

**Контекст.** В репозитории было два keystore-каталога с **разными RSA-парами**:
- `backend/SSOService/keystore/` (untracked в submodule, но локально жил)
- `wmsProject_org/keystore/` (**закоммичен** в umbrella репо — `keystore/jwt-private.key` + `jwt-public.key` в `git ls-files`)

Какой из двух SSO загружал — зависело от CWD при запуске (через `gradlew :SSOService:bootRun` из `backend/` vs `wmsProject_org/`). После каждой смены CWD токены подписывались разной keypair, а gateway кэшировал public-key в Redis на 1h → токены из «прошлого CWD» переставали валидироваться → 401 на любых protected endpoint'ах.

**РЕАЛИЗОВАНО 2026-05-18:**
- `keystore/jwt-private.key` + `jwt-public.key` сняты с трекинга через `git rm --cached` (на диске сохранены — SSO работает).
- В корневой `.gitignore` добавлены `keystore/` + `**/keystore/` — покрывает оба каталога.
- SSO теперь грузит из `wmsProject_org/keystore/` (umbrella, как и было). Старый `backend/SSOService/keystore/` остаётся локально, но в git не уйдёт.

**Что НЕ сделано (см. §2.28):** приватный ключ всё ещё в git history (`6f48d21` и более ранние коммиты). Полная санация — `git filter-repo` или ротация keypair.

### 2.27 Gateway `JwtAuthenticationFilter` блокировал на event-loop треде ✅ DONE 2026-05-18

**Контекст.** §4 I5 (b) переключил кэш public-key с in-memory на `ReactiveStringRedisTemplate`, но оставил sync-вызов `redisTemplate.opsForValue().get(...).block()` внутри `getPublicKey()`. Spring Cloud Gateway работает на Netty event-loop тредах (`parallel-N`), а Reactor запрещает `block()/blockFirst()/blockLast()` на них. Результат: **каждый** non-excluded запрос ловил `IllegalStateException: block()/blockFirst()/blockLast() are blocking, which is not supported in thread parallel-12`, попадал в outer `catch (Exception)` → 401. Эффективно: gateway возвращал 401 на ВСЕ запросы после §2.25 + §4 I5.

**Симптом у пользователя:** OAuth-логин проходил (`/api/oauth/**` в EXCLUDED_PATHS), но первый же `/api/auth/me` после редиректа возвращал 401 с пустым body. Auth-токен был корректный, проблема — в самом filter'е.

**РЕАЛИЗОВАНО:**
1. `filter(...)` теперь оборачивает всю синхронную JWT-валидацию (parse + getPublicKey + verify + claims-extract + header-mutate) в `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())` — blocking-вызовы Redis/HTTP уходят с event-loop тредов на elastic pool, где `.block()` легален.
2. Логика верификации вынесена в helper `validateAndBuildRequest(...)`, возвращающий готовый `ServerHttpRequest` (или throws).
3. Self-heal на verify-failure: при invalid signature на cached key — `redisTemplate.delete(REDIS_KEY).block()` + refetch + retry verify один раз. Закрывает кейс ротации keypair SSO без рестарта gateway (актуально после §2.26).
4. Helper `unauthorized(exchange)` убрал дублирование return-401.

**Файл:** `backend/api-gateway/src/main/java/by/bsuir/apigateway/filter/JwtAuthenticationFilter.java`.

### 2.28 JWT private-key в git history ❌ PENDING (security)

**Контекст.** §2.26 убрал ключи из текущего working tree + index, но история git хранит `keystore/jwt-private.key` в коммите `6f48d21 fix: fixed bugs and k8s deploy` и более ранних. Любой кто склонит репо и сделает `git log -p -- keystore/jwt-private.key` достаёт private key и может подписывать валидные JWT с любым `userId`/`role`.

**Что делать (по выбору):**
- **A. Ротация (рекомендую):** удалить `keystore/jwt-{public,private}.key` локально, перезапустить SSO — `SecurityBeansConfig.keyPair()` сгенерит новый keypair и сохранит. Все существующие токены перестанут валидироваться (пользователи должны заново залогиниться, через self-heal §2.27 это сработает). Старый private-key в history становится бесполезным.
- **B. Чистка истории:** `git filter-repo --invert-paths --path keystore/jwt-private.key --path keystore/jwt-public.key` + force-push. Деструктивно, требует синхронизации с любыми клонами репо. Для дипломного проекта overkill, если **A** уже сделано.

**Оценка:** 10 минут на A, 30 минут на B.

---

**Контекст.** Один и тот же fallback `'http://localhost:8765'` со чтением `process.env.REACT_APP_API_URL` повторён в:
- `client/src/services/documentService.js:5`
- `client/src/store/api.js:4`
- `client/src/pages/LoginPage.js:14`
- `client/src/components/shared/OAuthButtons.js:4`

При смене default'а (например на `''` для prod-сборки за nginx) нужно править 4 места.

**Что чинить:** вынести в `client/src/config/api.js` (уже существует) экспортом `export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8765';` и импортить во всех 4 файлах.

**Оценка:** 15 мин.

---

## 4. I5. Redis для api-gateway ✅ DONE 2026-05-17 / hotfix 2026-05-18

- **(a)** Мёртвый Caffeine выпилен (2 строки properties + dependency).
- **(b)** Distributed JWT public-key cache в Redis (ключ `gw:jwt-public-key`, TTL 1h). Заодно зарегистрирован `JwtAuthenticationFilter` как `@Component` — раньше он не был bean'ом (см. §2.25). **Hotfix 2026-05-18:** реализация (b) содержала `.block()` на Netty event-loop треде → 401 на всех запросах. Закрыто в §2.27 — фильтр обёрнут в `Mono.fromCallable(...).subscribeOn(Schedulers.boundedElastic())` + добавлен self-heal при mismatch'е cached vs current SSO public key.
- **(c)** Rate limiter снят полностью — в WMS-сценарии все юзеры за одним NAT, per-IP лимит ломает легитимные UI-burst'ы. Anti-brute-force переносится на уровень SSO `login_audit` (отдельная задача).

---

## 4.2 End-to-end проверка docker-compose ❌ PENDING — **обязательно перед защитой**

После всех правок (§2.x + миграции в sql-scripts + Resend + .env + rate-limit снят + §0.4 трекер) нужно прогнать весь стек целиком и убедиться что ничего не отвалилось:

1. **Cleanup:** `.\cleanup-docker.ps1` (выкосить старые volumes, иначе старая схема БД останется).
2. **Build:** `.\build-images.ps1` — пересобрать все `wms/*` образы.
3. **Up:** `.\deploy-docker.ps1` или `docker-compose up -d`.
4. **Что проверять:**
   - **Eureka UI** (`http://localhost:8761`) — должны зарегистрироваться все: `EUREKA-SERVER`, `API-GATEWAY`, `SSOSERVICE`, `ORGANIZATION-SERVICE`, `WAREHOUSE-SERVICE`, `PRODUCT-SERVICE`, `DOCUMENT-SERVICE`. Все `UP`.
   - **Gateway маршрутизация** (`http://localhost:8765/actuator/gateway/routes`) — список routes, всё `lb://...` резолвится.
   - **БД-схемы** проверить через `psql` или DBeaver на каждом из 4 портов 5432-5435: что таблицы из `sql-scripts/*.sql` созданы. Если `ddl-auto=validate` падает на старте сервиса — несовпадение entity vs SQL.
   - **MinIO** (`http://localhost:9001`, login `wmsadmin/wmsadmin12345`) — bucket `wms-documents` существует.
   - **Фронт** (`http://localhost:3000`) — открывается, логин работает, можно зарегистрироваться директором, создать склад, ячейку, поставщика, поставку, приёмку, отгрузку.
   - **Resend** (если задан в `.env`) — приглашение реально отправляется на `pavelkarliuk1@gmail.com` через гейтвей → org-service.
   - **Полный BP-1 / BP-2 / BP-5** прогон через UI — приёмка с генерацией receipt-act + отгрузка DOMESTIC с picking-list + инвентаризация.
   - **RabbitMQ UI** (`http://localhost:15672`, login `guest/guest`) — queues созданы, сообщения проходят при операциях.
   - **Логи каждого контейнера** — никаких `ERROR` при старте, `Started ... in N seconds`.

**Возможные подводные камни:**
- `.env` должен быть в корне (docker-compose читает оттуда `RESEND_API_KEY` для org-service).
- `eureka.client.service-url.defaultZone` в свежих properties не имеет `EUREKA_HOSTNAME` override — docker-compose уже задаёт `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://eureka-server:8761/eureka` через env, должно работать.
- `replicas=1` для organization-service и product-service (zaeded §2.19) — docker-compose сам делает 1 контейнер, но если когда-нибудь поднимать через k8s — manifest'ы уже корректные.

**Acceptance:** все service'ы здоровы в `docker ps`, можно пройти базовый user-flow на фронте без 502/500.

**Оценка:** 1-2 часа (включая фикс возможных мелких регрессий после правок).

---

## 4.1 Flyway миграции удалены 2026-05-17

В корне был набор `backend/<service>/src/main/resources/db/migration/V*.sql` (SSOService V1-V2, organization V1-V2, warehouse V1-V3, product V1-V9). Они **никогда не подключались как Flyway** (зависимость `org.flywaydb` не в build.gradle ни одного сервиса) — просто лежали как «история изменений схемы». Реальный init БД делается через `sql-scripts/{userDB,organizationDB,warehouseDB,productDB}.sql` в Postgres-контейнерах.

**Парность подтверждена 2026-05-17:** все DDL из миграций уже есть в `sql-scripts/*.sql`. Конкретно:
- SSO V2 (`ip_address TYPE TEXT`) → `userDB.sql:39` ✅
- Org V2 (`unp/address VARCHAR(512)`) → `organizationDB.sql:10-11` ✅
- Warehouse V2 (fridge min/max temperature + chk constraint) → `warehouseDB.sql:91-97` ✅
- Warehouse V3 (organization_id в slot-таблицах + indexes) → `warehouseDB.sql:63-119` ✅
- Product V2-V8 (inventory_events / product_operation_events / shipment_request strategy + shipment_type + currency + document_layout + domestic_document_kind + recipient_country + recipient_gln / document_counters / generated_documents / operation_status / receipt_session) → `productDB.sql` ✅
- Product V9 (backfill `unit_sku`) — only UPDATE, для свежей БД не нужно (новые записи получают unit_sku через @PrePersist в `Inventory`).

**Удалено:** 4 директории `backend/<service>/src/main/resources/db/`. **Новое правило:** при изменении схемы — править только `sql-scripts/<service>DB.sql`. Никаких новых V*.sql файлов.

---

## 5. Будущие расширения 💡 (P2/после защиты)

Не требуется ни poyasn, ни SRS — повышает зрелость дипломного решения:

1. Поддержка сканеров штрихкодов в UI (`<BarcodeScannerInput>` с debounce, beep, scan-mode).
2. Offline-mode для кладовщика (Service Worker + IndexedDB как очередь операций).
3. WebSocket / SSE-канал «склад → заведующий» (poyasn TO-BE 2.1.2).
4. Печать наклеек / штрихкодов (ZPL-генератор + endpoint в `document-service`).
5. Endpoint `/api/products/{id}/history` — лента событий по товару из Event Store (UI-таб).
6. Chaos-тест Saga: остановить product-service между `BATCH_CREATION` и `INVENTORY_UPDATE`, проверить recovery.
7. ~~Rate limiting на api-gateway~~ ✅ закрыт через §4 I5 (c) — 2026-05-17.
8. Валидация бизнес-правил BR-3..BR-6 как Strategy + Chain of Responsibility (`PlacementValidator`).
9. Импорт справочников из Excel (товары, поставщики).
10. e2e-тесты Playwright: логин, приёмка, отгрузка с FEFO, инвентаризация, переоценка, списание.

---

## 5.1 Test coverage (2026-05-15)

**Текущее состояние:** 473 backend-теста, **51.7% INSTRUCTION / 40% BRANCH** aggregate JaCoCo. Client-тестов **нет** (CRA placeholder `App.test.js` удалён 2026-05-15 — он никогда не работал в этом проекте: `react-router-dom@7` ESM-only, CRA Jest не транспилит).

**JaCoCo exclusions** (`backend/build.gradle ext.jacocoExcludes` + аналог в `jacocoAggregateReport`):
- `**/config/**` — Spring boilerplate (SecurityConfig, RabbitMQConfig, JwtAuthenticationFilter, и т.д.)
- `**/dto/**` — Java records (Lombok-generated)
- `**/model/entity/**` — JPA entities
- `**/model/event/**` — domain event records
- `**/model/enums/**` — Lombok-generated enum-классы
- `**/rpa/**` — RPA generator'ы (POI/PDFBox/WinAppDriver/JACOB — частично Windows-only, тестируется через E2E)
- `**/exception/**` — `AppException` factory-методы (тривиальные)
- `**/client/**` — Feign-style cross-service клиенты (мокаются в тестах потребителей)
- `**/*Application.class` — Spring Boot main

**До 80% — отложено.** Подход «только exclusions» (выбран 2026-05-15) дал потолок ~51.7%. Чтобы добить до 80% — нужно ~150-170 новых тестов на:
- `productservice.service` (52% → 80%, ~50 тестов, FEFO/ABC/Inventory/Saga/Supply)
- `productservice.controller` (18% → 80%, ~50 тестов, REST handlers + `@WebMvcTest`)
- `documentservice.service` + `documentservice.controller` (11%/1% → 70%, ~30 тестов)
- `ssoservice.service` + `organizationservice.service` (66%/69% → 80%, ~25 тестов)
Оценка: 1.5-2 дня. Включается, когда сценарии RPA-1/I5 будут закрыты.

**Per-service `jacocoTestCoverageVerification.minimum = 0.50`** — текущее условие проходит для всех 5 сервисов.

---

## 6. Дорожная карта (актуально на 2026-05-18)

**До защиты, по приоритету:**

| # | Задача | Статус | Оценка |
|---|---|---|---|
| 1 | **§4.2 End-to-end docker-compose** — поднять весь стек, прогнать BP-1/BP-2/BP-5 через UI | ❌ обязательно | 1-2 ч |
| 2 | **§2.6 RPA-1 1С** — E2E прогон с калибровкой XPath на `utdemo` | ⏳ ждёт Windows + WinAppDriver | 1.5-2 дня |
| 3 | **§2.8 SMTP/VPN на защите** — outbound SMTP блок у ISP подтверждён 2026-05-18, нужен VPN в аудитории ИЛИ MailHog-fallback под docker-compose profile | ⏳ environmental | 0.5-1 ч на MailHog-fallback |
| 4 | **§2.28 JWT private-key ротация** (private key в git history) | ❌ security, рекомендую вариант A (regenerate) | 10 мин |
| 5 | **§2.21 CORS** на api-gateway + SSO (hardcoded на `localhost:3000`) | ❌ отложен | 1 ч |
| 6 | **§2.22 OAuth secrets** ротация + env-var (в `application.properties` plain) | ❌ отложен (security) | 1-2 ч |
| 7 | **§5.1 Coverage 80%** | ⏳ 73.4% после session 2026-05-17 (+25% к baseline) | 0.5-1 день до 80% |

**Опциональные хвосты (минор, не блокеры):**
- `APP_DB_ENCRYPTION_KEY` пустой в `.env` → AES в pass-through режиме (SSO `login_audit.ip`, product `erp_connection.password_enc` шифруются «понарошку»).
- Postgres/RabbitMQ пароли без `${ENV:default}`-override в `application.properties` (4 сервиса).
- `mock-erp` endpoint hardcoded на `http://localhost:8040` (`RpaHtmlExtractorImpl` / `ApiExtractorImpl`) — в Docker сетевое имя `document-service:8040`, в docker-compose env override отсутствует.
- `AuthorizationServerConfig:52` ссылается на `http://127.0.0.1:8080/code` (legacy OAuth2 authorization-server, порт 8080 не используется).
- `spring.jpa.show-sql=true` в `organization-service` (шум в логах).
- `client/build/` коммитится в submodule (должно быть в `.gitignore`).

**Закрыто в session 2026-05-16/17/18** (см. §2.x для подробностей):
- §2.7 ERP login + default mode → onec
- §2.7.bis ERP credentials в БД (AES + CRUD + UI)
- §2.8 email (URL фикс + Gmail SMTP через JavaMailSender + .env wiring); 2026-05-18 диагноз: ISP блокирует SMTP outbound, проверено VPN → работает
- §2.9 unit_sku auto-gen + batch auto-create
- §2.10 + §2.16 Map.of NPE audit
- §2.11 Eureka 127.0.0.1 hardcoded
- §2.12 OAuth callback URLs → @Value
- §2.13 JWT issuer → @Value
- §2.14 EmployeeAnalyticsService cleanup
- §2.15 Inventory PESSIMISTIC_WRITE
- §2.17 AnalyticsReportService ABC в PDF
- §2.18 OperationController.findById org-фильтр
- §2.19 @Scheduled replicas=1 в k8s
- §2.20 logging.level правильные пакеты
- §2.23 SSO smoke-test (2026-05-17)
- §2.24 frontend BACKEND_URL
- §2.25 JwtAuthenticationFilter @Component
- §2.26 keystore untracked + gitignored (2026-05-18)
- §2.27 gateway filter reactive-fix (blocking-on-eventloop) + self-heal на keypair-mismatch (2026-05-18)
- §4 I5 (Redis JWT cache + rate-limit removed; hotfix 2026-05-18)
- §4.1 Flyway-миграции удалены (parity с sql-scripts подтверждена)

**Минимум до защиты:** §4.2 docker-compose check + §2.6 RPA-1 + §2.8 SMTP-стратегия = **2-2.5 дня**.
**Желательно:** + §2.21 CORS + §2.22 OAuth secrets + §2.28 keypair rotation = **+0.5 дня**.

---

## 7. Где смотреть детали

- **HP-1 / HP-2** — `BACKEND_HP_BACKLOG.md` (полный контекст, файлы, acceptance).
- **`Требования к *Service.txt`** — authoritative business requirements.
- **`backend/CLAUDE.md`** — конвенции backend (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **`client/CLAUDE.md`** — конвенции frontend (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
