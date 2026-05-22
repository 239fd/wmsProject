# План работ по WMS-проекту

> Содержит только открытое. История закрытого — в `git log` и memory-сводках.
> Источник истины — **`poyasn.pdf`** > `Спецификация_требований_разработчика_SRS.pdf` > `Требования к *Service.txt` > текущий код.

---

## 0. Контекст проекта

**WMS (Warehouse Management System)** — дипломный проект, система автоматизации складского учёта для предприятий РБ. Закрывает три бизнес-цели poyasn: повышение эффективности управления запасами (BO-1), прозрачность операций (BO-2), снижение трудозатрат на документы на 60-70% и ошибок <1% (BO-3).

### Стек

- **Backend:** Java 21, Spring Boot 3.5.7, Gradle multi-module. 7 проектов: `eureka-server` (8761), `api-gateway` (8765, Kotlin DSL), `SSOService` (8000), `organization-service` (8010), `warehouse-service` (8020), `product-service` (8030), `document-service` (8040).
- **БД:** PostgreSQL × 4 (user_db, organization_db, warehouse_db, product_db, порты 5432-5435), Redis (refresh-tokens), RabbitMQ (event-bus), MinIO (документы).
- **Frontend:** React 19, Redux Toolkit, MUI v7, react-hook-form + yup, redux-persist + offline-drafts.
- **DevOps:** Docker Compose + Kubernetes manifests, мониторинг через Prometheus + Grafana + Loki + Jaeger.
- **RPA:** Python `rpa-service` (FastAPI + pywinauto + win32com) на Windows-хосте для 1С парсинга и Office-шаблонов; Apache POI / PDFBox в `document-service` как primary канал.

### Ключевые архитектурные решения

| Паттерн | Где |
|---|---|
| **CQRS + Event Sourcing (light)** | Write пишет в `*_events` + обновляет `*_read_model` в одной транзакции. Применено к User/Organization/Warehouse/Rack/Product/Inventory/ProductOperation. |
| **Saga (персистентная)** | `product-service/saga/SagaOrchestrator` управляет Receive (BATCH_CREATION→INVENTORY_UPDATE→OPERATION_RECORD) и Ship (STOCK_RESERVATION→STAGING→DOCUMENT_GENERATION→INVENTORY_UPDATE→OPERATION_RECORD). State в `saga_state`, восстанавливается на `ContextRefreshedEvent`. `compensate(...)` реально откатывает. |
| **Multi-tenancy** | По `organization_id` на каждой entity. Gateway пробрасывает `X-Organization-Id`/`X-Warehouse-Id`/`X-User-Id`/`X-User-Role` из JWT, сервисы фильтруют. |
| **Auth** | JWT RS256 (4h access / 30d refresh в Redis), 3 роли: `WORKER` / `ACCOUNTANT` / `DIRECTOR`. SSO + OAuth (Google/Yandex). |
| **RabbitMQ topology** | Топик-обменники per-service. Cross-service: `user.director.deleted` → `organization.deleted` → wipe warehouse/product/SSO; `employee.status.changed`; `warehouse.deleted`. |
| **Документы** | MinIO (`wms-documents`) + `generated_documents` registry в product-service. `DocumentNumberService` per-org serial counter. PDF default (PDFBox+DejaVuSans), Python rpa-service для .xlsx/.docx. |

### Готовность

~98% backend, ~95% frontend. До защиты осталось: §4.2 docker-compose E2E + §5.5 баги WORKER-приёмки (см. ниже) + §5.6 флоу Бухгалтера (не начат).

### Что сейчас открыто

- **§5.5 WORKER приёмка — блок 2** (in progress) — баги ручного создания/обновления поставки + receive wizard.
- **§5.6 Флоу Бухгалтера** — не начат, после §5.5.
- **§5.2 Дефекты:** D-1 (org-client 403), D-2 (inventory-report не пишется), D-3 (.doc/.RTF → workaround на PDF).
- **§2 §7 E2E smoke** RPA (ручная проверка на Windows + 1С).
- **§4.2 docker-compose E2E** — обязательная проверка перед защитой.
- **§5.1** Coverage 51.7% → 80% — отложено.
- **§2.21/§2.22/§2.28** CORS gateway, OAuth secrets rotation, keystore rotation — security, отложено.

### Где какой код

