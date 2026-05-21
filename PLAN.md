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

### Что открыто (актуально на 2026-05-19)

**Закрыто в этой и прошлых сессиях** (полный список в §2.x и §4): §1.5 P0+P1, HP-1, HP-2, Frontend миграция, RPA-2 Office bot (WAD-версия удалена 2026-05-19, заменена Python `rpa-service`), §2.7/§2.7.bis/§2.8/§2.9-2.20/§2.24/§2.25/§2.26/§2.27, §4 I5 (Redis cache + JWT filter, включая reactive-fix 2026-05-18), миграции Flyway удалены, rate-limit снят.

**Осталось открытое:**
- **§2 RPA-миграция** — WinAppDriver-стек удалён, заменён Python `rpa-service` (FastAPI, pywinauto + win32com). Готово: `backend/rpa-service/`, document-service интеграция. Осталось: product-service интеграция (`PythonRpaExtractor`), config-properties, e2e прогон. Подробности в §2.
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

## 1.5 Документная подсистема (QUESTIONS.md ответы) ✅ DONE 2026-05-13

Производные от решений в `QUESTIONS.md` (см. §0.1). Всё закрыто 2026-05-13.

- **1.5.A MinIO + `generated_documents` registry** — bucket `wms-documents`, entity `GeneratedDocument`, `DocumentRegistryService.register(...)` (генерит → грузит в MinIO → пишет row), endpoints `/api/operations/{id}/documents`, `/api/documents/{id}/download` (presigned URL), `/api/documents` (paginated). Frontend `DocumentsPage` + inline-секции на Receive/ShipPage. `document-service` теперь stateless (только bytes).
- **1.5.B Receive workflow** — `OperationStatus { PENDING, RECEIVED, PAUSED, COMPLETED }`. После приёмки всегда генерится `receipt-act` (пустой → `Акт приемки.RTF`; с расхождениями → `Акт расхождения.xls`). Endpoint'ы: `/api/operations/{id}/complete` (PAUSED→COMPLETED) и `/api/operations/{id}/discrepancy` (перегенерация + COMPLETED). Кладовщик = МОЛ, без director approval.
- **1.5.C Export flow** — `ShipmentRequest` расширен: `shipmentType (DOMESTIC|EXPORT)`, `currency`, `documentLayout (H|V)`, `domesticDocumentKind (TN|TTN)`, `recipientCountry`, `recipientGln`. DOMESTIC → 1 документ (ТН/ТТН × layout). EXPORT → пакет `transport-note + cmr + invoice`. `ShipSagaState.documentIds: List<UUID>`. `compensateShipSaga` реально удаляет MinIO objects + rows. Валидация «EXPORT с BYN запрещено». Frontend ShipPage 3-step wizard с чекбоксом «На экспорт» + branching.
- **1.5.D DocumentNumberService** — таблица `document_counters` (PK `org_id + type + year`), `next(orgId, type) → "{ПРЕФИКС}-{YYYY}-{NNNNN}"`, SELECT FOR UPDATE + INSERT-if-absent + RETURNING. Префиксы: ПО/АП/ТТН/ТН/CMR/ИНВ/ПЕР/СПС/И/ЛП.
- **1.5.E InventoryPage tooltip** — НСБУ № 126 текст на кнопке «Начать сессию».

**Что НЕ делаем (зафиксировано):** Q5 perishable timers / Q9 ЭТТН-ЭТН интеграция / SMTP уведомления при расхождении / 24-часовой таймер скрытых недостатков.

Wiring-карта в memory `project_wms_subsystems`. Schema в `sql-scripts/productDB.sql` (Flyway удалён, см. §4.1).

---

## 2. RPA-расширение — миграция на Python `rpa-service` 🚧 IN PROGRESS (Java ✅ + тесты ✅ 2026-05-19; остаётся §7 E2E на Windows-хосте)

### Контекст и решение

**Старая реализация (WinAppDriver / Appium / Java) удалена** — она была "никчёмная" (хрупкие селекторы Office Ribbon, нестабильное поведение Excel formulas, общая боль WAD-стека). Параллельно у нас уже был зрелый **Python RPA-проект** (`C:\Users\pavel\IdeaProjects\RPA`) на pywinauto + win32com, который умеет:
- парсить 1С УТ 11.2 (Заказы поставщикам + Заказы клиентов с фильтром по статусам)
- заполнять 9 Office-шаблонов (Инвойс / CMR×3 / ТН×2 / ТТН×2 / Переоценка / Списание / Приходный ордер / Акт расхождения / Инвентаризационная опись) с mock 1/5/10/50

