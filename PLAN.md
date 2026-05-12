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

- **§1.5 фундамент (P0, NEW)** — MinIO + `GeneratedDocument` registry + `DocumentNumberService` + Workflow PAUSED при приёмке (см. §0.1 Q1+Q2+Q3+Q7). Делается **перед** HP-1.
- **HP-1 RPA-шаблоны** (§1) — 4 RPA-generator'а + picking-list PDF; **шаблоны уже загружены** в `documents template/`. Scope сокращён до 11 типов (см. §0.1).
- **HP-2 пагинация** на 11 endpoint'ах + 5 страницах фронта — эталон Suppliers готов, остальное pending.
- **§1.5 P1** — Export flow с чекбоксом «На экспорт» + пакет ТН+CMR+invoice (см. §0.1 Q4) + inventory tooltip (Q6).
- **RPA-расширение** (§2) — 4 канала: OData/1С + Selenium-ERP (web) + **WinAppDriver/JACOB для локального Word/Excel** + Appium/WinAppDriver для 1С толстого клиента. Доступ к 1С — ожидаем.
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
│       ├── controller/           — DocumentController (14 типов), MockErpController
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

~95% backend, ~95% frontend. До защиты: **HP-1 + HP-2 + F5 + (опционально RPA→1С)**.

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

5. **MockErpController** (`backend/document-service/src/main/java/by/bsuir/documentservice/controller/MockErpController.java`) — это **тестовая заглушка ERP** для демо/dev. Отдаёт login-форму + HTML-таблицу `<table id="deliveries-table">`. Используется RpaHtmlExtractorImpl + новым SeleniumErpExtractorImpl (§2.6). Не часть document-service по смыслу, переедет в отдельный модуль после защиты.

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

9. **PDF cyrillic:** `document-service` использует **DejaVuSans.ttf** (`src/main/resources/fonts/`). 13 PDF generate-методов в `PdfDocumentService` (14 типов документов через alias `shipment-order` → `generateReleaseOrderPdf`) корректно рендерят кириллицу — НЕ возвращайте `Standard14Fonts.HELVETICA`, иначе всё развалится на любом русском тексте.

10. **Memory feedback (важно):** no comments в коде, no tests без явного запроса, no commits без явного запроса, backend first приоритет, дата в PLAN.md в Russian формате.

---

## 1. Highest priority 🔥 (см. `BACKEND_HP_BACKLOG.md`)

### HP-1. RPA-шаблоны документов РБ ❌ PENDING

**Контекст.** Scope сокращён с 14 до **11 типов** документов (2026-05-12, после QUESTIONS.md). Удалены: `release-order`/`shipment-order` (alias-пара), `invoice-fact` (счёт-фактура), `discrepancy-act` (теперь — раздел внутри `receipt-act`, см. §0.1 Q1). Удалить из `DocumentController`, `DocumentService`, `DocumentRpaService`, `PdfDocumentService`, `stub-info`, тестов.

| # | Тип | PDF (PdfDocumentService, DejaVu Sans) | RPA POI шаблон (DocumentRpaService) |
|---|---|---|---|
| 1 | receipt-order (приходный ордер) | ✅ | ✅ `Приходной ордер.XLS` |
| 2 | revaluation-act (акт переоценки) | ✅ | ✅ `акт переоценки.xls` |
| 3 | inventory-report (инвентаризационная опись) | ✅ | ✅ `инвентарихационная опись.xls` |
| 4 | write-off-act (акт списания) | ✅ | ✅ `списание.docx` |
| 5 | waybill / ТТН | ✅ | ✅ `ттнls.xls` (+ `ttn-gor.xls` / `ttn-vert.xls` — выбор ориентации в payload) |
| 6 | picking-list (лист подбора) | ✅ PDF: шапка «Лист подбора № {shipmentNumber}» + таблица `Товар \| SKU \| Поставка \| Место \| Кол-во \| Ед.` | ⚠️ Без POI-шаблона — только PDF. |
| 7 | receipt-act (акт приёмки) | ✅ | 🟡 **Два шаблона, выбор по наличию расхождений:** `Акт приемки.RTF` (нет расхождений) / `Акт расхождения.xls` (есть расхождения, богатые поля п.40 N 1290). |
| 8 | invoice (инвойс) | ✅ | 🟡 Шаблоны `blank-invojs.doc` + `obrazec-invojs.doc` (заготовка + образец). |
| 9 | transport-note (ТН / товарная накладная) | ✅ | 🟡 Шаблоны `tn-gor.xls` + `tn-vert.xls` — выбор ориентации в payload. |
| 10 | cmr (международная) | ✅ | 🟡 Шаблон `CMR Международная товарно-транспортная накладная.doc` (актуальный на правила 01.01.2026). |
| 11 | (резерв) | | |

