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

### Что открыто

- ~~**§1.5 фундамент (P0)** — MinIO + `GeneratedDocument` registry + `DocumentNumberService` + Workflow PAUSED при приёмке~~ ✅ **DONE 2026-05-13**. Compile + unit-tests зелёные. См. §1.5 «Что появилось в коде».
- ~~**HP-1 RPA-шаблоны** (§1) — 4 RPA-generator'а + picking-list PDF~~ ✅ **DONE 2026-05-13** (generator'ы + cleanup мёртвых case'ов release-order/shipment-order/invoice-fact/discrepancy-act). 10 типов в `DocumentController`/`PdfDocumentService`/`DocumentRpaService`.
- ~~**HP-2 пагинация**~~ ✅ **DONE 2026-05-13** — backend (product-service 10 endpoint'ов + warehouse-service 3 endpoint'а) + фронт (5 страниц: SuppliesPage, ShipPage requests, ReceivePage history, AnalyticsPage Operations, DocumentsPage migrated на `/api/document-registry`). Также добавлен `/api/document-registry/**` в `GatewayConfig.product-api`.
- **§1.5 P1** — Export flow: ✅ **DONE 2026-05-13** (backend + фронт). Backend: миграция V7, enums ShipmentType/DocumentLayout/DomesticDocumentKind, ShipmentRequest entity + DTO + service + saga `documentIds: List<UUID>` + compensation через MinIO removeObject. Фронт: ShipPage CreateRequestDialog — чекбокс «На экспорт» на шаге 1, conditional UI (DOMESTIC: radio ТН/ТТН + horizontal/vertical; EXPORT: dropdown валюта USD/EUR/RUB/CNY + recipientCountry + recipientGln), summary на шаге 3, yup-схема с conditional валидацией (EXPORT запрещает BYN), `shipRequestService.complete()` без `documentTypes`. Inventory tooltip (Q6) — отдельный мелкий фронт-таск, не сделан.
- **RPA-расширение** (§2) — **2 категории**: (1) **read-only парсинг 1С** через WinAppDriver (у инсталляции пользователя нет открытого API), (2) ✅ **RPA-2 Office bot закрыт 2026-05-13** — `OfficeDocumentBot` (`document-service/rpa/`) + endpoint `POST /api/documents/office/fill`. Требует Windows + MS Office + WinAppDriver на 127.0.0.1:4723, включается `rpa.office.enabled=true`. Доступ к 1С — ожидаем.
- **F5 дизайн-система poyasn** (§3) — материалы у пользователя для следующей сессии.
- **I5 Redis для api-gateway** (§4) — P2 (rate-limiter на /login).

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

~95% backend, ~95% frontend (на 2026-05-12). До защиты: **§1.5 P0 (MinIO + DocNumber + Workflow PAUSED) + HP-1 + HP-2 + §2 RPA-2 (Office bot) + RPA-1 (1С парсинг)**. F5 design — параллельно.

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

6. **Текущее coverage:** **525 backend-тестов**, JaCoCo ≥50% во всех 5 сервисах. **Не ронять** — при изменениях смотри что новые методы покрыты или существующие тесты остались валидны. Запуск: `gradle allTestWithCoverage` (без Docker), `gradle allIntegrationTest` (с Docker).

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

### Что появилось в коде (для контекста новых сессий)

**Миграции product-service (Flyway):**
- `V4__document_counters.sql` — таблица `document_counters (organization_id, document_type, year, counter)` для DocumentNumberService.
- `V5__generated_documents.sql` — таблица `generated_documents` для registry.
- `V6__operation_status.sql` — колонка `status` в `product_operation` (default `COMPLETED`, для существующих строк).

DDL также прописан в `sql-scripts/productDB.sql` (для первого старта пустой БД через docker-compose).