```
backend/
├── eureka-server/                — порт 8761
├── api-gateway/                  — WebFlux Gateway (Kotlin DSL), JWT-валидация
├── SSOService/                   — OAuth2-сервер, JWT-issuer, 3 роли, refresh в Redis
├── organization-service/         — Org CRUD, employees, invitations, SMTP
├── warehouse-service/            — Warehouses + racks (SHELF/CELL/PALLET) + pallet places + storageConditions
├── product-service/              — products/batches/inventory/operations/saga/rpa/supplies
├── document-service/             — без БД, stateless, PDF/POI/Python RPA proxy
├── rpa-service/                  — Python FastAPI (НЕ Gradle-модуль; Windows-host only)
└── build.gradle                  — root: spotless, checkstyle, JaCoCo агрегат, allTestWithCoverage

client/src/
├── pages/                        — Receive/Ship/Inventory/Suppliers/...
├── components/{layout,shared,receive,analytics}
├── services/                     — httpService + 11 domain-сервисов
├── store/                        — Redux Toolkit (auth, warehouses, suppliers, employees)
├── hooks/                        — useWarehouses/useSuppliers/useEmployees/useDraft
├── validation/schemas.js         — yup-схемы, RU-сообщения
└── config/{api,theme}.js         — endpoints + MUI theme

sql-scripts/{userDB,organizationDB,warehouseDB,productDB}.sql  — DDL
docker-compose.yml                                              — всё разом локально
k8s/{00..09}-*.yaml                                             — Kubernetes manifests
```

---

## 0.1 Зафиксированные решения

| Тема | Решение |
|---|---|
| **Q1+Q3** Акт приёмки | Единый endpoint `receipt-act`, всегда. Без расхождений → `Акт приемки.RTF`. С расхождениями → `Акт расхождения.xls`. `discrepancy-act` дропнут. Workflow: `RECEIVED → PAUSED` (session-level). |
| **Q2** MinIO | Bucket `wms-documents` + `generated_documents` registry в product-service. Document-service stateless. |
| **Q4** Экспорт + ТН/ТТН | `shipmentType: DOMESTIC\|EXPORT`. DOMESTIC → 1 документ (ТН/ТТН × горизонт/вертикаль). EXPORT → {ТН + CMR + invoice}. `ShipSagaState.documentIds: List<UUID>`. |
| **Q5** Скоропортящиеся | Не реализуем. |
| **Q6** Инвентаризация (НСБУ N 126) | Только tooltip на кнопке. |
| **Q7** Документ-нумерация | `DocumentNumberService` per-org serial. Префиксы: ПО/АП/ТТН/ТН/CMR/ИНВ/ПЕР/СПС/И/ЛП/ОТЧ. Формат `{ПРЕФИКС}-{YYYY}-{NNNNN}`. |
| **Q8** picking-list | 6 колонок: `Товар \| SKU \| Поставка \| Место \| Кол-во \| Ед.`. Только PDF. |
| **Q9** ЭТТН/ЭТН | Игнорируем — даже не упоминаем как ограничение. |
| **Q10** CMR | `CMR Международная товарно-транспортная накладная.doc` подтверждён на правила с 01.01.2026. |
| **Роли** | 3 роли строго: WORKER / ACCOUNTANT / DIRECTOR. 4-ю не вводить. |
| **PDF** | `DejaVuSans.ttf` для кириллицы. Не возвращайте `Standard14Fonts.HELVETICA`. |
| **Schema ownership** | Только `sql-scripts/<service>DB.sql` (`ddl-auto=validate` везде). Flyway удалён, не возвращать. |
| **Rack model** (2026-05-21) | `RackKind` без FRIDGE; отдельный `storageConditions` (ROOM/COOL/FRIDGE/FREEZER) на стеллаже; `maxWeightKg` на стеллаже (не на слотах). `Product.requiredStorageCondition` дефолт. |
| **DIRECTOR delete cascade** (2026-05-21) | `DELETE /api/profile` → физический wipe org+employees+warehouses+products+docs+MinIO. Email освобождается. Событие `organization.deleted`. |
| **Сессии** (2026-05-21) | `terminateSession` → DELETE `login_audit` + Redis cleanup, не UPDATE. |

---

## 0.2 Бизнес-цели poyasn (для метрик защиты)

| ID | Цель | Как доказать |
|---|---|---|
| BO-1 | Повысить эффективность управления запасами | FEFO/ABC, инвентаризация, аналитика, пагинация. |
| BO-2 | Прозрачность и отслеживаемость операций | Event store + RabbitMQ-события, Postman, реестр документов. |
| BO-3 | Снизить трудозатраты на документы на 60-70%, ошибки <1% | RPA + автоподстановка + DTO-валидация. Расчёт «было/стало» в README. |

### Роли poyasn ↔ кодовые

| Роль poyasn | Кодовая | UC |
|---|---|---|
| Кладовщик | `WORKER` | UC-1..UC-5 |
| Заведующий складом | `DIRECTOR` | UC-6..UC-10 |
| Бухгалтер | `ACCOUNTANT` | UC-11..UC-16 |

---

## 0.3 Конвенции