**Решение:** Python — отдельный микросервис `rpa-service` на Windows-хосте (где живут 1С + MS Office). Backend ходит к нему по HTTP. В Docker/k8s он не упаковывается (COM-автоматизация требует Windows + Office + 1С).

### Архитектура интеграции

```
┌──────────────────────┐     POST /fill/{type}                ┌──────────────────────┐
│ document-service     │ ─────────────────────────────────────▶│ rpa-service          │
│ (mode=rpa)           │ ◀───────── bytes (.xlsx / .docx) ─────│ FastAPI, port 8060   │
│                      │                                       │ (Windows host)       │
│ mode=auto → POI/PDF  │                                       │                      │
└──────────────────────┘                                       │ Python:              │
                                                               │  - excel_filler      │
┌──────────────────────┐     POST /parse/supplies              │  - word_filler       │
│ product-service      │ ─────────────────────────────────────▶│  - onec_parser       │
│ (mode=onec)          │ ◀───────── supplies.json ─────────────│  - templates/        │
│                      │                                       │                      │
│ ErpExtractorJob      │                                       │ + MS Office          │
│ cron 03:00           │                                       │ + 1С УТ 11.2         │
└──────────────────────┘                                       └──────────────────────┘
```

**Фиксированные решения** (зафиксировано 2026-05-19):
1. **Service discovery:** внешний URL в конфиге (`rpa.python.base-url=http://win-host:8060`), без Eureka.
2. **Расположение кода:** `backend/rpa-service/` — рядом с Java-сервисами, но не Gradle-модуль.
3. **Auth:** нет (внутренняя сеть). PDF: нет (Python отдаёт native `.xlsx`/`.docx`; запрос `format=pdf&mode=rpa` фолбэчит на Apache POI).
4. **Удаляем только WAD-куски**, Apache POI / PDFBox (`mode=auto`) остаются как primary канал.

### Что ✅ сделано (2026-05-19)

- `backend/rpa-service/` — FastAPI (`api.py`) + 9 рабочих типов документов + парсеры supplies/sales, 14 Office-шаблонов, `run.ps1`.
- WAD-классы удалены: `OfficeDocumentBot`, `RpaTemplateBinding`, `OfficeFillRequest`, `OneCWinAppExtractorImpl`.
- `document-service`: `PythonRpaClient` (RestClient), `DocumentService` mode=rpa → Python с фолбэком (`channel=rpa-fallback-error`), `DocumentController` без office-эндпоинтов.
- `RpaProperties.Python` в обоих сервисах (`enabled`, `baseUrl`, `timeoutSeconds`).

### Статус по пунктам ✅

| # | Что | Статус |
|---|---|---|
| 4 | product-service: `RpaProperties.Python`, `PythonRpaExtractor` (`@Component("oneCExtractor")`, flatten supplies.json в `{externalId, supplierName, productName, expectedQuantity, expectedDate}` с composite key `<supply.external_id>#<sku\|row>`), `application.properties` + `rpa.python.*` + `erp.extraction.mode=onec`, старый `rpa.properties` удалён | ✅ 2026-05-19 |
| 5 | document-service `application.properties` + `rpa.python.*`, `rpa.properties` оставлен только для Apache POI templates | ✅ 2026-05-19 |
| 6 | Cleanup — `documents template/` + `RpaProperties.Templates` оставлены для Apache POI. `:document-service:compileJava :product-service:compileJava` BUILD SUCCESSFUL, в main нет ссылок на удалённые WAD-классы | ✅ 2026-05-19 |
| 6a | Тесты: `DocumentServiceTest` и `DocumentControllerTest` переписаны — убраны `OfficeDocumentBot`/`RpaTemplateBinding`/`OfficeFillRequest`, добавлены 2 кейса для `PythonRpaClient` (success → `channel=rpa`, fail → `channel=rpa-fallback-error`). `:document-service:test` зелёный | ✅ 2026-05-19 |
| 8 | `backend/CLAUDE.md` раздел `## RPA channels` переписан под двухканальную модель | ✅ 2026-05-19 |

### Что ❌ осталось

#### 7. End-to-end проверка (ручная, нужен Windows + 1С + Office)