**Новые классы product-service:**
- `model.entity.DocumentCounter` + `DocumentCounterId` (composite PK).
- `model.entity.GeneratedDocument`.
- `model.enums.OperationStatus { PENDING, RECEIVED, PAUSED, COMPLETED, CANCELLED }`.
- `repository.DocumentCounterRepository` — `findForUpdate` с `@Lock(PESSIMISTIC_WRITE)`.
- `repository.GeneratedDocumentRepository`.
- `service.DocumentNumberService.next(orgId, type)` → `{ПРЕФИКС}-{YYYY}-{NNNNN}`. Префиксы: ПО, АП, ТТН, ТН, CMR, ИНВ, ПЕР, СПС, И, ЛП.
- `service.DocumentRegistryService.register(opId, type, payload, orgId, userId) → GeneratedDocument`. Внутри: `DocumentClient.fetchPdf` → MinIO `putObject` → `repository.save`. Также есть `downloadBytes(...)` и `presignedUrl(...)`.
- `controller.DocumentRegistryController` (префикс `/api/document-registry`):
  - `GET /` — paginated список (фильтр по `?type=`).
  - `GET /{id}` — метаданные.
  - `GET /{id}/download` — PDF bytes (inline).
  - `GET /{id}/url` — presigned URL (TTL по `minio.presigned-url-ttl-minutes`).
  - `GET /by-operation/{operationId}` — все документы по операции.
- `config.MinioConfig` — `MinioClient` bean, `@PostConstruct` создаёт bucket если его нет.
- `dto.request.DiscrepancyRequest` + nested `DiscrepancyItem`.

**Изменения в product-service существующих классов:**
- `client.DocumentClient` — старые методы `generateReceiptOrder` / `generateWriteOffAct` / `generateRevaluationAct` (возвращали UUID) **удалены**. Остался один `fetchPdf(type, payload, orgId) → byte[]`.
- `entity.ProductOperation` — добавлено поле `status: OperationStatus`. Default в `@PrePersist` = `COMPLETED` (backward-compat). `service.ProductOperationService.receiveProduct` явно ставит `PAUSED`.
- `repository.ProductOperationRepository` — добавлен `findByOperationIdAndOrganizationId(...)`.
- `controller.OperationController`:
  - `receiveProduct` теперь регистрирует **два** документа (`receipt-order` + `receipt-act` с пустыми `discrepancies`), статус операции `PAUSED`, ответ содержит `receiptOrderId/Number` и `receiptActId/Number`.
  - `revaluate` / `writeOff` мигрированы на `DocumentRegistryService.register`.
  - Новые endpoint'ы:
    - `POST /api/operations/{id}/complete` (WORKER) — `PAUSED → COMPLETED`.
    - `POST /api/operations/{id}/discrepancy` (WORKER) — регистрирует акт о расхождении, статус остаётся `PAUSED`.
    - `POST /api/operations/{id}/approve` (DIRECTOR) — `PAUSED → COMPLETED`.

**docker-compose.yml:**
- Сервис `minio` (ports 9000 API, 9001 console; creds `wmsadmin / wmsadmin12345`).
- Сервис `minio-init` — на старте создаёт bucket `wms-documents` через `mc`.
- Том `minio_data`.

**application.properties (product-service):**
```properties
minio.endpoint=http://localhost:9000
minio.access-key=wmsadmin
minio.secret-key=wmsadmin12345
minio.bucket=wms-documents
minio.presigned-url-ttl-minutes=15
```

**build.gradle (product-service):** добавлена `implementation 'io.minio:minio:8.5.10'`.

**document-service stateless:**
- `DocumentService.records` (ConcurrentHashMap) **удалён**. Метод `generate(type, data, orgId, format)` возвращает `byte[]` напрямую.
- `DocumentController` endpoints теперь возвращают `ResponseEntity<byte[]>` с `application/pdf` (или xls/docx по `?format=`).
- Удалены endpoint'ы `GET /api/documents/{id}` (получение по UUID), `GET /api/documents/{id}/metadata`, `GET /api/documents` (paginated) — функционал переехал в product-service `/api/document-registry`.
- Удалены endpoint'ы для `release-order`, `shipment-order`, `invoice-fact`, `discrepancy-act` (вычеркнуты ещё на этапе planning §0.1 Q1).
- Удалены тесты `DocumentControllerTest`, `DocumentServiceTest`, `DocumentControllerIntegrationTest` (тестировали удалённый in-memory контракт). `PdfDocumentServiceParameterizedTest` оставлен — он тестирует PDF-генерацию напрямую, существующие методы `PdfDocumentService` пока на месте (будут почищены в HP-1).