**Из PENDING осталось 4 generator'а** (receipt-act с 2 шаблонами, invoice, transport-note, cmr) + picking-list через PDF. picking-list — только PDF, без шаблона.

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
- Все **12 типов** работают на `?format=pdf`, `?format=xls`, `?format=docx`.
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

**Эталон готов на Suppliers**, не проверен в работающем стеке:
- Backend: `SupplierRepository` (Page<>-перегрузки), `SupplierService.getAll(orgId, Pageable)`, `SupplierController` (`@PageableDefault(size=20, sort="name")`, `MAX_PAGE_SIZE=100`).
- Frontend: `services/supplierService.list({page,size,sort})` (default size=1000 для autocomplete), `SuppliersPage` (локальный state + `<TablePagination>`).
- Контракт ответа: `Page<X>` (`content`, `totalElements`, `totalPages`, `number`, `size`) — **breaking**.

**Pending по тому же шаблону:**
- **product-service:** Supply, ShipmentRequest, Product (getAll/byCategory), Batch (byProduct/getAll), Inventory (byWarehouse/byProduct), Operation (markedItems), ErpExtractor (deliveries).
- **warehouse-service:** Warehouse (getAll/getByOrg), Rack (getRacksByWarehouse/getCellsByRack/getSlotsByRack).
- **Frontend:** SuppliesPage, ShipPage (requests + history), ReceivePage history tab, AnalyticsPage Operations tab, DocumentsPage (UI поверх уже-paginated бэка).

**Оценка остатка: ~2-2.5 дня.** Acceptance в `BACKEND_HP_BACKLOG.md §HP-2`.

---

## 1.5 Сопутствующие задачи (QUESTIONS.md ответы) 🔥 NEW

Производные от решений в `QUESTIONS.md` (см. §0.1). Делаются **в связке с HP-1**, так как HP-1 без них работает «в воздух» (документы in-memory, нет номеров, нет flow PAUSED).

### 1.5.A. MinIO + GeneratedDocument registry (Q1+Q2) — **P0**

**Что:**
1. **MinIO** в `docker-compose.yml`: сервис `minio/minio` с томом, портами 9000 (API) и 9001 (console). Bucket `wms-documents`. Креды через env.
2. **`product_db` → таблица `generated_documents`** (DDL в `sql-scripts/productDB.sql` + Flyway `V3__generated_documents.sql`):
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

### 1.5.B. Receive workflow: статус PAUSED + всегда-акт приёмки (Q1+Q3) — **P0**

**Что:**
1. **ProductOperation** — добавить enum `OperationStatus { PENDING, RECEIVED, PAUSED, COMPLETED }`. Колонка `status` в `product_operation_events` + read-model. Миграция Flyway `V4__operation_status.sql`.
2. **OperationController.receiveProduct** — после `receiveProduct()`:
   - Создать `ReceiveSagaState` (уже есть).
   - **Всегда** генерить `receipt-act` через `DocumentRegistryService.register("receipt-act", payload, ...)` с пустым `discrepancies: []` → шаблон `Акт приемки.RTF`.
   - Также генерить `receipt-order` (как сейчас).
   - Установить `OperationStatus.PAUSED` — операция ждёт «продолжить» (WORKER подтверждает приёмку) или «зафиксировать расхождение» (WORKER заполняет форму расхождений).
3. **Новые endpoint'ы**:
   - `POST /api/operations/{id}/complete` (WORKER) — статус `PAUSED → COMPLETED`.
   - `POST /api/operations/{id}/discrepancy` (WORKER) — принимает `List<DiscrepancyItem> discrepancies` (productId, expectedQty, actualQty, defectDescription). **Перегенерирует** `receipt-act` с шаблоном `Акт расхождения.xls`, новый документ в MinIO + БД. Статус остаётся `PAUSED` (ждёт решения руководителя).
   - `POST /api/operations/{id}/approve` (DIRECTOR) — утверждение акта расхождения, статус `PAUSED → COMPLETED`.
4. **Frontend ReceivePage**:
   - После приёмки на странице операции — два больших action-button'а: «Принять без замечаний» / «Зафиксировать расхождение».
   - Форма расхождений: для каждого товара — фактическое количество + описание дефекта.
   - После submit'а — операция в `PAUSED`, видна в списке «Незавершённые приёмки».

**Что НЕ делаем** (Q3 ответ): SMTP-уведомления поставщику, 24-часовой таймер, регистрация ответа представителя. Это операционная ответственность сотрудников вне системы.