- **a)** Python `/health` — `curl http://localhost:8060/health` → 200 + список support'ируемых типов.
- **b)** Через WMS document-service: `POST /api/documents/invoice` с `X-Generation-Mode: rpa` + payload → получить `.docx` bytes + header `X-Generation-Channel: rpa`. Готовый smoke: `.\smoke-rpa.ps1 -Jwt "<token>"`.
- **c)** Через WMS product-service: `POST /api/erp-extractor/run?mode=onec` → в логах `PythonRpaExtractor: flattened N item-row(s) из M supply(es)`, в `planned_deliveries` новые строки. Smoke: `.\smoke-rpa.ps1 -Jwt "<token>" -OneC`.

Скрипт `smoke-rpa.ps1` в корне проекта прогоняет (a) и (b) автоматом, (c) опционально по флагу.

### Как запустить rpa-service (Windows-хост)

**Один раз — создать venv и поставить зависимости:**

```powershell
cd backend\rpa-service\python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ..\requirements.txt
deactivate
```

**Каждый раз — старт сервиса:**

```powershell
cd backend\rpa-service
.\run.ps1                          # auto-создаст .venv если нет; стартует uvicorn на 0.0.0.0:8060
.\run.ps1 -Port 8060               # сменить порт
.\run.ps1 -BindAddress 127.0.0.1   # bind только на localhost (НЕ -Host — $Host зарезервирован в PowerShell)
```

Скрипт сам делает `python -m venv .venv` и `pip install -r requirements.txt` если venv отсутствует, потом запускает `uvicorn rpa.api:app`.

**Smoke-проверка после старта** (отдельная консоль):

```powershell
# 1) health
curl http://localhost:8060/health
# → {"status":"ok","templates_count":N,"supported_doc_types":[...]}

# 2) fill — пример для invoice (вернёт .docx bytes, проверь Content-Disposition)
curl -X POST http://localhost:8060/fill/invoice `
     -H "Content-Type: application/json" `
     -d '{\"documentNumber\":\"INV-1\",\"sellerName\":\"Test\",\"buyerName\":\"Test2\",\"items\":[]}' `
     --output out.docx