1. **Перед работой:** `PLAN.md` + `backend/CLAUDE.md` + `client/CLAUDE.md`. Memory подгружается автоматом.
2. **Тесты:** обычные `*Test.java` (gradle test без Docker). Testcontainers — `*ContainerTest.java` (gradle integrationTest).
3. **Schema:** правки в `sql-scripts/<service>DB.sql` + entity. `ddl-auto=validate` упадёт если не синхронно.
4. **HP-2 эталон** — `SupplierController`/`SupplierRepository` + `SuppliersPage`. Контракт `Page<X>` с `content/totalElements/totalPages/number/size`.
5. **Coverage** (2026-05-15): 473 тестов, 51.7% INSTRUCTION / 40% BRANCH aggregate (с exclusions из `ext.jacocoExcludes`). Per-service `minimum = 0.50` — не ронять.
6. **Backend:** Java records для DTO, RU `@DisplayName`. `AppException` factory-методы. Мутации Inventory эмитят `InventoryEvent`. Cross-service через `/api/internal/**`.
7. **Frontend:** RHF+yup (схемы в `client/src/validation/schemas.js`). `useSnackbar()` глобально. Только `httpService`+`store/api.js`. В UI пишем «ИНН» (поле API `unp` остаётся).
8. **Memory feedback:** no comments в коде, no tests/commits без явного запроса, backend first, RU-даты в PLAN.md.

---

## 0.4 Роли — функции и БП (трекер)

> Легенда: ✅ работает · ❌ сломано · ⏳ в работе/частично · ⬜ не начато · ⛔ scope-out

```
WMS
│
├── 🔐 Общее (auth, профиль, инфра)
│   ├── ✅ Регистрация директора + создание организации
│   ├── ✅ Регистрация по invitation-token (email-link)
│   ├── ✅ Login (JWT RS256, 4h access + 30d refresh)
│   ├── ✅ Logout / активные сессии / смена пароля
│   ├── ✅ OAuth Yandex / Google
│   ├── ✅ DIRECTOR delete cascade (физический wipe)
│   └── ⛔ Четвёртая роль (STOREKEEPER)
│
├── 👷 WORKER (кладовщик = МОЛ, UC-1..UC-5)
│   ├── Поставки и приёмка
│   │   ├── ⏳ Создать поставку вручную (баги §5.5 #1/#2/#3)
│   │   ├── ✅ Импорт поставок из 1С (RPA) и JSON
│   │   ├── ✅ Список Supply с фильтрами PLANNED/IN_PROGRESS/ACCEPTED/CANCELLED
│   │   ├── ⏳ ReceiptSession wizard (баги §5.5 #4)
│   │   ├── ✅ Принять без замечаний → receipt-order + receipt-act
│   │   ├── ✅ Расхождение → receipt-act (SHORTAGE/SURPLUS/DEFECT/MISGRADE/OTHER)
│   │   ├── ✅ Placement по ячейкам (FEFO + storageConditions фильтр)
│   │   └── ✅ Inventory unit_sku + batch_id auto-create + packagingType
│   ├── Отгрузка
│   │   ├── ✅ Pick по штрихкоду/unit_sku (fallback batchId IS NULL)
│   │   ├── ✅ Прогресс заявки (saga state)
│   │   └── ✅ Лист подбора (picking-list PDF)
│   ├── Инвентаризация
│   │   ├── ✅ Открыть session (tooltip НСБУ N 126)
│   │   ├── ✅ Внести count → adjustments + inventory-report
│   │   └── ✅ История расхождений
│   ├── Перемещение
│   │   └── ✅ Transfer между warehouse/cell
│   └── Просмотр
│       ├── ✅ Inventory (paginated) + русские статусы + productName
│       └── ✅ История операций (paginated)
│
├── 🧾 ACCOUNTANT (бухгалтер, UC-11..UC-16)
│   ├── ⬜ Не проверен флоу — следующий блок после §5.5
│   ├── ✅ Переоценка → revaluation-act (ПЕР)
│   ├── ✅ Списание (комиссия) → write-off-act (СПС)
│   ├── ✅ Реестр документов (paginated, фильтр) + MinIO download/presigned
│   ├── ✅ ABC-анализ (cron 02:00)
│   ├── ✅ Динамика операций / аналитика остатков
│   ├── ✅ Marked-for-write-off (paginated)
│   └── ⛔ Скоропортящиеся (Q5)
│
└── 👔 DIRECTOR (заведующий, UC-6..UC-10) — флоу полностью рабочий ✅ 2026-05-21
    ├── ✅ CRUD склады/стеллажи (SHELF/CELL/PALLET + storageConditions + maxWeight)
    ├── ✅ CRUD ячейки + pallet places (статус Доступна/Заполнена + загрузка)
    ├── ✅ CRUD сотрудники (status, block/unblock, delete)
    ├── ✅ Invitation token + email (EmailDeliveryException-safe)
    ├── ✅ Employee analytics (tenure)
    ├── ✅ CRUD поставщики / товары / партии
    ├── ✅ ShipmentRequest DOMESTIC (ТН/ТТН) + EXPORT (ТН+CMR+invoice)
    ├── ✅ WarehouseAnalytics (racksByKind/storageConditions, occupiedSlots)
    └── ✅ Системные настройки (RPA mode toggle в самих операциях)

⛔ Не делаем (scope-out): ЭТТН/ЭТН, perishable + 24h таймер, SMTP уведомление поставщику при расхождении, ручное утверждение DIRECTOR receipt-act (МОЛ закрывает сам), 4-я роль.
```