**Тесты, переписанные под новый контракт:**
- `DocumentClientTest` — теперь тестирует `fetchPdf`.
- `OperationControllerTest` — мок на `DocumentRegistryService`.
- `ReceiveOperationContainerTest`, `WriteOffOperationContainerTest`, `ShipSagaFullContainerTest`, `ShipmentRequestContainerTest` — `@MockBean DocumentClient` → `@MockBean DocumentRegistryService`.

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

## 2. RPA-расширение ❌ PENDING

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

### 2.6 План на следующую сессию (порядок)

1. **`OfficeDocumentBot`** (RPA-2) — локальный MS Word/Excel через WinAppDriver. Не зависит от 1С. Установить WinAppDriver, прокалибровать селекторы Excel (`NameBox`, `Ribbon`). ~1-1.5 дня. JACOB-резерв ещё +0.5 дня если потребуется. **Стартуем с этого.**
2. **`OneCWinAppExtractorImpl`** (RPA-1) — после получения доступа к 1С толстому клиенту. ~1.5-2 дня (1-1.5 дня код + 0.5-1 дня калибровка селекторов через Accessibility Insights). Сильно зависит от конфигурации 1С пользователя.

**Итого RPA-блок:** 2.5-3.5 дня при последовательной работе.

---

## 3. F5. Дизайн-система poyasn (Frontend, 1-2 дня) — P1

Текущая палитра в `client/src/config/theme.js` не совпадает с poyasn.

| Параметр | Сейчас | Должно быть |
|---|---|---|
| `primary.main` | `#005FF9` | `#1976D2` |
| `secondary.main` | `#FFD600` | `#FFE673` |
| `error.main` | — | `#D32F2F` |
| `warning.main` | — | `#ED6C02` |
| `success.main` | — | `#2E7D32` |
| `fontFamily` | `Manrope` | `Gantari, Jost, Arial, sans-serif` |

**Шаги:**
- `npm install @fontsource/gantari @fontsource/jost` + импорт в `index.js`.
- Миграция `theme.js`, иерархия H1-H4.
- Прогнать 22 страницы: `variant="h5/h6"` → консистентные `h2/h3`.

Материалы (фирменный стиль) пользователь подгружает к следующей сессии.

---

## 4. I5. Redis для api-gateway (P2, 0.5-1 день)

В коде: Caffeine-конфиг **мёртвый** (нет `@Cacheable`); реальный in-memory кеш — private-поля `cachedPublicKey` + `lastKeyFetchTime` в `JwtAuthenticationFilter`. Redis уже подключён, `RedisRateLimiter` задекларирован, но не применён ни к одному маршруту.

**Что делать:**
- (a) Удалить мёртвый Caffeine-конфиг из `application.properties` (2 строки).
- (b) Распределить public-key cache: `ReactiveStringRedisTemplate` + ключ `gw:jwt-public-key`, TTL 1h.
- (c) Активировать `RequestRateLimiter` на `/api/auth/login`, `/api/auth/refresh` — закрывает rate-limiting (§5 п.7).

Самое демонстративное для защиты — **(c)**: «1100 запросов на /login за минуту → 429».

---

## 5. Будущие расширения 💡 (P2/после защиты)

Не требуется ни poyasn, ни SRS — повышает зрелость дипломного решения:

1. Поддержка сканеров штрихкодов в UI (`<BarcodeScannerInput>` с debounce, beep, scan-mode).
2. Offline-mode для кладовщика (Service Worker + IndexedDB как очередь операций).
3. WebSocket / SSE-канал «склад → заведующий» (poyasn TO-BE 2.1.2).
4. Печать наклеек / штрихкодов (ZPL-генератор + endpoint в `document-service`).
5. Endpoint `/api/products/{id}/history` — лента событий по товару из Event Store (UI-таб).
6. Chaos-тест Saga: остановить product-service между `BATCH_CREATION` и `INVENTORY_UPDATE`, проверить recovery.
7. Rate limiting на api-gateway — закрывается через **I5 (c)**.
8. Валидация бизнес-правил BR-3..BR-6 как Strategy + Chain of Responsibility (`PlacementValidator`).
9. Импорт справочников из Excel (товары, поставщики).
10. e2e-тесты Playwright: логин, приёмка, отгрузка с FEFO, инвентаризация, переоценка, списание.

---

## 6. Дорожная карта (только открытое)