# 3) parse/supplies (1С должна быть запущена и открыта на «Заказы поставщикам»)
curl -X POST http://localhost:8060/parse/supplies
```

**Требования к хосту:**
- Windows (любой), Python 3.11+ (рекомендуется 3.12).
- MS Office (Excel + Word) — для `/fill/*`. `win32com` дёргает COM.
- 1С УТ 11.2 запущенная вручную, открыта на нужном журнале — для `/parse/supplies` и `/parse/sales`. `pywinauto` ходит по UIA.
- Не запускается в Docker/k8s/Linux — COM нет.

**Что выставить в WMS-сервисах** (если Python на другом хосте):

```properties
# document-service application.properties + product-service application.properties
rpa.python.base-url=http://win-host:8060
```

или env-vars `RPA_PYTHON_BASE_URL=http://win-host:8060` (читаются обоими сервисами).

### Поддержка типов документов в Python-канале

| WMS type | Наш суффикс | Статус |
|---|---|---|
| `receipt-order` | ПриходныйОрдер | ✅ |
| `inventory-report` | ИнвентаризационнаяОпись | ✅ |
| `revaluation-act` | АктПереоценки | ✅ |
| `write-off-act` | Списание | ✅ |
| `invoice` | Инвойс | ✅ |
| `discrepancy-act` | АктРасхождения | ✅ |
| `transport-note` (layout=horizontal/vertical) | ТН-горизонт / ТН-вертикаль | ✅ |
| `waybill` (layout=horizontal/vertical) | ТТН-горизонт / ТТН-вертикаль | ✅ |
| `cmr` (language=ru/en/ru-only) | CMR / CMR-EN / CMR-RU | ✅ |
| `picking-list` | — | ❌ HTTP 501 (нет шаблона) |
| `placement-list` | — | ❌ HTTP 501 |
| `receipt-act` | — | ❌ HTTP 501 (`discrepancy-act` покрывает discrepancy-case) |
| `release-order` / `shipment-order` | — | ❌ HTTP 501 |

Для типов без шаблона можно либо добавить новые шаблоны в `templates/` и зарегистрировать в `templates_spec.py`, либо клиент использует `mode=auto` (Apache POI server-side).

---

## 4. I5. Redis для api-gateway ✅ DONE 2026-05-17 (hotfix 2026-05-18)

Caffeine выпилен. JWT public-key cache → Redis (`gw:jwt-public-key`, TTL 1h) + self-heal при mismatch. Hotfix 2026-05-18: фильтр обёрнут в `Mono.fromCallable(...).subscribeOn(boundedElastic())` (был `.block()` на Netty event-loop). Rate limiter снят (WMS-юзеры за одним NAT → ломает UI-burst'ы; anti-brute-force через SSO `login_audit`).

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

## 4.1 Flyway миграции удалены ✅ 2026-05-17

`backend/<service>/src/main/resources/db/migration/V*.sql` никогда не подключались (нет `org.flywaydb` зависимости). DDL давно дублирован в `sql-scripts/*.sql` (парность проверена 2026-05-17). 4 директории `db/migration/` удалены. **Правило:** схема правится только в `sql-scripts/<service>DB.sql`.

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

## 5.2 Известные дефекты после UI-теста 2026-05-19 🐞 OPEN

Найдены при ручном прогоне UI (DIRECTOR-флоу: приёмка / переоценка / списание / инвентаризация / документы / mode=rpa).

| # | Файл/место | Описание | Статус | Приоритет |
|---|---|---|---|---|
| D-1 | `document-service/client/OrganizationClient` → `organization-service` | Internal HTTP-вызов из document-service в org-service отдаёт **403** даже после добавления `X-User-Role: DIRECTOR` + `X-Organization-Id`. У org-service в `/api/organizations/{id}` есть RBAC, который дополнительно проверяет orgId самого пользователя по тенант-фильтру. **Workaround:** клиент возвращает `new HashMap<>()` → `DataEnrichmentService` идёт с пустыми реквизитами. UI получает документ без названия организации в шапке. **Fix-направления:** либо завести `/api/internal/organizations/{id}` (whitelist в JwtFilter), либо передавать в OrganizationClient токен service-account. | ❌ OPEN | P1 |
| D-2 | `product-service/InventoryCheckService.completeInventory` | После `POST /api/inventory-check/{id}/complete` инвентаризационная опись **не появляется** в `generated_documents` (хотя код `documentRegistryService.register("inventory-report", …)` встроен, ошибка глушится в catch). Гипотезы: `session.organizationId == null` для старых сессий / `DocumentClient.fetch` падает с тем же 403 что в D-1 / MinIO bucket недоступен. **Нужно**: посмотреть логи product-service при complete, искать `ERROR Не удалось сгенерировать инвентаризационную опись` или `WARN Сессия ... без organizationId`. | ❌ OPEN | P1 |
| D-3 | `document-service/rpa/DocumentRpaService` (.doc / .RTF / legacy .xls шаблоны) | Apache POI HWPF (`blank-invojs.doc`, `CMR.doc`) и String.replace по RTF (`Акт приемки.RTF`) производят файлы, которые Word/Excel не открывают. **Workaround сделан 2026-05-19**: `DocumentService.generate` для программного канала всегда возвращает PDF (PDFBox + DejaVuSans). `?format=xlsx`/`?format=docx` игнорируется. **Долгосрочный fix:** конвертировать `.doc`/`.RTF` шаблоны в `.docx`, переписать `generateInvoice`/`generateCmr`/`generateReceiptActRtf` с XWPFDocument. | 🟡 WORKAROUND | P2 |
| D-4 | `rpa-service/python/rpa/api.py` Content-Disposition latin-1 crash | Кириллица в filename падала со `UnicodeEncodeError`. **Закрыто 2026-05-19**: RFC 5987 `filename*=UTF-8''<percent>` + ASCII fallback. Нужен **рестарт rpa-service**. | ✅ FIXED | — |
| D-5 | `DocumentRegistryService.fileFormat` по `channel` | Раньше `channel="rpa"` → всегда `xlsx`, но Python для `write-off-act` / `cmr` / `invoice` отдаёт `.docx`. Excel/Word отказывались открывать. **Закрыто 2026-05-19**: `detectFileFormat()` по Content-Type / filename / magic bytes из `DocumentClient.Fetched`. | ✅ FIXED | — |
| D-6 | `InventoryCheckService` логика недостачи | При недостаче (actual < expected) автоматически уменьшалась `inventory.quantity` И помечалось к списанию → нечего списывать в WriteoffPage. **Закрыто 2026-05-19**: при недостаче `quantity` не трогаем, только `markedForWriteoff=true`. Бухгалтер списывает через акт → `quantity` уменьшается. По НСБУ N 126. | ✅ FIXED | — |
| D-7 | Frontend Inventory ввод дробных | `step="0.01"` → требовалась дробь с 2 знаками. **Закрыто 2026-05-19**: `step="any"`, placeholder «например 12.5». Точка обязательна (HTML number input не принимает запятую). | ✅ FIXED | — |
| D-8 | Inventory таблицы Списание/Переоценка показывали UUID товара | **Закрыто 2026-05-19**: `InventoryResponse` расширен `productName` + `productSku`, `InventoryService` делает batch-fetch `ProductReadModel`. Фронт показывает «Стинол двухкамерный» + русский Chip статуса (AVAILABLE → Доступен и т.д.). | ✅ FIXED | — |
| D-9 | Gateway 401 без тела → axios «Request failed with status code 401» | **Закрыто 2026-05-19**: JSON-тело `{status, error: "Требуется авторизация", message: "Сессия истекла. Войдите заново."}`. | ✅ FIXED | — |
| D-10 | product-service `GlobalExceptionHandler` отдавал `"Internal Server Error"` / `"Validation Failed"` на английском | **Закрыто 2026-05-19**: `localizedStatus(HttpStatusCode)` → русские reason phrases, `error: "Ошибка валидации" / "Внутренняя ошибка сервера"` и т.д. | ✅ FIXED | — |
| D-11 | Settings RPA-индикатор всегда «РПА-бот недоступен» | Фронт звал удалённый `/api/documents/office/health` → 404. **Закрыто 2026-05-19**: новый endpoint `GET /api/documents/rpa/health` проксирует `PythonRpaClient.isAvailable()` → `{enabled, channel, reason}`. UI переписан под Python rpa-service. | ✅ FIXED | — |

---

## 5.3 Правки директорского флоу 2026-05-21 ✅ DONE 2026-05-21

Получены ручным прохождением UI пользователем (директор-флоу). 7 базовых задач закрыты + 3 раунда правок по фидбэку. Все правки подтверждены проходом UI:

- **Раунд 1** (DIR-1.1 … DIR-1.6 + DIR-BUG-SESS): жёсткий guard DIRECTOR без org · countdown подтверждение удаления · каскадное удаление DIRECTOR/org/employees/warehouses/products/MinIO · УНП→ИНН · статус+нагрузка ячеек · FRIDGE→storageConditions + Product.requiredStorageCondition · DELETE login_audit при terminate + Redis cleanup.
- **Раунд 2**: блок «Канал генерации документов» удалён из настроек (выбор канала только в операциях) · грузоподъёмность на уровне стеллажа для всех 3 типов (SHELF/CELL/PALLET), слоты — только габариты · защита от exception в Redis pattern-scan завершения сессий (try/catch на BCrypt.matches).
- **Раунд 3**: `EmailService.EmailDeliveryException` с дружественным сообщением вместо SMTP-трейсбэка · `WarehouseAnalyticsService` пересобран под новую модель (`racksByKind`, `racksByStorageConditions`, `totalSlots/occupiedSlots/utilizationPercent` через `ProductClient.getCellsLoad`) · `AnalyticsPage` Обзор + вкладка «Склады» подключены к новым полям + сводная карточка по сети складов с Chip'ами типов и температурных зон.

Дальнейшие правки в этой сессии — по флоу **Работника**.

| # | Файл/место | Описание | Статус | Приоритет |
|---|---|---|---|---|
| DIR-1.1 | `client/src/routes/AppRouter.js`, `MainNavbar.js`, `MainPage.js` | DIRECTOR без `organizationId` сейчас попадает на `/analytics` и др. Нужен жёсткий guard `OrgRequiredRoute`: разрешены только `profile/settings/organization`. В меню скрыть недоступные пункты. | ✅ FIXED 2026-05-21 | P1 |
| DIR-1.2 | `client/src/components/shared/ConfirmDialog.js`, `pages/SettingsPage.js` | При удалении аккаунта 10-секундный таймер сейчас отображается как `Удалить (5)` — выглядит как баг сети. Добавить `LinearProgress` + явный текст «Кнопка станет активной через N с». | ✅ FIXED 2026-05-21 | P2 |
| DIR-1.3 | SSO + organization-service + warehouse-service + product-service + MinIO | При удалении DIRECTOR-аккаунта сейчас организация архивируется (статус ARCHIVED). Заменить на **полное каскадное удаление**: org + employees-пользователи + warehouses + racks + cells + products + batches + inventory + supplies + suppliers + operations + documents (включая MinIO). Email директора освобождается для повторной регистрации. Опубликовать новое событие `organization.deleted` (вместо `organization.archived`). | ✅ FIXED 2026-05-21 | P0 |
| DIR-1.4 | `OrganizationService:56,155`, `SupplierService:55,86`, `SupplierController:62`, request-DTO @NotBlank/@Pattern/@Schema | В пользовательских сообщениях «УНП» заменить на «ИНН» (по `project_belarus_compliance` — в UI пишем ИНН, в API-DTO поле `unp` остаётся). | ✅ FIXED 2026-05-21 | P2 |
| DIR-1.5 | `warehouse-service/RackService`, `product-service` `/api/internal/inventory/cells-load`, `client/OrganizationPage.js` | Таблица ячеек/полок/паллет-мест слишком пустая. Добавить колонки «Статус» (Доступна/Заполнена) и «Загрузка» (количество единиц на ячейке). Точный вес не считаем — вариант B (просто `itemsCount` через cross-service internal endpoint). | ✅ FIXED 2026-05-21 | P2 |
| DIR-1.6 | `RackKind` enum + `Fridge` entity + `StorageConditions` enum + `Product.requiredStorageCondition` + `PlacementService` + `RackDialog.js` | Убрать `FRIDGE` как тип стеллажа. Добавить отдельный атрибут «Условия хранения» (ROOM/COOL/FRIDGE/FREEZER с температурными подписями). Привязать `Product.requiredStorageCondition` и фильтровать placement в FEFO. Схема БД пересоздаётся через wipe (вариант b — БД пустая, миграции не нужно). | ✅ FIXED 2026-05-21 | P1 |
| DIR-BUG-SESS | `SSOService/ProfileService.terminateSession`, `SettingsPage.js` | При завершении сессии запись в `login_audit` только `is_active=false` (UPDATE), refresh token в Redis не трогается. У текущей сессии вообще нет кнопки «Завершить». Поведение: `terminateSession` делает **DELETE** + если сессия = текущая → удалить Redis-токен + frontend делает logout с редиректом. | ✅ FIXED 2026-05-21 | P1 |

Acceptance: все 7 пунктов закрыты, UI прогон директор-флоу не показывает регрессий.

---

## 5.4 Правки флоу Кладовщика (WORKER) — блок 1 ✅ DONE 2026-05-21

**Цель**: объединить поставки и приёмку в один флоу, перестать терять данные при RPA-парсинге, добавить JSON-импорт, поддержать формат доставки (паллет/коробка) и quantityOnly-поставки.

### Концептуальный сдвиг

`PlannedDelivery` (плоская «одна row = одна позиция») **сносится полностью**. Парсинг (1С и JSON) пишет напрямую в **многострочную** `Supply` + `SupplyItem` со статусом `PLANNED`. Worker видит единый список поставок и принимает их. Это закрывает W-1.1, W-1.2 (включая «куда уходят данные»), и убирает дублирующиеся страницы `/main/supplies` / `/main/erp-extractor`.

### Согласованные решения (пользователь подтвердил 2026-05-21)

1. `PlannedDelivery` — выпилить полностью (entity + repo + controller + sql-таблица).
2. `quantityOnly` поставка: worker свободно выбирает товары при приёмке; sum(actualQty)≤plannedTotal — мягкое предупреждение, не блокер.
3. JSON-схема: обязательные поля (supplier+items+product+batch+packaging+финансы) — жёсткая валидация; опциональные блоки (transport/commission/international/writeoff) — принимаются и пишутся в `Supply.snapshot JSONB`, чтобы данные не терялись если поставщик пришлёт полный JSON.
4. ErpExtractorPage сносим (URL RPA — только в `application.properties`).
5. Маршрут — `/main/receive` (один пункт в навбаре «Поставки»). `/main/supplies` и `/main/erp-extractor` удаляются.

### Задачи (трекинг)

| # | Слой | Файлы/место | Описание | Статус |
|---|---|---|---|---|
| W1-A | Backend (model) | `Supply`/`SupplyItem`/`ProductBatch`, enum `PackagingType`, `productDB.sql` | `Supply`+`externalId`/`source`/`quantityOnly`/`supplierName`/`currency`/`totalAmount`/`snapshot JSONB`. `SupplyItem`: `productId` nullable + snapshot товара + плановая партия + финансы + `packagingType` + `markedForWriteoff`. `ProductBatch.packagingType`. | ✅ DONE |
| W1-B | Backend (cleanup) | `PlannedDelivery*`, `ErpConnection*`, `ErpExtractor/Connection`-контроллеры, `planned_deliveries`+`erp_connection` SQL | Снесены entity/repo/controller/service + legacy `RpaHtmlExtractorImpl`/`ApiExtractorImpl` + интерфейс `PlannedDeliveryExtractor`. `OrganizationDeletionListener` — обновлены имена таблиц (`supplies`/`suppliers`). | ✅ DONE |
| W1-C | Backend (service) | `service/SupplyImportService.java` (новый) + `dto/import_/SupplyDto.java` | Единый импорт: найти/создать Supplier по unp/inn (новые методы в `SupplierRepository`), найти/создать Product по sku, создать Supply (PLANNED) + items. Идемпотентно по `(orgId, externalId)`. | ✅ DONE |
| W1-D | Backend (RPA) | `rpa/PythonRpaExtractor.java`, `rpa/ErpExtractorJob.java`, `rpa/SupplyExtractor.java` | Новый интерфейс `SupplyExtractor` возвращает `List<SupplyDto>`. `PythonRpaExtractor` парсит `supply_full.json` через snake_case ObjectMapper, дополнительные блоки (transport/commission/international/…) кладёт в `snapshot`. `ErpExtractorJob` делегирует в `SupplyImportService`. | ✅ DONE |
| W1-E | Backend (API) | `controller/SupplyImportController.java` (новый), `config/SupplyImportMapperConfig.java`, `resources/sample-supply.json` | `POST /api/supplies/import-1c` (DIRECTOR/WORKER), `POST /api/supplies/import-json` (multipart + ручная валидация обязательных полей), `GET /api/supplies/sample-json` (отдаёт файл-пример). Без новой зависимости — Jackson + ручные проверки. | ✅ DONE |
| W1-F | Backend (API) | `controller/SupplyController.java`, `dto/request/CreateSupplyRequest.java`, `dto/response/SupplyResponse.java`, `service/SupplyService.java` | Расширили DTO под snapshot товара + плановую партию + финансы + `packagingType` + `quantityOnly`. `SupplyService.create` корректно обрабатывает оба режима. | ✅ DONE |
| W1-G | Client (routes) | `routes/AppRouter.js`, `components/layout/MainNavbar.js`, `pages/MainPage.js`, `components/shared/PageBreadcrumbs.js`, `config/api.js`, удалены `SuppliesPage`/`ErpExtractorPage`/`ExtractDataDialog`/`erpConnectionService`/`erpExtractorService` | `/main/supplies` и `/main/erp-extractor` → `<Navigate to="/main/receive">`. В навбаре один пункт «Поставки». Сегмент `receive` → label «Поставки». | ✅ DONE |
| W1-H | Client (dialogs) | `components/receive/ImportSupplyDialog.js`, `services/supplyService.js` (`importFrom1c`/`importFromJson`/`downloadSampleJson`) | Меню «Запарсить ▾» (Из 1С / Из JSON / Скачать пример) + file picker + POST `/import-json` через multipart. Результат показывается с разбивкой по imported/skipped/errored + детали ошибок. | ✅ DONE |
| W1-I | Client (dialogs) | `components/receive/CreateSupplyDialog.js` | Переключатель `quantity-only` / детальный. Детальный — строки product/sku/qty/expectedExpiry/packagingType/storageConditions. Quantity-only — только число позиций. | ✅ DONE |
| W1-J | Client (wizard) | `pages/ReceivePage.js` | Добавлена колонка «Упаковка» (PALLET/BOX/CRATE/EACH) на каждом item, передаётся в payload приёмки. Кнопка «Дублировать» рядом с «Удалить» создаёт ещё одну строку того же товара с пустыми batch/expiry/qty — для разных партий с разными сроками. | ✅ DONE |
| W1-K | Docs | `PLAN.md`, `backend/CLAUDE.md`, `client/CLAUDE.md`, `CLAUDE.md` | Зафиксировано. CLAUDE.md обновляются ниже. | ✅ DONE |

### Сводка по структуре `Supply`/`SupplyItem` (новая)

```
Supply
├── supplyId, organizationId, supplierId, supplierName
├── warehouseId, status (PLANNED/IN_PROGRESS/ACCEPTED/REJECTED/CANCELLED)
├── externalId (UNIQUE per org), source (1C-Python/JSON/MANUAL), quantityOnly
├── expectedDate, actualDate, totalItems
├── currency, totalAmount
├── snapshot JSONB ← transport/commission/international/… из supply_full.json
└── items[] (если не quantityOnly)
       └── SupplyItem
            ├── productId (NULLABLE — материализуется при приёмке)
            ├── snapshot: productName, sku, barcode, category, unitOfMeasure, manufacturer, storageConditions
            ├── expectedQty, actualQty
            ├── unitPrice, vatRate, vatAmount, totalAmount
            ├── packagingType (PALLET/BOX/CRATE/EACH)
            ├── batch snapshot: batchNumber, manufactureDate, expiryDate, purchasePrice
            └── markedForWriteoff, notes
```

### Что НЕ закрыто и осталось в backlog

- Backend `ReceiveSagaService.createReceiveSession` пока не пробрасывает `packagingType` в `ProductBatch` (поле в SQL/entity есть, но саму запись делает saga step). Сейчас payload передаётся, бэк его игнорирует — нужно прокинуть через `ReceiveItem` → `ProductBatch.packagingType` (W-2 backlog).
- Wizard приёмки в quantity-only режиме пока работает «как обычно» — worker сам набирает позиции. Никакого спец-режима с пустыми planned items не сделали, потому что планов нет совсем. Если нужно — добавим валидацию `Σ(actualQty) ≤ plannedTotal` (W-2 backlog).
- `Supply` deletes/wipe для `OrganizationDeletionListener` обновлён под имена `supplies`/`suppliers`/`supply_items` — но прежние имена `supply`/`supplier` исчезли вместе с этим. Если в проде имели старую схему — нужно пересоздать БД (мы и так пересоздаём).

Acceptance: единая страница «Поставки», парсинг (1С/JSON) пишет полные supply+items без потерь, плановые поставки можно создать вручную (quantity-only/детально), приёмка работает с обоими режимами, packagingType виден в receive-формах и в реестре партий.

### Что НЕ в этом блоке (отложено)

- Полный набор полей `supply_full.json` (transport/commission/international) сохраняется в `Supply.snapshot` как JSONB, но UI его не показывает — это для финальной генерации документов.
- Отгрузки (`/main/ship`) не трогаем — пользователь явно сказал.

---

## 6. Дорожная карта (актуально на 2026-05-19)

**До защиты, по приоритету:**

| # | Задача | Статус | Оценка |
|---|---|---|---|
| 1 | **§2 RPA e2e smoke** — `.\smoke-rpa.ps1` на Windows с поднятым backend'ом + Python + 1С (опционально) | ⏳ ручная | 30 мин |
| 2 | **§4.2 docker-compose E2E** — поднять весь стек, прогнать BP-1/BP-2/BP-5 через UI | ❌ обязательно | 1-2 ч |
| 3 | **§2.28 JWT private-key ротация** (private key в git history) | ❌ security | 10 мин |
| 4 | **§2.21 CORS** на api-gateway + SSO (hardcoded на `localhost:3000`) | ❌ отложен | 1 ч |
| 5 | **§2.22 OAuth secrets** ротация + env-var | ❌ отложен (security) | 1-2 ч |
| 6 | **§5.1 Coverage 80%** | ⏳ 73.4% (+25% к baseline) | 0.5-1 день |

**Опциональные хвосты (минор):**
- `APP_DB_ENCRYPTION_KEY` пустой → AES в pass-through.
- Postgres/RabbitMQ пароли без `${ENV:default}`-override (4 сервиса).
- `mock-erp` hardcoded на `http://localhost:8040` (в Docker должно быть `document-service:8040`).
- `AuthorizationServerConfig:52` ссылается на legacy `http://127.0.0.1:8080/code`.
- `spring.jpa.show-sql=true` в organization-service.
- `client/build/` коммитится в submodule.

**Закрыто (история — детали в git log):** §2.7-2.27 (ERP login, AES creds, email/SMTP, unit_sku, Map.of NPE, Eureka, OAuth/JWT @Value, EmployeeAnalytics cleanup, PESSIMISTIC_WRITE, ABC в PDF, org-фильтры, replicas=1, logging, BACKEND_URL, JwtAuthFilter @Component, keystore gitignored, gateway reactive-fix), §4 I5 Redis, §4.1 Flyway удалён, §1.5 документная подсистема, §2 RPA-миграция (Java + тесты) — всё 2026-05-13..2026-05-19.

**Минимум до защиты:** smoke (0.5ч) + docker-compose check (1-2ч) = **~1.5-2.5 часа**.
**Желательно:** + CORS + OAuth secrets + keypair rotation = **+0.5 дня**.

---

## 7. Где смотреть детали

- **HP-1 / HP-2** — `BACKEND_HP_BACKLOG.md` (полный контекст, файлы, acceptance).
- **`Требования к *Service.txt`** — authoritative business requirements.
- **`backend/CLAUDE.md`** — конвенции backend (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **`client/CLAUDE.md`** — конвенции frontend (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