### Сквозные БП (end-to-end happy path)

| # | БП | Шаги | Документы | Статус |
|---|---|---|---|---|
| BP-1 | Приёмка | WORKER создаёт Supply / парсит из 1С → `POST /api/receipt-sessions` → placement → complete/discrepancy | receipt-order (ПО) + receipt-act (АП) | ⏳ §5.5 баги |
| BP-2 | Отгрузка DOMESTIC | DIRECTOR ShipmentRequest (ТН/ТТН) → WORKER pick → saga | ТН или ТТН + picking-list (ЛП) | ✅ |
| BP-3 | Отгрузка EXPORT | DIRECTOR ShipmentRequest (export, currency) → saga → пакет 3 | ТН + CMR + invoice + picking-list | ✅ |
| BP-4 | Переоценка | ACCOUNTANT revaluate → InventoryEvent REVALUED | revaluation-act (ПЕР) | ✅ |
| BP-5 | Списание | ACCOUNTANT writeOff + комиссия → InventoryEvent WRITTEN_OFF | write-off-act (СПС) | ✅ |
| BP-6 | Инвентаризация | WORKER startSession → count → completeSession | inventory-report (ИНВ) | ✅ |
| BP-7 | Перемещение | WORKER transfer → 2 InventoryEvents | — | ✅ |
| BP-8 | Регистрация сотрудника | DIRECTOR invite → email → invitee `/register/invitation` | — | ⏳ Resend sandbox / SMTP block у пользователя |
| BP-9 | Импорт поставок | Cron 03:00 или ручной `POST /api/supplies/import-1c`/`-json` → Supply+SupplyItem | — | ✅ |

---

## 1. HP-1 шаблоны документов ✅ DONE 2026-05-13

10 типов работают в обоих каналах (PDF default + Python `rpa-service`). Дроп `release-order`/`shipment-order`/`invoice-fact`/`discrepancy-act` сделан. `discrepancy-act` теперь — секция внутри `receipt-act`. Калибровка координат POI-шаблонов и расстановка `{{tokens}}` в .doc/.rtf — у пользователя.

## 1. HP-2 пагинация ✅ DONE 2026-05-13

product-service: 10 endpoint'ов на `Page<X>` (`supplies`, `ship-requests`, `products`, `batches`, `inventory/...`, `write-off/marked-items`). warehouse-service: 3 endpoint'а (`warehouses`, `racks/warehouse/{id}`). Контракт `content/totalElements/totalPages/number/size`. Не пагинированы: `racks/{id}/cells|slots` (polymorphic по `rack.kind`).

## 1.5 Документная подсистема ✅ DONE 2026-05-13

MinIO + `generated_documents` registry, `OperationStatus { PENDING, RECEIVED, PAUSED, COMPLETED }` (session-level), export flow (`shipmentType`/`currency`/`documentLayout`/`domesticDocumentKind` + 3-step wizard на ShipPage), `DocumentNumberService` per-org serial, InventoryPage tooltip НСБУ N 126. Wiring в memory `project_wms_subsystems`.

---

## 2. RPA-канал ✅ Java + тесты DONE 2026-05-19 · §7 E2E на Windows-хосте — ручная проверка

WAD-стек удалён. Python `rpa-service` (FastAPI + pywinauto + win32com) — отдельный микросервис на Windows-хосте. Backend ходит по HTTP. Не упаковывается в Docker/k8s.

- **document-service** mode=rpa → `PythonRpaClient` → Python; fallback на POI с `X-Generation-Channel: rpa-fallback-error`.
- **product-service** `PythonRpaExtractor` парсит `supply_full.json`, кладёт допблоки в `Supply.snapshot JSONB`. Триггер: `POST /api/supplies/import-1c` или cron 03:00.
- Конфиг: `rpa.python.base-url=http://localhost:8060` + `rpa.python.timeout-seconds` (`120` document, `300` product).

### Запуск rpa-service (Windows-хост)

```powershell
cd backend\rpa-service
.\run.ps1                        # auto venv + uvicorn 0.0.0.0:8060
.\run.ps1 -Port 8060
.\run.ps1 -BindAddress 127.0.0.1
```