**Оценка: 2-3 дня** (статус + 3 endpoint'а + миграция + 2 формы фронта).

### 1.5.C. Export flow: чекбокс + ТН/ТТН/CMR пакет (Q4) — **P1**

**Что:**
1. **ShipmentRequest** — добавить `shipmentType: ShipmentType { DOMESTIC, EXPORT }` + `currency: String` (ISO 4217 — BYN/USD/EUR/RUB; default `BYN`). Миграция `V5__shipment_export.sql`.
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

### 1.5.D. DocumentNumberService (Q7) — **P0** (нужен для 1.5.A)

**Что:**
1. **`product_db` → таблица `document_counters`** (Flyway `V6__document_counters.sql`):
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

### 1.5.E. Frontend мелочи (Q6) — **P1**

- **Q6**: tooltip на кнопке «Создать инвентаризацию» в `InventoryCheckPage`: «По НСБУ N 126 — не ранее 30 сентября для активов, не ранее 30 ноября для денежных средств; обязательна перед годовой отчётностью, при реорганизации, смене МОЛ, факте хищения». MUI `<Tooltip>`. **Оценка: 30 минут.**

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

| # | Канал | Тип | Где живёт | Когда применять | Приоритет |
|---|---|---|---|---|---|
| **RPA-1** | **Локальный 1С → extractor** | Desktop integration | `product-service/rpa/` | Чтение плановых поставок из 1С. Два варианта реализации: (A) **OData REST** к 1С 8.3+ — server-side API, чистый JSON; (B) **WinAppDriver/Appium** для толстого клиента 1С — UI-бот кликает по окнам, если OData недоступен. | **P0** |
| **RPA-2** | **Локальный Office → filler** | Desktop UI bot | `document-service/rpa/OfficeDocumentBot` | Бот реально открывает MS Word / Excel локально, заполняет шаблон из `documents template/`, сохраняет PDF/XLSX/DOCX. Демонстрирует «настоящий RPA» на защите. WinAppDriver/Appium (рекомендуемый — общий стек с RPA-1 вариант B) или JACOB (COM bridge, резерв). | **P0** (для защиты) |

Existing Apache POI + PDFBox (server-side генерация документов, `DocumentRpaService` / `PdfDocumentService`) — **primary** способ генерации. RPA-2 (`OfficeDocumentBot`) — это RPA-демо поверх, не замена POI.

Существующие `RpaHtmlExtractorImpl` (Jsoup) и `ApiExtractorImpl` (REST к mock-erp) — **dev-fallback'и** для разработки без реального 1С, в production-режиме (RPA-1) не используются. MockErpController остаётся для локального тестирования.

WinAppDriver/Appium стек переиспользуется в RPA-1 (вариант B) и RPA-2 — один driver-процесс, общая зависимость `io.appium:java-client`.

### 2.1 Текущая архитектура RPA (что есть)

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

### 2.2 Канал A — OData REST к 1С: варианты подключения

1С платформа предоставляет несколько способов экспонировать данные наружу:

| Канал | Версия 1С | Сложность | Когда использовать |
|---|---|---|---|
| **OData REST API** | 8.3+ (стандарт) | низкая ⭐ | Современные конфигурации, читать справочники и регистры. Авторизация Basic. **Рекомендуется по умолчанию.** |
| **HTTP-сервисы** | 8.3+ (требует разработки в 1С) | средняя | Когда OData недоступен или нужна сложная фильтрация / агрегация. Создаётся программистом 1С. |
| **Web-сервисы (SOAP)** | старые версии | средняя | Legacy-системы. Не рекомендуется для нового интеграционного слоя. |
| **COM-коннектор** | Windows только | высокая | Embedded интеграция. Java через JCo / IKVM — рискованно. **Не использовать.** |
| **CSV/XLSX exchange через shared folder** | любая | низкая | Batch sync. Подходит для редкого обмена. Не real-time. |
| **Очередь сообщений (Kafka/Rabbit)** | 8.3+ через 1С-Кластер интеграции | высокая | Большие потоки, low-latency. Overkill для WMS-приёмки. |

**Рекомендованный путь — OData**:
- Стандартный из коробки, без программирования на стороне 1С.
- Запрос вида: `GET http://1c-server/MyDB/odata/standard.odata/Catalog_ПлановыеПоставки?$format=json&$filter=Active%20eq%20true`
- Auth: HTTP Basic (логин/пароль пользователя 1С с правом доступа).

### 2.3 План реализации `OneCApiExtractorImpl` (канал A)

1. **Завести нового extractor** `@Component("oneCExtractor")` в `product-service/src/main/java/by/bsuir/productservice/rpa/OneCApiExtractorImpl.java`:
   ```java
   @Component("oneCExtractor")
   public class OneCApiExtractorImpl implements PlannedDeliveryExtractor {
       @Value("${erp.onec.base-url}") private String baseUrl;       // http://1c-server/MyDB/odata/standard.odata
       @Value("${erp.onec.entity}")   private String entity;        // Document_ПриходТовара
       @Value("${erp.onec.username}") private String username;
       @Value("${erp.onec.password}") private String password;
       @Value("${erp.onec.filter:}")  private String filter;        // OData $filter

       private final RestClient client = RestClient.builder()
               .baseUrl(baseUrl)
               .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + Base64.encode(username + ":" + password))
               .build();

       @Override public String getSourceName() { return "1C"; }
       @Override public List<Map<String,Object>> extractDeliveries() {
           Map response = client.get()
               .uri(uriBuilder -> uriBuilder.path("/" + entity)
                   .queryParam("$format", "json")
                   .queryParamIfPresent("$filter", Optional.ofNullable(filter).filter(s -> !s.isBlank()))
                   .build())
               .retrieve()
               .body(Map.class);
           return mapOneCResponse(response);
       }

       private List<Map<String,Object>> mapOneCResponse(Map oneCJson) {
           // oneCJson.get("value") = List<Map> с 1С-нативными именами полей:
           // Ref_Key (UUID 1С), Дата, Контрагент_Key, Номенклатура_Key, Количество, ...
           // Маппим в наш формат: externalId, supplierName, productName, expectedQuantity, expectedDate
       }
   }
   ```

2. **Обновить `ErpExtractorJob`** — добавить новый mode `onec` рядом с `rpa`/`api`:
   ```java
   @Qualifier("oneCExtractor") private final PlannedDeliveryExtractor oneCExtractor;
   ...
   PlannedDeliveryExtractor extractor = switch (mode) {
       case "onec" -> oneCExtractor;
       case "api"  -> apiExtractor;
       default     -> rpaExtractor;
   };
   ```

3. **Конфиги в `application.properties` каждого env:**
   ```properties
   erp.extraction.mode=onec
   erp.onec.base-url=http://1c-server/MyDB/odata/standard.odata
   erp.onec.entity=Document_ПриходТоваров
   erp.onec.username=integration_user
   erp.onec.password=${ONEC_PASSWORD}
   erp.onec.filter=Posted eq true and Date ge datetime'2026-01-01T00:00:00'
   ```

4. **Тип `expectedQuantity`** — сейчас `Integer` в `PlannedDelivery.expectedQuantity`. 1С обычно отдаёт `Количество` как `BigDecimal` (дробное, например 12.500 кг). **Поменять тип на `BigDecimal`** в:
   - `PlannedDelivery` entity (+ миграция `V3__planned_delivery_qty_bigdecimal.sql`).
   - `ErpExtractorJob` parser.
   - Frontend `ErpExtractorPage` если показывает.

5. **Маппинг 1С-полей** — нужна таблица соответствий, согласованная с заказчиком 1С:
   | 1С (typical) | Наше поле |
   |---|---|
   | `Ref_Key` | `externalId` (UUID 1С → строка) |
   | `Контрагент/Description` (через `$expand`) | `supplierName` |
   | `Товары[].Номенклатура/Description` | `productName` (берём первую строку или агрегируем) |
   | `Товары[].Количество` | `expectedQuantity` |
   | `Дата` | `expectedDate` |
   | `Поставка_Key` (внешняя ссылка) | `supplyId` для downstream |

6. **Тестирование без 1С**:
   - **Unit-тест** `OneCApiExtractorImplTest` — мокать `RestClient`, кормить заранее заготовленным OData-JSON ответом, проверять маппинг.
   - **WireMock или MockRestServiceServer** для интеграционного теста — поднимать имитацию OData endpoint'а.
   - **Live-тест** — отдельный профиль `onec-live`, запускается вручную в среде разработчика, требует доступа к 1С.

7. **Безопасность**:
   - **Пароль НЕ коммитить** в репо. `application.properties` берёт из `${ONEC_PASSWORD}` env var.
   - **Read-only пользователь 1С** — права только на чтение нужных регистров.
   - **HTTPS** для production-канала (1С может быть за nginx-reverse-proxy).

8. **MockErpController** — оставить в document-service для demo-режима (`erp.extraction.mode=rpa`). Полезен для защиты дипломной — не требует доступа к реальной 1С.

### 2.4 Acceptance канала A

- Конфиг `erp.extraction.mode=onec` подключает `OneCApiExtractorImpl`.
- Manual run через `POST /api/erp-extractor/run?mode=onec` возвращает `{success: true, found: N, new: M}`.
- Cron-задача в 03:00 автоматически опрашивает 1С (если включена).
- `extraction_log` корректно отражает успешные и сбойные запросы.
- Unit-тесты на маппинг 1С-JSON → `PlannedDelivery`.

### 2.5 Оценка канала A

- **MVP (один тип документа — приходные накладные):** 1-1.5 дня (extractor + конфиг + unit-тесты).
- **Полная (несколько типов + edge-cases):** 2-3 дня.
- **Совместная отладка с заказчиком 1С (DBA настраивает OData, выдаёт пользователя):** + 0.5-1 день на калибровку.

**Зависимости:** доступ к тестовой 1С с включённой OData-публикацией. Без неё можно довести до unit-тестов на mocked OData-JSON.

### 2.6 Канал B — `SeleniumErpExtractorImpl` (web UI bot)

**Цель.** Бот реально открывает Chromium, логинится в web-интерфейсе ERP (или mock-erp), парсит таблицу плановых поставок. **На защите запускается с `--headless=false` — комиссия видит как бот сам кликает.** Скриншоты после каждого шага складываются в `logs/rpa-screenshots/` как артефакт для пояснительной записки.

**Зависимости** (`product-service/build.gradle`):
```groovy
implementation 'org.seleniumhq.selenium:selenium-java:4.27.0'
implementation 'io.github.bonigarcia:webdrivermanager:5.9.2'  // auto-download chromedriver
```

**Расположение:** `product-service/src/main/java/by/bsuir/productservice/rpa/SeleniumErpExtractorImpl.java`

**Реализация:**
```java
@Component("seleniumExtractor")
@Slf4j @RequiredArgsConstructor
public class SeleniumErpExtractorImpl implements PlannedDeliveryExtractor {

    @Value("${erp.selenium.base-url:http://localhost:8040/mock-erp}") private String baseUrl;
    @Value("${erp.selenium.username:admin}")  private String username;
    @Value("${erp.selenium.password:admin}")  private String password;
    @Value("${erp.selenium.headless:true}")   private boolean headless;
    @Value("${erp.selenium.screenshots-dir:logs/rpa-screenshots}") private String screenshotsDir;

    @Override public String getSourceName() { return "SELENIUM"; }

    @Override public List<Map<String,Object>> extractDeliveries() {
        WebDriverManager.chromedriver().setup();
        ChromeOptions opts = new ChromeOptions();
        if (headless) opts.addArguments("--headless=new", "--disable-gpu");
        opts.addArguments("--no-sandbox", "--window-size=1280,800");

        WebDriver driver = new ChromeDriver(opts);
        try {
            driver.get(baseUrl + "/login");
            driver.findElement(By.name("username")).sendKeys(username);
            driver.findElement(By.name("password")).sendKeys(password);
            screenshot(driver, "1-login-filled");
            driver.findElement(By.cssSelector("button[type=submit]")).click();

            driver.get(baseUrl + "/deliveries");
            WebElement table = new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(d -> d.findElement(By.id("deliveries-table")));
            screenshot(driver, "2-deliveries-loaded");

            return parseTable(table);
        } finally {
            driver.quit();
        }
    }

    private List<Map<String,Object>> parseTable(WebElement table) {
        List<Map<String,Object>> result = new ArrayList<>();
        for (WebElement row : table.findElements(By.cssSelector("tbody tr"))) {
            List<WebElement> cells = row.findElements(By.tagName("td"));
            if (cells.size() < 5) continue;
            Map<String,Object> d = new HashMap<>();
            d.put("externalId", cells.get(0).getText().trim());
            d.put("supplierName", cells.get(1).getText().trim());
            d.put("productName", cells.get(2).getText().trim());
            d.put("expectedQuantity", cells.get(3).getText().trim());
            d.put("expectedDate", cells.get(4).getText().trim());
            result.add(d);
        }
        return result;
    }

    private void screenshot(WebDriver driver, String name) {
        try {
            File src = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            Path target = Paths.get(screenshotsDir, name + "-" + System.currentTimeMillis() + ".png");
            Files.createDirectories(target.getParent());
            Files.copy(src.toPath(), target);
            log.info("Screenshot: {}", target);
        } catch (Exception e) { log.warn("Screenshot failed: {}", e.getMessage()); }
    }
}
```

**Обновить `ErpExtractorJob`:**
```java
@Qualifier("seleniumExtractor") private final PlannedDeliveryExtractor seleniumExtractor;
...
PlannedDeliveryExtractor extractor = switch (mode) {
    case "onec"     -> oneCExtractor;
    case "selenium" -> seleniumExtractor;
    case "api"      -> apiExtractor;
    default         -> rpaExtractor;   // Jsoup
};
```

**Конфиги:**
```properties
erp.extraction.mode=selenium
erp.selenium.base-url=http://localhost:8040/mock-erp
erp.selenium.username=admin
erp.selenium.password=admin
erp.selenium.headless=true
erp.selenium.screenshots-dir=logs/rpa-screenshots
```

**Полировка `MockErpController` (document-service):** убедиться что login-страница имеет полноценную HTML-форму с `<input name="username">`, `<input name="password">`, `<button type="submit">`. Текущий `RpaHtmlExtractorImpl` (Jsoup) работает с этой формой через POST form-encoded — Selenium тоже сработает.

**Тесты:**
- Unit: `SeleniumErpExtractorImplTest` с мокированным `WebDriver` (Mockito).
- Integration: `*ContainerTest` с `BrowserWebDriverContainer` (testcontainers-java module) — поднимает Chrome в контейнере вместе с приложением. Это потяжелее, но даёт настоящий e2e.

**Оценка:** 0.5-1 день.

### 2.7 Канал C — `OfficeDocumentBot` (локальная автоматизация MS Word / MS Excel)

**Цель.** Бот реально открывает **MS Word или MS Excel** на машине, открывает шаблон из `documents template/`, заполняет placeholder'ы / ячейки данными из WMS, сохраняет результат как `.docx`/`.xlsx`/`.pdf`. На защите — запускаем не-headless, комиссия видит как Word/Excel открывается, бот печатает в поля, сохраняет файл. **Это и есть «настоящий RPA»** (UI Automation на desktop), в отличие от Apache POI (server-side library).

**Selenium здесь не используется** — он для web. Для локального Office берём один из двух движков:

| Движок | Что делает | Плюсы | Минусы |
|---|---|---|---|
| **WinAppDriver (Appium)** | UI Automation API Windows: ищет элементы по `AccessibilityId`/`Name`, кликает, печатает | Тот же стек что канал D (1С) — один driver, общие зависимости `io.appium:java-client` + WinAppDriver.exe. Универсально работает с любым Win-app. | Чуть хрупче на формулах Excel (нужно ждать пересчёта); ребро по селекторам в Office Ribbon. |
| **JACOB (Java COM Bridge)** | Драйвит `Word.Application` / `Excel.Application` через COM | Чистый COM API: `app.Workbooks.Open`, `sheet.Cells(row,col).Value = "..."`. Стабильно, не зависит от UI-разметки. | Только Windows + MS Office установлен. Native DLL `jacob-x64.dll` нужно положить в PATH. |

**Рекомендованный путь — WinAppDriver** для консистентности с каналом D (один стек на оба desktop-канала). JACOB — резерв для случаев когда Excel-formulas нестабильно отрабатывают через UI Automation.

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
2. WinAppDriver запущен как сервис (`http://127.0.0.1:4723`) — тот же что для канала D.
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
- Reuse: тот же endpoint покрывает все 12 типов документов через выбор `templatePath`.

**Оценка:** 1-1.5 дня (WinAppDriver + калибровка селекторов Excel/Word). +0.5 дня резервный JACOB-путь.

**Риски:**
- Office Ribbon/Save-as-PDF UI отличается между 2019/2021/365 — селекторы могут потребовать подстройки на машине защиты.
- На headless-CI работать не будет (нужен реальный Windows Desktop). Это RPA-демо для защиты, не auto-prod-канал.

### 2.8 Канал D — `WinAppDocumentBot` (Appium + WinAppDriver, для 1С толстого клиента)

**Цель.** Бот автоматизирует **толстый клиент 1С (1cv8.exe)** через UI Automation API Windows. Кликает по окнам, заполняет поля документа «Приход товара», нажимает «Провести». **Доступ к 1С будет завтра — реализация откладывается.**

**Технический стек:**
- **WinAppDriver** ([https://github.com/microsoft/WinAppDriver](https://github.com/microsoft/WinAppDriver)) — официальный Microsoft, 4 МБ exe. Слушает на порту 4723. Реализует WebDriver-протокол для Windows-приложений.
- **Appium Java client** (`io.appium:java-client:9.x`) — Java SDK для WebDriver.
- **Selenium-core** уже будет в product-service для канала B — Appium его реиспользует.

**Требования к среде:**
1. **Windows 10+** с включённым **Developer Mode** (`Settings → Privacy & Security → For developers → Developer Mode: On`).
2. Установить WinAppDriver: `WindowsApplicationDriver.msi` от Microsoft.
3. Запустить WinAppDriver как сервис: `C:\Program Files (x86)\Windows Application Driver\WinAppDriver.exe`.
4. Для нахождения селекторов — **Accessibility Insights for Windows** (от Microsoft, бесплатно) или WinSpy.

**Расположение:** `document-service/src/main/java/by/bsuir/documentservice/rpa/WinAppDocumentBot.java`

**Зависимости** (`document-service/build.gradle`):
```groovy
implementation 'io.appium:java-client:9.3.0'
implementation 'org.seleniumhq.selenium:selenium-java:4.27.0'
```

**Скетч:**
```java
@Component @Slf4j
public class WinAppDocumentBot {

    @Value("${rpa.winapp.driver-url:http://127.0.0.1:4723}") private String driverUrl;
    @Value("${rpa.winapp.onec-path}") private String oneCPath;  // C:\\Program Files\\1cv8\\common\\1cestart.exe
    @Value("${rpa.winapp.onec-base}") private String oneCBase;  // путь к информационной базе

    public void createReceiptDocument(Map<String,Object> data) throws Exception {
        DesiredCapabilities caps = new DesiredCapabilities();
        caps.setCapability("app", oneCPath);
        caps.setCapability("appArguments", "ENTERPRISE \"" + oneCBase + "\"");
        caps.setCapability("appWorkingDir", "C:\\Temp");

        WindowsDriver driver = new WindowsDriver(new URL(driverUrl), caps);
        try {
            // Логин в 1С
            new WebDriverWait(driver, Duration.ofSeconds(15))
                .until(d -> driver.findElementByAccessibilityId("UsernameField"));
            driver.findElementByAccessibilityId("UsernameField").sendKeys("admin");
            driver.findElementByName("Войти").click();

            // Меню: Документы → Поступление товаров
            driver.findElementByName("Документы").click();
            driver.findElementByName("Поступление товаров").click();
            driver.findElementByName("Создать").click();

            // Заполнение шапки
            driver.findElementByAccessibilityId("Контрагент").sendKeys((String) data.get("supplierName"));
            driver.findElementByAccessibilityId("Склад").sendKeys((String) data.get("warehouseName"));

            // Табличная часть (товары)
            @SuppressWarnings("unchecked")
            List<Map<String,Object>> items = (List<Map<String,Object>>) data.get("items");
            for (Map<String,Object> item : items) {
                driver.findElementByName("Добавить").click();
                driver.findElementByAccessibilityId("Номенклатура").sendKeys((String) item.get("productName"));
                driver.findElementByAccessibilityId("Количество").sendKeys(item.get("quantity").toString());
            }

            // Провести и закрыть
            driver.findElementByName("Провести и закрыть").click();
            log.info("1С: документ создан и проведён");
        } finally {
            driver.quit();
        }
    }
}
```

**Endpoint:**
```java
@PostMapping("/winapp/create-receipt")
public ResponseEntity<Map<String,Object>> createReceiptIn1C(@RequestBody Map<String,Object> data) {
    bot.createReceiptDocument(data);
    return ResponseEntity.ok(Map.of("status", "ok"));
}
```

**Тесты:** только manual run. Автоматизировать на CI невозможно (нужен Windows + 1С).

**Альтернативный demo-сценарий**, если 1С не доступна или не успеем настроить:
- **Notepad/Calculator** — proof-of-concept (бот реально набирает текст в Notepad, считает в Калькуляторе). Минимальный wow для защиты, но техническая суть демонстрируется.
- **MS Excel** — бот открывает .xlsx, читает ячейки, записывает — серединное решение.

**Оценка:** 1 день для базовой автоматизации одной операции в 1С (после получения доступа). +0.5 дня на калибровку селекторов через Accessibility Insights. **Зависит от того, насколько сложна форма «Поступление товаров» в конкретной конфигурации 1С пользователя.**

### 2.9 Архитектура (итоговая)

```
product-service/src/main/java/by/bsuir/productservice/rpa/
├── PlannedDeliveryExtractor.java       — interface (расширяется новыми каналами)
├── RpaHtmlExtractorImpl                — есть, Jsoup, mode=rpa
├── ApiExtractorImpl                    — есть, REST, mode=api
├── SeleniumErpExtractorImpl            — НОВОЕ (канал B), mode=selenium
├── OneCApiExtractorImpl                — НОВОЕ (канал A), mode=onec
└── ErpExtractorJob                     — orchestrator (Strategy: @Qualifier по mode)

document-service/src/main/java/by/bsuir/documentservice/rpa/
├── DocumentRpaService                  — есть, Apache POI (server-side template)
├── PdfDocumentService                  — есть, PDFBox (server-side PDF)
├── OfficeDocumentBot                   — НОВОЕ (канал C), desktop UI bot для локального MS Word / MS Excel (WinAppDriver / JACOB)
└── WinAppDocumentBot                   — НОВОЕ (канал D), desktop UI bot для 1С толстого клиента (WinAppDriver/Appium)
```

**Reuse:** Selenium-core используется только в канале B (product-service, web ERP). Каналы C и D — WinAppDriver/Appium стек (`io.appium:java-client`), общая зависимость и общий driver-процесс. Логику скриншотов после каждого шага можно вынести в `common`-utility.

### 2.10 Acceptance (целевое состояние RPA-блока)

- ✅ Канал A: `erp.extraction.mode=onec` подключает 1С через OData (после получения доступа).
- ✅ Канал B: `erp.extraction.mode=selenium` — бот в Chrome (headed/headless) логинится, парсит, скриншоты в `logs/rpa-screenshots/`.
- ✅ Канал C: `POST /api/documents/office/fill` — бот реально открывает локальный MS Word/Excel, заполняет placeholder'ы из payload, сохраняет PDF. На защите запуск с `rpa.office.headless=false`.
- ✅ Канал D: `POST /api/documents/winapp/create-receipt` — бот в 1С создаёт документ «Поступление товаров» (после получения доступа к 1С).
- В пояснительной записке — скриншоты работы каждого бота, объяснение классификации RPA-каналов (server-side integration vs UI automation).

### 2.11 План на следующую сессию (порядок)

1. **`SeleniumErpExtractorImpl`** (канал B) — самостоятельный, mock-erp уже готов. ~0.5-1 день. **Стартуем с этого.**
2. **`OfficeDocumentBot`** (канал C) — локальный MS Word/Excel через WinAppDriver. Установить WinAppDriver, прокалибровать селекторы Excel (`NameBox`, `Ribbon`). ~1-1.5 дня. JACOB-резерв ещё +0.5 дня если потребуется.
3. **`WinAppDocumentBot`** (канал D) — после получения доступа к 1С. ~1 день. Зависит от конфигурации 1С пользователя — может потребоваться калибровка селекторов через Accessibility Insights.
4. **`OneCApiExtractorImpl`** (канал A) — параллельно с D, если есть доступ к 1С с OData-публикацией. ~1-1.5 дня.

**Итого RPA-блок:** 3.5-5 дней при последовательной работе, можно ужать до 2-3 дней если параллельно с другими ветками.

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
| **§1.5 P0** 🔥 | Фундамент: MinIO + GeneratedDocument + DocumentNumberService + Workflow PAUSED | ~5 дней backend + ~1 день фронт (DocumentsPage) |
| **HP** 🔥 | HP-1 (11 типов док-в, 4 PENDING RPA-шаблона + picking-list PDF) + HP-2 (пагинация) | 3-4 дня backend + ~1 день фронт |
| **§1.5 P1** | Export flow (чекбокс + ТН/ТТН/CMR пакет) + inventory tooltip | 2-3 дня (backend + фронт) |
| **§2 RPA** | 4 канала: A OData/1С + B Selenium-ERP (web) + C Office desktop bot + D WinAppDriver/1С | 3.5-5 дней (можно 2-3 при параллельной работе) |
| **+ парал.** | F5 design system | 1-2 дня (фронт) |

**Порядок (следующая сессия):**
1. **§1.5.D** DocumentNumberService (0.5 дня) — фундамент для номеров.
2. **§1.5.A** MinIO + GeneratedDocument (2-2.5 дня) — без него HP-1 регистрировать документы некуда.
3. **HP-1** + 4 generator'а + picking-list PDF (1.5-2 дня).
4. **§1.5.B** Workflow PAUSED + всегда-акт (2-3 дня).
5. **§1.5.C** Export flow (параллельно с HP-2 фронтовой пагинацией).
6. **§2 RPA** канал B → C → D → A.

**Минимум до защиты:** §1.5 P0 + HP + §2 каналы B+C+D = **~2.5-3 недели**.
**Полный план:** + §1.5 P1 + канал A + F5 + I5 = **~3.5-4 недели**.

---

## 7. Где смотреть детали

- **HP-1 / HP-2** — `BACKEND_HP_BACKLOG.md` (полный контекст, файлы, acceptance).
- **`Требования к *Service.txt`** — authoritative business requirements.
- **`backend/CLAUDE.md`** — конвенции backend (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **`client/CLAUDE.md`** — конвенции frontend (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