| Sprint | Цель | Оценка |
|---|---|---|
| ~~**§1.5 P0** 🔥~~ ✅ DONE | Фундамент: MinIO + GeneratedDocument + DocumentNumberService + Workflow PAUSED + 3 endpoint'а (complete/discrepancy/approve) | сделано 2026-05-13 |
| ~~**HP-1** 🔥~~ ✅ DONE | 10 типов документов (5 generator'ов + cleanup мёртвых case'ов) | сделано 2026-05-13 |
| ~~**HP-2**~~ ✅ DONE | Backend (product-service 10 + warehouse-service 3 endpoint'ов) + фронт (5 страниц: SuppliesPage, ShipPage requests, ReceivePage history, AnalyticsPage Operations, DocumentsPage). Все используют эталон Suppliers (TablePagination, page/rowsPerPage state, content/totalElements split). | сделано 2026-05-13 |
| ~~**Frontend миграция**~~ ✅ DONE | DocumentsPage (`/api/document-registry`) + кнопки workflow на ReceivePage («Принять без замечаний» / «Зафиксировать расхождение» + DiscrepancyDialog с типами SHORTAGE/SURPLUS/DEFECT/MISGRADE/OTHER) | сделано 2026-05-13 |
| ~~**§1.5.C Export flow**~~ ✅ DONE | Backend (V7+enums+saga.documentIds+MinIO compensation) + фронт ShipPage CreateRequestDialog (чекбокс/radio/dropdown + summary). Inventory tooltip (Q6) — отдельный мелкий таск | сделано 2026-05-13 |
| **§2 RPA** | (1) ⏳ read-only парсинг 1С через WinAppDriver — ждём доступа к 1С. (2) ✅ Office-bot DONE 2026-05-13: bot + endpoint `POST /api/documents/office/fill` + **интеграция как primary канал** через `X-Generation-Mode: auto\|rpa` header + `RpaTemplateBinding` (proof-of-concept на receipt-order) + fallback на POI с уведомлением + Settings UI toggle | 1.5-2 дня (только 1С + binding для остальных 9 типов) |
| **+ парал.** | F5 design system | 1-2 дня (фронт) |

**Порядок (следующая сессия):**
1. ~~**§1.5.D** DocumentNumberService~~ ✅
2. ~~**§1.5.A** MinIO + GeneratedDocument~~ ✅
3. ~~**§1.5.B** Workflow PAUSED + всегда-акт~~ ✅
4. ~~**HP-1** 5 generator'ов POI + picking-list PDF + cleanup мёртвых типов~~ ✅ DONE 2026-05-13
5. ~~**HP-2 product-service** — 10 endpoint'ов paginated~~ ✅ DONE 2026-05-13
6. ~~**HP-2 warehouse-service** — 3 endpoint'а (Warehouse.getAll/getByOrg, Rack.getRacksByWarehouse). `getCellsByRack`/`getSlotsByRack` оставлены без пагинации (polymorphic by rack.kind)~~ ✅ DONE 2026-05-13
7. ~~**HP-2 Frontend** — 5 страниц (SuppliesPage, ShipPage, ReceivePage history, AnalyticsPage Operations, DocumentsPage)~~ ✅ DONE 2026-05-13.
8. ~~**Frontend миграция §1.5**~~ ✅ DONE 2026-05-13. DocumentsPage + кнопки workflow на ReceivePage + DiscrepancyDialog.
9. **§1.5.C** Export flow (P1).
10. **§2 RPA**: ~~RPA-2 (Office)~~ ✅ DONE 2026-05-13 → **RPA-1** (read-only парсинг 1С через WinAppDriver, после получения доступа к 1С).

**Минимум до защиты:** §1.5 P0 + HP + §2 RPA-2 + RPA-1 = **~2.5-3 недели**.
**Полный план:** + §1.5 P1 + F5 + I5 = **~3-3.5 недели**.

---

## 7. Где смотреть детали

- **HP-1 / HP-2** — `BACKEND_HP_BACKLOG.md` (полный контекст, файлы, acceptance).
- **`Требования к *Service.txt`** — authoritative business requirements.
- **`backend/CLAUDE.md`** — конвенции backend (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **`client/CLAUDE.md`** — конвенции frontend (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