`.\smoke-rpa.ps1 -Jwt "<token>"` прогоняет health + invoice fill. `-OneC` — добавит `/parse/supplies` через product-service (1С должна быть запущена, открыта на «Заказы поставщикам»).

### Поддержка типов в Python-канале

| WMS type | Статус |
|---|---|
| receipt-order, inventory-report, revaluation-act, write-off-act, invoice, discrepancy-act, transport-note (h/v), waybill (h/v), cmr (ru/en/ru-only) | ✅ |
| picking-list, placement-list, receipt-act, release-order, shipment-order | ❌ HTTP 501 (используйте mode=auto → POI) |

---

## 4. I5 Redis для api-gateway ✅ DONE 2026-05-18

Caffeine выпилен. JWT public-key cache → Redis (`gw:jwt-public-key`, TTL 1h) + self-heal при mismatch. Hotfix: фильтр обёрнут в `Mono.fromCallable(...).subscribeOn(boundedElastic())`. Rate limiter снят (WMS-юзеры за одним NAT).

## 4.1 Flyway удалён ✅ 2026-05-17

Никогда не подключались. Схема — только `sql-scripts/<service>DB.sql`. Не возвращать.

## 4.2 End-to-end docker-compose ❌ PENDING — обязательно перед защитой

```powershell
.\cleanup-docker.ps1   # старые volumes (важно — иначе старая схема)
.\build-images.ps1
.\deploy-docker.ps1
```

Проверять:
- **Eureka UI** (8761) — все 7 сервисов `UP`.
- **Gateway** `http://localhost:8765/actuator/gateway/routes` — все маршруты резолвятся.
- **БД-схемы** — psql/DBeaver на 5432-5435, таблицы из `sql-scripts/*.sql` созданы (validate не падает).
- **MinIO** (9001, `wmsadmin/wmsadmin12345`) — bucket `wms-documents`.
- **Фронт** (3000) — логин, регистрация директора, склад → ячейка → поставка → приёмка → отгрузка.
- **RabbitMQ UI** (15672, `guest/guest`) — queues, сообщения проходят.
- **Логи** контейнеров без ERROR, все `Started ... in N seconds`.
- Прогнать BP-1 / BP-2 / BP-5 через UI.

Подводные камни:
- `.env` в корне (docker-compose читает `RESEND_API_KEY` и OAuth).
- ISP пользователя блокирует SMTP (см. memory `project_smtp_isp_block`) — Resend через HTTPS должен работать без VPN, классический SMTP — нет.

**Оценка:** 1-2 часа.

---

## 5. Будущие расширения (P2/после защиты)

1. Сканеры штрихкодов (`<BarcodeScannerInput>` с debounce/beep/scan-mode).
2. Offline-mode для кладовщика (SW + IndexedDB-очередь).
3. WebSocket/SSE «склад → заведующий» (poyasn TO-BE 2.1.2).
4. Печать наклеек ZPL.
5. `/api/products/{id}/history` лента из event store.
6. Chaos-тест Saga (остановить product-service между шагами).
7. BusinessValidator BR-3..BR-6 (Strategy + Chain of Responsibility).
8. Импорт справочников из Excel.
9. e2e Playwright (login/приёмка/отгрузка/инвентаризация/переоценка/списание).

---

## 5.1 Test coverage

473 теста, **51.7% INSTRUCTION / 40% BRANCH**. До 80% — отложено (нужно ~150-170 тестов на `productservice.service`/`controller` + `documentservice` + `ssoservice.service`/`organizationservice.service`). Per-service minimum `0.50` — проходит, не ронять.

Exclusions в `backend/build.gradle ext.jacocoExcludes`: `config/dto/model.entity/model.event/model.enums/rpa/exception/client/*Application`.

---

## 5.2 Известные дефекты (OPEN)

| # | Файл/место | Описание | Приоритет |
|---|---|---|---|
| D-1 | `document-service/client/OrganizationClient` | Internal HTTP в org-service отдаёт 403 даже с `X-User-Role: DIRECTOR`. Workaround: client возвращает `new HashMap<>()` → документы без шапки организации. **Fix**: либо `/api/internal/organizations/{id}` (whitelist в JwtFilter), либо service-account токен. | P1 |
| D-2 | `product-service/InventoryCheckService.completeInventory` | После complete инвентаризационная опись не появляется в `generated_documents` (ошибка глушится в catch). Гипотезы: `session.organizationId == null` / D-1 / MinIO. Смотреть логи: `ERROR Не удалось сгенерировать инвентаризационную опись`. | P1 |
| D-3 | `document-service/rpa/DocumentRpaService` (.doc/.RTF/legacy .xls) | POI HWPF + String.replace по RTF производят файлы, которые Word/Excel не открывают. **Workaround 2026-05-19**: программный канал всегда PDF. **Долгосрочный fix**: конвертировать .doc/.RTF в .docx, переписать через XWPFDocument. | P2 |

История закрытых дефектов (D-4..D-11) — в git log, memory.

---

## 5.3 Правки директорского флоу ✅ DONE 2026-05-21

7 базовых задач (DIR-1.1..DIR-1.6 + DIR-BUG-SESS) + 3 раунда фидбэка закрыты. UI прогон директор-флоу без регрессий. Детали в git log.

## 5.4 Правки флоу WORKER блок 1 ✅ DONE 2026-05-21

Объединение поставок и приёмки. `PlannedDelivery` снесён, парсинг (1С + JSON) пишет напрямую в многострочную `Supply` + `SupplyItem`. Новые поля: `externalId`/`source`/`quantityOnly`/`snapshot JSONB`/`packagingType` на item и batch. Новые endpoint'ы `POST /api/supplies/import-1c`/`-json`/`sample-json`. Маршруты `/main/supplies`/`/main/erp-extractor` → `<Navigate to="/main/receive">`. Wizard приёмки получил «Упаковку» + «Дублировать строку». Детали в git log.

---

## 5.5 WORKER приёмка — блок 2 ✅ DONE 2026-05-22

Раунд 1 (5 багов) ✅ FIXED: склад обязателен, 500 expected_qty, supplier/date затирается, wizard не идёт, SSO secrets в .env.

Раунд 2 ⏳ доделывается:
- totalItems обнуляется — preserve-if-null + log в `SupplyService.update` (нужен runtime trace).
- supplier синтез из supplierLabel ✅.
- @NotNull снят с expectedQty ✅.
- productId в receive-wizard: hidden register + setValue после append ✅; bump draft version → старые битые черновики инвалидируются.
- CreateProductInlineDialog без «Категория»/«Описание» ✅.
- create supply: BE принимает X-User-Id header + FE fallback на localStorage ✅.

Раунд 2.5 ✅ корневая причина найдена: `SupplyImportMapperConfig` определял `@Bean ObjectMapper` с SNAKE_CASE → Spring Boot autoconfig backs off, и SNAKE_CASE мапер становился дефолтным для `@RequestBody`. JSON `supplierId` не матчился с `supplier_id` → все camelCase поля парсились в null. Только `items` (одно слово, snake==camel) проходил. Фикс: добавил `@Primary @Bean ObjectMapper objectMapper(Jackson2ObjectMapperBuilder)` — restoreит дефолтный camelCase для @RequestBody. SNAKE_CASE остался только для `@Qualifier("supplyImportMapper")` (1С/JSON импорт). Дополнительно: `-parameters` в javac + `@JsonProperty` на все поля `CreateSupplyRequest` — defensive belt-and-suspenders.

Раунд 3 (большой план) ⬜:
- Геометрия приёмки: на SupplyItem `unitsPerPackage`, расчёт `batch.weightKg = qty * product.weightKg`, PlacementService фильтр по `cell.maxWeightKg`/`rack.maxWeightKg` + dimensions.
- Pallet placement UI: при приёмке на rack.kind=PALLET — выбор `PalletPlace` из списка свободных (сейчас auto).
- RPA отгрузок: wire-up `POST /parse/sales` (уже работает в Python) → `SalesImportService` → `POST /api/ship-requests/import-1c` → UI кнопка на ShipPage. (Аналог уже сделанного для поставок.)

Хвосты:
- ⬜ `ReceiveSagaService.createReceiveSession` не пробрасывает `packagingType` в `ProductBatch`.
- ⬜ Прогон BP-1 на ручной поставке + 1С импорте через UI.

Раунд 3 (приёмка по плановой) ✅:
- RPA Python `fill_excel/fill_word(visible=True)` — окна Office видны при генерации.
- `ReceiptSessionService.createSession`: валидация `items.size() == supply.totalItems` при `supplyId != null` + статус Supply должен быть PLANNED/IN_PROGRESS.
- `ReceiptSessionService.completeSession`/`recordDiscrepancy`: после успеха Supply → ACCEPTED + actualDate. SuppliesSection авто-рефреш через `refreshSignal`.

Раунд 4 (геометрия + RPA отгрузок) ✅:
- **Геометрия**: `units_per_package` колонка в `supply_items` + `product_batch` (SQL), entity + DTO + сервисы. FE: поле «Ед./упак.» в форме поставки и в receive wizard. `palletPlaceId` в ReceiptItem DTO/UI (поле «ID паллет-места» для rack.kind=PALLET).
- **RPA отгрузок**: `SalesOrderDto` + `SalesImportService` + `PythonRpaSalesExtractor` (HTTP к `/parse/sales` Python) + endpoint `POST /api/operations/ship-requests/import-1c`. FE: кнопка «Импорт из 1С» на ShipPage, новый метод `shipRequestService.importFrom1c`. Идемпотентно по `external_id` через `comment="external:<id>"` (используем существующее поле для маркировки).
- `ShipmentRequestRepository.findFirstByOrganizationIdAndComment` для проверки duplicate.
- `ProductReadModelRepository.findFirstByOrganizationIdAndNameIgnoreCase` — резолв товара по name из 1С.

Раунд 5 (приёмка-доводка) ✅:
- Auto-placement в `ReceiptSessionService`: новый метод `PlacementService.autoSelectCellForReceipt(warehouseId, productId, conditions, role)` — выбирает первую свободную ячейку с подходящими условиями. Применяется когда worker не задал cellId. Решает баг «у директора всё свободно после приёмки» — теперь inventory.cellId реально заполняется.
- `storageConditions` пробрасывается из FE приёмки в `ProductBatch` через новое поле `ReceiptItem.storageConditions`. В UI receive wizard — Select «Условия хран.» в колонке таблицы.
- `palletPlaceId` используется как fallback cellId, если задан.
- FE: `GenerationModeCheckbox` дублирован в шаг 3 wizard'а (выбор «через РПА» ДО запуска приёмки + сохранение в localStorage → axios interceptor пробрасывает `X-Generation-Mode` header).
- FE: при `onPickReceive` плановой поставки с items — items автоматически предзаполняются в wizard (product/sku/qty/price/packaging/units/storage).
- FE: ошибки валидации в Alert переведены — словарь `FIELD_LABELS` (productId→Товар, quantity→Количество, pricePerUnit→Цена, и т.д.).

Раунд 6 (WORKER флоу):
- **Размещение** ✅ (6.1): `PlacementService.autoSelectCellForReceipt` учитывает storageConditions, `cell.maxWeightKg`, `rack.maxWeightKg` cumulative, объём `cell.length×width×height` vs `product.volumeM3 × quantity × unitsPerPackage`. Endpoint `GET /api/racks/warehouse/{warehouseId}/cells-flat`. FE receive-wizard: Autocomplete по стеллажам + Autocomplete PalletPlace. **Открыто:** валидация веса при manual cellId (сейчас доверяем worker), hard-block просроченных партий при FEFO.
- **6.3 фиксы**: `NonUniqueResultException` при приёмке — `findByProductIdAndWarehouseIdForUpdate` падал когда у товара на одном складе несколько inventory-row (разные cell/batch). Заменён на `findExactInventoryForUpdate(productId, batchId, warehouseId, cellId)`. При transfer source с qty=0 удаляется → ячейка освобождается. Auto-pick + UI receive wizard теперь фильтруют по `packagingType` — PALLET идёт только на pallet-места, остальное (BOX/CRATE/EACH) — только на cells/shelves. TransferDialog: дробное перемещение, фильтр target по packagingType.
- **6.4 единицы измерения (вариант C)**: `inventory.quantity` — в **штуках** (canonical). На FE worker вводит «упаковок» × «шт./упак.» = «шт.». Добавлены колонки `package_length_cm/width_cm/height_cm/weight_kg` на `supply_items` и `product_batch`. `PlacementService` теперь считает: вес = `packageWeightKg × numPackages` (или `product.weightKg × quantity`), объём = `(L×W×H/1e6) × numPackages` (через габариты упаковки, не product.volumeM3). Для PALLET — доп. проверка `packageHeightCm ≤ palletPlace.maxHeightCm`. FE: новые поля «Длина/Ширина/Высота/Вес упак.» в receive wizard и в CreateSupplyDialog. TransferDialog работает в упаковках с авто-конвертацией в штуки.
- **Карточки товара** ✅ (6.2): ProductCardPage с 3 вкладками (Где хранится / Партии / История). Списки фильтруются по `user.warehouseId` (worker видит только свой склад). В строке inventory — кнопка «Переместить» (отключена для других складов и для зарезервированного товара). `TransferDialog` перемещает **всю ячейку целиком** (`quantity = source.quantity`, поле количества убрано); target — Autocomplete cells-flat того же warehouseId с фильтром по `storageConditions`. История показывает «Откуда → Куда» для TRANSFER. Endpoint `POST /api/operations/transfer` уже умеет, ProductOperation+InventoryEvent (REMOVED+ADDED) пишутся автоматически. Документ не оформляется. **Контекст пользователя**: видит и перемещает только WORKER; перемещение только в пределах своего `user.warehouseId`; перемещение целиком ячейки X-товара (вся `inventory.quantity`, не дробное — «ящик переезжает, а не штуки из ящика»); карточка = все операции по товару на складе + вкладка «где хранится» с кнопкой; запись в истории `Товар X: ячейка Y → ячейка Z`.
- **Отгрузка** ✅ (6.5, 2026-05-22): FEFO/FIFO/AUTO с split на N items при create, резерв `Inventory.reservedQuantity` под лок, `complete` без второго FEFO (идёт по сохранённому `inventoryId`), `cancel` освобождает резерв. Picking-list ЛП генерируется при create. UI: scanner SKU + Enter→+1, статусы PARTIAL/PICKED, отображение партии/expiry/ячейки. Auto-cleanup пустых inventory + orphans cellId=null (inline + startup + cron 15 мин). Валидация УНП/ИНН получателя (9/10/12 цифр), recipientName+address required. Документы waybill/TN/CMR при complete с алиасами (consignee/shipper/loadingPoint/deliveryPoint, НДС 20%, totals). DataEnrichmentService подтягивает shipperName/Inn/Address из organization-service.

Связи: `Product (1) ↔ (M) SupplyItem.productId` (nullable) + `ProductBatch.productId` (NOT NULL) + `Inventory.productId`. `Supply (1) ↔ (M) ProductBatch.supplyId` (опц.).

---

## 5.6 Флоу Бухгалтера 🚧 IN PROGRESS 2026-05-22

После раунда 6 (WORKER) — ручной прогон UC-11..UC-16. Открытые блоки:
- ⬜ **Переоценка** (`RevaluationPage`): новая цена + комиссия → revaluation-act (ПЕР), InventoryEvent REVALUED.
- ⬜ **Списание** (`WriteoffPage`): комиссия + причина + основание → write-off-act (СПС), InventoryEvent WRITTEN_OFF, уменьшение `inventory.quantity`.
- ⬜ **Инвентаризация** (`InventoryPage`): сессия → внести count → adjustments → inventory-report (ИНВ), tooltip НСБУ N 126.
- ⬜ **Реестр документов** (`DocumentsPage`): фильтр по типу, скачивание из MinIO, presigned URL.
- ⬜ **ABC-анализ** + **marked-for-writeoff** в Аналитике.

Найденные баги — сюда же.

---

## 6. Дорожная карта

| # | Задача | Статус | Оценка |
|---|---|---|---|
| 1 | **§5.5 WORKER приёмка блок 2** — баги B1..B5 в коде | ✅ done | — |
| 2 | **§5.5 smoke в UI** — ручной прогон создания/обновления поставки + receive-wizard | ⏳ ждёт ребилда | 30 мин |
| 3 | **§5.6 Флоу Бухгалтера** — ручной прогон UC-11..UC-16 + фиксы | ⬜ next | 0.5-1 день |
| 4 | **§4.2 docker-compose E2E** — поднять весь стек, BP-1/2/5 через UI | ❌ обязательно перед защитой | 1-2 ч |
| 5 | **§2 §7 RPA E2E smoke** — `.\smoke-rpa.ps1` на Windows-хосте | ⏳ ручная | 30 мин |
| 6 | **§5.2 D-1 / D-2** — фиксы дефектов (org-client 403, inventory-report) | ❌ P1 | 1-2 ч |
| 7 | **§2.28 JWT private-key ротация** — приватный ключ в git history | ❌ security | 10 мин |
| 8 | **§2.21 CORS** на gateway + SSO | ❌ отложен | 1 ч |
| 9 | **§2.22 OAuth secrets** ротация (после §5.5 B5 вынесли — теперь нужно реально ротировать) | ❌ отложен (security) | 1-2 ч |
| 10 | **§5.1 Coverage 80%** | ⏳ отложено | 0.5-1 день |

**Опциональные хвосты (минор):**
- `APP_DB_ENCRYPTION_KEY` пустой → AES в pass-through.
- Postgres/RabbitMQ пароли без `${ENV:default}`-override (4 сервиса).
- `mock-erp` hardcoded `http://localhost:8040` (в Docker — `document-service:8040`).
- `AuthorizationServerConfig:52` ссылается на legacy `http://127.0.0.1:8080/code`.
- `spring.jpa.show-sql=true` в organization-service.
- `client/build/` коммитится в submodule.

**Минимум до защиты:** §5.5 smoke (0.5ч) + §5.6 бухгалтер (0.5-1д) + §4.2 docker E2E (1-2ч) = **~1-2 дня**.

---

## 7. Где смотреть детали

- **Backend конвенции:** `backend/CLAUDE.md` (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **Frontend конвенции:** `client/CLAUDE.md` (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`Требования к *Service.txt`** — authoritative business requirements.
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
- **`FLOWS.md`** — карта flows + open questions.
- **Memory-сводки:** `feedback_backend_first_no_tests`, `feedback_no_code_comments_no_commits`, `project_questions_decisions`, `project_belarus_compliance`, `project_wms_subsystems`, `project_smtp_isp_block`, `project_k8s_state`, `project_test_coverage_state`.
