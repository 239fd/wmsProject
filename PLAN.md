# План работ по WMS-проекту

> Содержит только открытое. История закрытого — в `git log` и memory-сводках.
> Источник истины — **`poyasn.pdf`** > `User-flow {работник,бухгалтер,директор}.pdf` > текущий код. (Прежняя цепочка ссылалась на `Спецификация_требований_разработчика_SRS.pdf` и `Требования к *Service.txt` — этих файлов в репо нет, факт-чек 2026-05-24.)

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

~99% backend, ~98% frontend. До защиты осталось: §4.2 docker-compose E2E + опциональные UI-доводки.

### Что сейчас открыто

- **§5.2 Дефекты:** D-1 (org-client 403), D-3 (.doc/.RTF → workaround на PDF).
- **§2 §7 E2E smoke** RPA (ручная проверка на Windows + 1С).
- **§4.2 docker-compose E2E** — обязательная проверка перед защитой.
- **§5.1** Coverage 51.7% → 80% — отложено.
- **§2.21/§2.22/§2.28** CORS gateway, ротация утёкших секретов (OAuth Google/Yandex и JWT private key — в текущем `application.properties` они уже параметризованы `${...:}` с пустыми дефолтами, на HEAD утечки нет; но коммит-leak от bypass push-protection 2026-05-22 остался в git history → ротировать в Google/Yandex Console + revoke), keystore rotation — отложено.
- **§6.6** waybill/TN/CMR на complete отгрузки — payload расширен, но шаблоны ТТН-1 ждут полей `vehicleNumber/driverName/contractNumber` — этих полей нет ни в `ShipmentRequest`, ни в форме. EXPORT-пакет (CMR) тоже минимален. Если решим заполнять — отдельный round.

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

10 бизнес-типов работают в обоих каналах (PDF default + Python `rpa-service`). На бэке `DocumentController` сейчас имеет **12 endpoint'ов** — 11 «бизнес»-перечисленных в §6.8 плюс отдельный `/analytics-report` (PDF-сводка по складу, дергается из Аналитики DIRECTOR через `OperationController` → `DocumentClient`; не входит в чек-лист §6.8). Дроп `release-order`/`shipment-order`/`invoice-fact`/`discrepancy-act` сделан. `discrepancy-act` теперь — секция внутри `receipt-act`. Калибровка координат POI-шаблонов и расстановка `{{tokens}}` в .doc/.rtf — у пользователя.

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

## 5.6 Флоу Бухгалтера ✅ DONE 2026-05-22 + 2026-05-23

### 5.6.1 Backend services (product-service)

**`RevaluationService.revaluate`** (`backend/product-service/.../service/RevaluationService.java`):
- Использует `inventoryRepository.findAllByProductIdAndWarehouseId(...)` вместо `findByProductIdAndWarehouseId.map(List::of)` — фикс `NonUniqueResultException` при товаре в >1 ячейке.
- Сервис собирает **полностью готовый payload** (`items[]` с `productName/sku/unit/quantity/oldPrice/newPrice/oldValue/newValue/priceDiff/totalDiff`, top-level `totalOldValue/totalNewValue/totalDifference/priceDifference`).
- `documentRegistryService.register(...)` НЕ вызывается из сервиса — это сделал бы дубль (ПЕР-NNNN + ПЕР-NNNN+1). Регистрацию делает только `OperationController.revaluate` через `safeRegister(...)`.
- Удалена зависимость `DocumentRegistryService` из сервиса.

**`WriteOffService.writeOff`** (`backend/product-service/.../service/WriteOffService.java`):
- Когда `cellId == null` → используется `fefoService.selectInventory(strategy=FEFO)` для распределения по N inventory-строкам (ранее `findByProductIdAndWarehouseIdForUpdate` падал `NonUniqueResult`).
- Когда `cellId != null` → `findExactInventoryForUpdate(product, batch, warehouse, cell)`.
- `takenByInv: Map<UUID, BigDecimal>` фиксирует фактически списанное per-row для payload.
- Per-batch строки в payload с реальным `unitPrice` из `batch.purchasePrice` (fallback `product.price`).
- `documentRegistryService.register` НЕ вызывается из сервиса (контроллер делает).
- Drained-inventory (`quantity ≤ 0 AND reservedQuantity ≤ 0`) удаляются inline.

**`InventoryCheckService`** (`backend/product-service/.../service/InventoryCheckService.java`):
- Новая перегрузка `startInventory(warehouseId, userId, organizationId, notes)` — устранила «Сессия без organizationId — пропускаем генерацию описи».
- `buildInventoryReportPayload` переписан по форме ИНВ-3 РБ: добавлены поля `expectedQty/actualQty/expectedValue/actualValue/surplus/shortage/unitPrice/batchNumber/productName/sku/unit/lineNo` + top-level `totalExpectedQty/totalActualQty/totalBookValue/totalActualValue/totalSurplus/totalShortage/totalItems/discrepancyCount`.
- Подтягивает `batch.purchasePrice` через `ProductBatchRepository` для расчёта сумм.

**`InventoryCheckController.startInventory`** (`backend/product-service/.../controller/InventoryCheckController.java`):
- `@RequestHeader("X-Organization-Id")` — orgId пробрасывается из gateway header в сессию.

**`DocumentRegistryService.register`** (`backend/product-service/.../service/DocumentRegistryService.java`):
- `@Transactional(propagation = REQUIRES_NEW)` на обоих вариантах `register(...)`. Раньше при падении генерации документа outer-tx (`completeInventory`, `writeOff`, `revaluate`) помечалась `rollbackOnly` и **откатывалась целиком**, даже несмотря на `try/catch`. Теперь outer-tx завершается успешно, провал документа независим.

**`InventoryCleanupService`** (новый файл, `backend/product-service/.../service/InventoryCleanupService.java`):
- `@EventListener(ApplicationReadyEvent.class)` — cleanup на старте.
- `@Scheduled(cron = "0 */15 * * * *")` — каждые 15 минут.
- `inventoryRepository.deleteEmptyInventory()` — `quantity ≤ 0 AND reservedQuantity ≤ 0`.
- `inventoryRepository.deleteOrphanedInventoryWithoutCell()` — `cell_id IS NULL AND reservedQuantity ≤ 0` (legacy записи из старых приёмок до §5.6 фиксов).

**`FEFOService.selectInventory`** (`backend/product-service/.../service/FEFOService.java`):
- Пул кандидатов: `status == AVAILABLE` (или null) + `quantity - reservedQuantity > 0` (фильтр в одном проходе вместо в loop'е).
- AUTO → FEFO если у любой партии есть `expiryDate`, иначе FIFO. Лог `AUTO стратегия → FEFO (anyExpiry=true)`.
- FEFO: sort by `expiryDate ASC` (NULL в конец) → tiebreaker по `batch.createdAt ASC`.
- FIFO: sort by `batch.createdAt ASC` → tiebreaker по `inventory.lastUpdated`.
- **Просроченные партии исключаются** (warning в логах) + если без них не хватает → `400 "Недостаточно товара (исключено N просроченных партий)"`.
- Per-allocation лог: `[FEFO] +3 из inv=… (batch=123, cell=…, expiry=…, createdAt=…)`.

**`InventoryRepository`** (`backend/product-service/.../repository/InventoryRepository.java`):
- Новые методы: `findAllByProductIdAndWarehouseId` (List), `deleteEmptyInventory` (`@Modifying`), `deleteOrphanedInventoryWithoutCell` (`@Modifying`).

### 5.6.2 Frontend (client)

**`RevaluationPage.js`** (`client/src/pages/RevaluationPage.js`):
- В выпадашке «Ответственный» и «Комиссия»: `{emp.username} · {enumLabel('UserRole', emp.role)}` — теперь «Бухгалтер»/«Кладовщик»/«Заведующий» вместо `ACCOUNTANT/WORKER/DIRECTOR`.
- `<GenerationModeCheckbox />` в форме перед Alert.

**`WriteoffPage.js`** (`client/src/pages/WriteoffPage.js`):
- То же самое: `enumLabel('UserRole', ...)` + `<GenerationModeCheckbox />`.

**`InventoryPage.js`** (`client/src/pages/InventoryPage.js`):
- Убрана отдельная форма «Записать подсчёт» с ручным вводом UUID ячейки.
- Inline-input в таблице записей: для незаполненной — `TextField` с Enter→save, кнопка `=` (вставить ожидаемое), кнопка `✓` (save). Для заполненной — значение + кнопка `✎` (редактировать).
- В шапке таблицы — кнопка **«Всё совпадает»** — bulk-запись `actualQuantity = expectedQuantity` для всех незаполненных позиций.
- `<GenerationModeCheckbox />` рядом с кнопкой «Завершить».
- `Alert` поясняет логику: «расхождение в минус → к списанию, в плюс → корректировка inventory».

**`GenerationModeCheckbox.js`** (`client/src/components/shared/GenerationModeCheckbox.js`):
- `handleChange` теперь делает `localStorage.setItem('generationMode', next)`. **Без этого** axios-интерцептор читал старое значение, и галка «Через 1С / Office (RPA)» вообще не работала — все документы шли через `channel=programmatic`.

**`AnalyticsPage.js`** (`client/src/pages/AnalyticsPage.js`):
- В `OP_TYPE` добавлены ключи `SHIPMENT: 'Отгрузка'`, `STAGING: 'Размещение'` — backend `OperationType` использует именно эти строки, а словарь имел только `SHIP`. Теперь карточка «Операции по типам» показывает «Отгрузка» вместо «SHIPMENT».

### 5.6.3 Документы — payload расширен (обоюдно с §6.5)

| Документ | Шаблон | Generator | Что добавлено |
|---|---|---|---|
| ПЕР (revaluation-act) | `templates/pdf/revaluation-act.html` | `OperationController.revaluate` | `items[].oldValue/newValue/priceDiff/totalDiff`, top-level `totalOldValue/totalNewValue/totalDifference/priceDifference` |
| СПС (write-off-act) | `templates/pdf/write-off-act.html` | `OperationController.writeOff` | per-batch строки, `unitPrice/totalAmount/amount/batchNumber/expiryDate`, top-level `totalAmount` |
| ИНВ (inventory-report) | `templates/pdf/inventory-report.html` | `InventoryCheckService.completeInventory` | `expectedQty/actualQty/expectedValue/actualValue/surplus/shortage/unitPrice/batchNumber/responsiblePerson/chairmanName`, top-level totals |
| ЛП (picking-list) | `templates/pdf/picking-list.html` | `ShipmentRequestService.create` | `sku/unit/quantity/rackName/cellCode/location/strategy` (раньше показывал «— / — 0.0 шт») |

### 5.6.4 Найденные и устранённые баги

| # | Симптом | Корень | Фикс |
|---|---|---|---|
| 1 | PDF карточки товара 500 «U+0422 not available in Helvetica-Bold» | `PDType1Font.HELVETICA*` поддерживает только Latin-1 | Заменён на `PDType0Font.load(doc, DejaVuSans.ttf)` + копия шрифтов в `product-service/src/main/resources/fonts/` |
| 2 | Numeric overflow при приёмке (`package_weight_kg`) | `NUMERIC(10,3)` — лимит 10^7 кг | SQL + entity → `NUMERIC(14,3)` (`product_batch`, `supply_item`) |
| 3 | «Сумма не рассчитывается» в шаге 3 wizard приёмки | FE не считал | `lineTotal()`+`totalSum` + колонки «Упак./Шт./упак./Всего шт./Сумма» |
| 4 | «Габариты не учитываются» (паллет 120см в ячейку 100×100×100) | `PlacementService` проверял только объём | `fitsByLinearDimensions(sorted triplets, pkg ≤ cell)` + FE `fitsBox`/`fitsPallet` |
| 5 | Вес стеллажа не проверяется при manual выборе | `ReceiptSessionService` не валидировал | Новый `PlacementService.validateReceiptCellFit(...)` |
| 6 | Inventory с `cellId=null` (приёмка тихо создавала) | `autoSelectCellForReceipt() == null` молча в БД | 409 Conflict «Не удалось подобрать ячейку…» |
| 7 | `NonUniqueResultException` в writeoff/revaluation | `findByProductIdAndWarehouseIdForUpdate` ↔ много inventory-строк | Revaluation → `findAllBy...` (List). WriteOff → FEFO распределение |
| 8 | Дубль ПЕР-NNNN+ПЕР-NNNN+1 на одной переоценке | Сервис + контроллер оба вызывали `register` | Удалён вызов из сервиса, остался только controller |
| 9 | «Сессия без organizationId — пропускаем опись» | `/inventory-check/start` не читал `X-Organization-Id` | `@RequestHeader` в контроллере + перегрузка сервиса |
| 10 | RPA-чекбокс не работал (всегда `channel=programmatic`) | `GenerationModeCheckbox.handleChange` не писал в localStorage | `localStorage.setItem('generationMode', next)` |
| 11 | Опись не появлялась после complete сессии | `DocumentRegistryService.register` `@Transactional(REQUIRED)` поднимал rollback на outer tx | `Propagation.REQUIRES_NEW` |
| 12 | Picking-list «— / — 0.0 шт» | `quantity=pickedQty=0` на момент create, нет резолва ячейки | Отдельный `buildPickingListPayload(forPickingList=true)` берёт `expectedQty` + `resolveLocation(cellId)` через WarehouseClient |
| 13 | «SHIPMENT» в Аналитике | `OP_TYPE` не имел ключа `SHIPMENT` | Добавлены `SHIPMENT/STAGING` |
| 14 | Inventory `quantity=0` оставались в БД | После complete shipment/writeoff/transfer не чистились | `InventoryCleanupService` + inline-delete в `complete`/`writeOff` |

### 5.6.5 SQL миграции (apply вручную на dev-БД)

```sql
-- package_weight_kg расширение
ALTER TABLE product_batch ALTER COLUMN package_weight_kg TYPE NUMERIC(14, 3);
ALTER TABLE supply_item   ALTER COLUMN package_weight_kg TYPE NUMERIC(14, 3);

-- shipment_request_items — резерв требует знать конкретный inventory
ALTER TABLE shipment_request_items ADD COLUMN IF NOT EXISTS inventory_id UUID;
ALTER TABLE shipment_request_items ADD COLUMN IF NOT EXISTS cell_id      UUID;
```

`sql-scripts/productDB.sql` обновлён — на свежей БД (пустой volume) поднимется правильно.

---

## 6.5 Отгрузка ✅ DONE 2026-05-22

**Backend `ShipmentRequestService`** (`backend/product-service/.../service/ShipmentRequestService.java`):
- **`create`**: per-product FEFO/FIFO/AUTO split → N `ShipmentRequestItem` (один на партию). Каждый item привязан к `inventoryId+cellId+batchId+unitSku`. Резервирует `Inventory.reservedQuantity` под `findByIdForUpdate` lock. Если стока не хватает — 400 с конкретным «доступно X, требуется Y».
- **`complete`**: больше не вызывает FEFO повторно — идёт по сохранённому `inventoryId`. Декремент `quantity` и `reservedQuantity` атомарно под локом. Создаёт `ProductOperation SHIPMENT` per-item, генерит документы. Drained-inventory сразу удаляется.
- **`cancel`**: освобождает `reservedQuantity` по каждому item.
- **`pick`**: больше не триггерит picking-list (теперь генерируется в `create`).
- **Picking-list при `create`** (а не при первом pick): сразу после резерва партий генерируется ЛП-NNNN через `documentRegistryService.register("picking-list", ...)`. По методологии: подбор уже определён FEFO, worker сверяется с листом.
- **`buildPickingListPayload`** vs **`buildPayload`**: разделены через флаг `forPickingList`. Picking-list берёт `expectedQty`, отгрузочные документы — `pickedQty` (с fallback на `expectedQty`).
- **`resolveLocation(cellId, cache)`**: cross-service вызов `warehouseClient.getCellInfo` → `getRack` → собирает `rackName` + `cellCode` + `location`. Кеширование в рамках одного payload.
- **Алиасы полей** для шаблонов: `sku`/`productSku`, `unit`/`unitOfMeasure`, `price`/`unitPrice`, `totalPrice`+`vatAmount`+`totalWithVat`+`amount`+`grossWeight`. Top-level `totalAmount`/`totalVat`/`totalAmountWithVat`/`totalGrossWeight`/`totalQuantity`/`totalLines`/`totalSeats`. Также `consigneeName`/`consigneeAddress`/`consigneeInn`/`payerName`/`payerInn` ← `recipient*`.
- **НДС 20%** в каждой строке по `vatRate=20`, `lineNet/lineVat/lineGross`.
- **`@Transactional` propagation для документов**: см. §5.6.1 (`REQUIRES_NEW`).

**Backend `ShipmentRequestItem`** (`backend/product-service/.../model/entity/ShipmentRequestItem.java`):
- Добавлены `inventoryId UUID`, `cellId UUID` (сохранённая FEFO-аллокация).

**Backend `ShipmentRequestResponse.Item`** (`backend/product-service/.../dto/response/ShipmentRequestResponse.java`):
- Расширен: `inventoryId/cellId/batchNumber/expiryDate/productName/productSku`.

**Backend `CreateShipmentRequestRequest`** (`backend/product-service/.../dto/request/CreateShipmentRequestRequest.java`):
- `@NotBlank` на `recipientName/recipientAddress/recipientInn`.
- `@Pattern("^\\d{9}$|^\\d{10}$|^\\d{12}$")` на `recipientInn` — УНП РБ или ИНН РФ.

**Backend `DataEnrichmentService`** (`backend/document-service/.../service/DataEnrichmentService.java`):
- Из organization: `shipperName/senderName/releasedBy`, `shipperInn/senderInn`, `shipperAddress/senderAddress`, `organizationAddress`.
- Адрес склада → `loadingPoint` (ТТН-1 «Пункт погрузки»).
- Адрес получателя → `consigneeName/consigneeAddress/consigneeInn/payerName/payerInn/deliveryPoint`.
- Fallback `senderOrganizationId` если `organizationId` не передан.

**Backend `PlacementService`** (`backend/product-service/.../service/PlacementService.java`):
- `enforcePlacementFit(cell, rack, batch, qty, rackUsed, isPallet)` + публичный `validateReceiptCellFit(...)`. Проверки: габариты (sorted triplets, ротация разрешена), PALLET → `maxHeightCm` на паллет-месте, CELL → `cell.maxWeightKg` (вес упаковок * количество), RACK → `rack.maxWeightKg` cumulative (учёт уже занятого через `computeWeightByRack`).
- `manualPlacement` и `autoPlacement` проверяют packaging-type ↔ rack-kind (PALLET ↔ паллет-место).

**Frontend `ShipPage.js`** (`client/src/pages/ShipPage.js`):
- Шапка-сканер: поле SKU + Enter → `pick(unitSku, qty=1)` (autoFocus).
- Таблица позиций перерисована: **Товар (+SKU) | Партия (№ + до даты) | Ячейка | SKU единицы | План | Подобрано | Статус | Подбор**.
- Статус `PARTIAL → «Частично»` добавлен.
- Кнопки `+`/`−` per-row с auto-fill `unitSku` из item.

**Frontend `schemas.js`** (`client/src/validation/schemas.js`):
- `recipientName/Address` теперь `required`.
- `recipientInn` regex `^\d{9}$|^\d{10}$|^\d{12}$` — УНП 9 цифр (РБ) или ИНН 10/12 цифр (РФ).

**Frontend `ReceivePage.js`** (`client/src/pages/ReceivePage.js`):
- `fitsBox` (sorted-triplet) + `fitsWeight` фильтры в Autocomplete ячейки.
- `fitsPallet` для паллет-мест: L/W (sorted pair) + `maxHeightCm`.
- `lineTotal()`+`totalSum` + 4 новых колонки в Step 3 (Упак./Шт./упак./Всего шт./Сумма).
- В `CreateProductInlineDialog` убраны `weightKg`/`volumeM3` (вес/объём указываются при поступлении на уровне упаковки).

---

## 6. Дорожная карта

### Сделано (требуют проверки в UI/E2E)

| # | Задача | Статус | Что проверить |
|---|---|---|---|
| 1 | **§5.5 WORKER приёмка** — баги + блок 2 | ✅ done 2026-05-22 | UI smoke по §6.7 «Smoke-проверка приёмки» |
| 2 | **§6.5 Отгрузка** — резерв + FEFO + picking-list + документы + cleanup | ✅ done 2026-05-22 | UI smoke по §6.7 «Smoke-проверка отгрузки» |
| 3 | **§5.6 Флоу Бухгалтера** — переоценка/списание/инвентаризация + документы | ✅ done 2026-05-23 | UI smoke по §6.7 «Smoke-проверка флоу Бухгалтера» |
| 4 | **§5.6.5 SQL миграции** на dev-БД (`package_weight_kg NUMERIC(14,3)` + `inventory_id/cell_id` на `shipment_request_items`) | ✅ done 2026-05-22 | Если не применил `ALTER TABLE` — Hibernate `validate` упадёт при старте product-service |

### Проверка вручную (TODO до защиты)

| # | Задача | Статус | Оценка | Что именно проверить |
|---|---|---|---|---|
| 5 | **§6.8 Полный цикл документов** — прогнать **все 10 типов** через UI, скачать из MinIO, открыть в Acrobat/Excel, сверить с шаблоном | ⬜ next | 1-1.5 ч | См. §6.8 ниже — чек-лист 10 документов с проверкой полей |
| 6 | **§4.2 docker-compose E2E** — поднять весь стек одной командой, BP-1 (приёмка) + BP-2 (отгрузка) + BP-6 (инвентаризация) через UI | ❌ обязательно перед защитой | 1-2 ч | `docker compose up -d` → `localhost:3000` → создать org, склад, юзера, прогнать все 3 BP |
| 7 | **§2 §7 RPA E2E smoke** — `.\smoke-rpa.ps1` на Windows-хосте с MS Office + 1С УТ 11.2 | ⏳ ручная | 30 мин | Каждый из 9 RPA-шаблонов (TN/TTN/CMR/ИНВ/ПЕР/СПС/АП/ПО/инвойс) генерится в `.xlsx`/`.docx` и открывается. 1С парсинг supplies/sales возвращает структурированный JSON. |
| 8 | **§5.2 D-1** — org-client 403 при cross-service вызовах | ❌ P1 | 1 ч | warehouse-service → product-service `/api/internal/inventory/cells-load` падает 403 в k8s-режиме. Воспроизвести, починить cred. |
| 9 | **§2.22 OAuth secrets ротация** (после bypass push-protection 2026-05-22 секреты в public git) | ❌ security P1 | 30 мин | По шагам в §6.7 «Ротация OAuth secrets». ПОСЛЕ ротации — verify login через Google/Yandex продолжает работать. |
| 10 | **§2.28 JWT private-key ротация** — приватный ключ SSO в git history | ❌ security | 10 мин | Сгенерить новую RSA-пару, положить в env-vars, рестарт SSO + все сервисы. |
| 11 | **§2.21 CORS** на gateway + SSO | ❌ отложен | 1 ч | Проверить что `Access-Control-Allow-Origin` корректный для dev и production. |
| 12 | **§6.6 waybill/CMR доводка** — `vehicleNumber/driverName/trailerNumber/contractNumber/contractDate` в форме создания заявки | ⬜ опционально | 2 ч | Шаблоны ТТН-1/CMR ждут эти поля, сейчас отображаются «—». На демо может быть OK, но по форме ТТН-1 РБ — required. |
| 13 | **§5.1 Coverage 80%** | ⏳ отложено | 0.5-1 день | JaCoCo сейчас 51.7%, минимум 50% (`jacocoTestCoverageVerification`). Добавить unit-тесты для новых сервисов (FEFOService, PlacementService, ShipmentRequestService, RevaluationService, WriteOffService, InventoryCheckService, InventoryCleanupService). |

### Опциональные хвосты (минор)

- `APP_DB_ENCRYPTION_KEY` пустой → AES в pass-through.
- Postgres/RabbitMQ пароли без `${ENV:default}`-override (4 сервиса).
- `mock-erp` hardcoded `http://localhost:8040` (в Docker — `document-service:8040`).
- `AuthorizationServerConfig:52` ссылается на legacy `http://127.0.0.1:8080/code`.
- `spring.jpa.show-sql=true` в organization-service.
- `client/build/` коммитится в submodule.
- **Legacy gateway routes** `/api/erp-extractor/**` + `/api/erp-connections/**` остались в `backend/api-gateway/.../config/GatewayConfig.java:26-27` маппинге на product-service, но контроллеров `ErpExtractor*`/`ErpConnection*` там уже нет (снесены 2026-05-21). При попытке хождения через gateway — 404. Удалить из конфига.
- **`req.md` содержит реальный Gmail app-password** (`MAIL_PASSWORD=rujd mvxy aure wlsk` строки 38-40 в публичном git) и устаревшие утверждения (`ddl-auto=update`). Удалить файл или ротировать app-password в Google Account.
- **`FLOWS.md` устарел** (помечен 2026-05-06): все указанные Q-DOC-1..Q-DOC-6 и Q-X-3 как «нереализованные» — давно закрыты (см. §1/§1.5). Удалить или переписать.

**Минимум до защиты:** §6.8 docs cycle (1-1.5ч) + §4.2 docker E2E (1-2ч) + §2.22 OAuth rotation (30 мин) = **~3-4 часа**.

---

## 6.8 Полный цикл документов — чек-лист 🚧 TODO

Прогнать каждый из 10 типов через UI **в обоих каналах** (PDF default + RPA через `<GenerationModeCheckbox/>`). Для каждого открыть в Acrobat / Excel, проверить что все поля заполнены и форматирование не съехало.

| # | Тип | Префикс | Где генерится | Триггер UI | Что проверить (PDF поля) |
|---|---|---|---|---|---|
| 1 | **receipt-order** (Приходный ордер) | ПО | `ReceiptSessionService.createSession` | WORKER → ReceivePage → «Принять» (без расхождений) | организация/УНП/склад, поставщик (имя+УНП+адрес), партия+expiry, qty, ед. изм., итого |
| 2 | **receipt-act** (Акт приёмки) | АП | `ReceiptSessionService.createSession` + `recordDiscrepancy` | WORKER → ReceivePage → «Принять» (с расхождениями) | те же поля + расхождения (план/факт/+−), комиссия, причина |
| 3 | **placement-list** (Лист размещения) | ЛР | (опционально, не подключен в triggering UI) | — | список товаров + рекомендованные ячейки |
| 4 | **picking-list** (Лист подбора) | ЛП | `ShipmentRequestService.create` | WORKER → ShipPage → «Создать заявку» | стратегия (FEFO/FIFO/AUTO), товар+SKU, партия+expiry, локация (стеллаж/ячейка), qty (expectedQty), ед.изм., «Стратегия подбора» в шапке |
| 5 | **waybill** (ТТН-1) | ТН | `ShipmentRequestService.complete` (DOMESTIC, kind=TTN) | WORKER → ShipPage → «Завершить» | грузоотправитель/получатель/плательщик (имя+УНП+адрес), пункт погрузки/разгрузки, ТЗ автомобиля (вакантно — см. §6.6), товарный раздел с НДС 20%/итого, подписи |
| 6 | **transport-note** (ТН-2) | ТН | `ShipmentRequestService.complete` (DOMESTIC, kind=TN) | WORKER → ShipPage → «Завершить» (kind=TN) | аналогично waybill, но layout=horizontal/vertical |
| 7 | **cmr** (CMR) | CMR | `ShipmentRequestService.complete` (EXPORT) | WORKER → ShipPage → «Завершить» (shipmentType=EXPORT) | пункты 1-24 CMR: отправитель/получатель/маршрут/груз/масса/валюта, страны |
| 8 | **invoice** (Инвойс) | ИНВ или СЧФ | `ShipmentRequestService.complete` (EXPORT) | WORKER → ShipPage → «Завершить» (EXPORT) | валюта (USD/EUR/RUB/CNY), НДС 20%, итого с НДС, реквизиты сторон |
| 9 | **revaluation-act** (Акт переоценки) | ПЕР | `OperationController.revaluate` | ACCOUNTANT → RevaluationPage | организация/склад/товар+SKU, qty, старая→новая цена, старая→новая сумма, разница (дооценка/уценка), комиссия |
| 10 | **write-off-act** (Акт списания) | СПС | `OperationController.writeOff` | ACCOUNTANT → WriteoffPage | per-batch строки (товар+SKU+партия+expiry+ячейка), unitPrice из batch.purchasePrice, сумма списания, итого, причина, комиссия |
| 11 | **inventory-report** (ИНВ-3) | ИНВ | `InventoryCheckService.completeInventory` | ACCOUNTANT → InventoryPage → «Завершить» | организация/склад, отв. лицо, председатель + члены комиссии, per-row (план/факт/излишек/недостача + суммы), итого по всем колонкам |

### Дополнительные проверки документной подсистемы

- ✅ **DocumentNumberService**: номера типа `ПО-2026-NNNNN` per-org последовательны (atomic counter в `document_number_sequence`).
- ✅ **MinIO**: каждый PDF/XLSX сохраняется по ключу `<orgId>/<year>/<docType>/<docNumber>.<ext>`.
- ✅ **DocumentRegistryService**: `@Transactional(REQUIRES_NEW)` — сбой генерации не ломает outer-tx.
- ⬜ **DocumentsPage UI**: фильтр по типу + скачивание из MinIO через presigned URL. Сейчас presigned URL работает (`/api/document-registry/{id}/url`), но проверить что **фильтр по типу** в `DocumentsPage` показывает все 11 типов в выпадашке.
- ⬜ **RPA fallback**: при выключенном Python rpa-service галка RPA остаётся disabled — проверить tooltip с пояснением.
- ⬜ **RPA-генерация**: каждый тип через 1 нажатие галки RPA → ответ должен прийти как `.xlsx` (Excel-шаблоны: ТТН/ТН/ИНВ-3/ПЕР/СПС/ПО/АП/инвойс) или `.docx` (CMR — Word-template).
- ⬜ **Документ удалён через `OrganizationDeletionListener`**: при удалении DIRECTOR'a и cascade удалении org все её MinIO-объекты должны быть удалены (cleanup в `OrganizationDeletionListener.onOrganizationDeleted`).
- ⬜ **payload.organizationName / shipperName / consigneeName**: при генерации убедиться что `DataEnrichmentService` подтянул эти поля из org-service / warehouse-service (а не показал «—»).

### Backlog после защиты

| # | Задача | Описание |
|---|---|---|
| B1 | Document preview в UI | Inline-просмотр PDF в DocumentsPage без скачивания (через iframe + presigned URL). |
| B2 | Bulk-генерация ZIP | Скачать пакет документов одной заявки/сессии одним .zip. |
| B3 | Email отправка контрагенту | После complete отгрузки → отправить пакет на email получателя. |
| B4 | Шаблоны на 2 языках | EN-версии для CMR/invoice (сейчас только RU). |
| B5 | Электронная подпись | КЭП на PDF (для электронных версий ТН/ТТН по требованиям Минфина РБ). |

---

## 6.7 Гайды по запуску / проверке (2026-05-22..23)

### Перезапуск после изменений

```powershell
# Стек инфры (postgres × 4 + redis + rabbitmq + minio) — в docker
docker compose up -d postgres-sso postgres-org postgres-warehouse postgres-product redis rabbitmq minio minio-init

# Сервисы — локально через gradle
cd backend
./gradlew :product-service:bootRun        # обычно достаточно одного
./gradlew :document-service:bootRun       # если правил document-service
./gradlew clean compileJava -x test       # если меняли DTO/entity → пересобрать всё

# Frontend — npm
cd client
npm start                                  # хот-релоадится, обычно без рестарта
```

### Применить SQL-миграции на текущей БД (без пересоздания volume)

```powershell
docker exec postgres-product psql -U postgres -d product_db -c "
ALTER TABLE product_batch ALTER COLUMN package_weight_kg TYPE NUMERIC(14, 3);
ALTER TABLE supply_item   ALTER COLUMN package_weight_kg TYPE NUMERIC(14, 3);
ALTER TABLE shipment_request_items ADD COLUMN IF NOT EXISTS inventory_id UUID;
ALTER TABLE shipment_request_items ADD COLUMN IF NOT EXISTS cell_id      UUID;
"
```

Если volume пересоздать — `sql-scripts/productDB.sql` уже содержит правильные типы и столбцы.

### Smoke-проверка флоу Бухгалтера

1. **Переоценка** (`/main/revaluation`, ACCOUNTANT):
   - Выбрать товар → новая цена → причина + основание + ответственный + комиссия (роли в выпадашке на русском).
   - Опционально: галка «Заполнить через 1С / Office (RPA)».
   - Submit → в `/main/documents` появится **ПЕР-2026-NNNNN** (PDF/.xlsx) с заполненной таблицей `Старая цена / Новая цена / Старая сумма / Новая сумма / Разница`.
   - В логе: `channel=programmatic` или `channel=rpa`.

2. **Списание** (`/main/writeoff`, ACCOUNTANT):
   - Кейс A (cell задан): выбрать товар + ячейку + количество → списание точно из этой ячейки.
   - Кейс B (cell не задан, FEFO): товар разнесён по 3 ячейкам, списать общее количество → акт **СПС** с 3 строками по batch'ам (`unitPrice` из `batch.purchasePrice`).
   - После списания drained-inventory (qty=0) удаляются.

3. **Инвентаризация** (`/main/inventory`, ACCOUNTANT):
   - Start session → таблица всех позиций склада с inline-инпутом «Фактически».
   - Способы заполнения: ввод вручную, кнопка `=` (вставить ожидаемое), кнопка «**Всё совпадает**» (bulk).
   - Complete → акт **ИНВ-2026-NNNNN** с колонками `По данным учёта (qty/сумма) / Фактическое наличие (qty/сумма) / Расхождение (излишек | недостача)`.
   - Расхождение в минус → `markedForWriteoff=true` (видно в Аналитике / WriteoffPage).
   - Расхождение в плюс → `adjustInventory(...)` обновляет `inventory.quantity`.

### Smoke-проверка отгрузки

1. На складе 2 партии товара А: P1=60шт (expiry скоро), P2=40шт (expiry позже).
2. Создать заявку на 80шт, **strategy=FEFO**, recipientName/Address/УНП → после submit:
   - В `Inventory.reservedQuantity` обоих rows +60 и +20.
   - В `/main/documents` появится **ЛП-2026-NNNNN** с 2 строками + локацией ячеек + «Стратегия подбора: FEFO».
3. Открыть заявку → в шапке поле сканера → ввести `unitSku` любой строки → Enter → +1 в `pickedQty`.
4. Дособрать всё → «Завершить» (с галкой RPA если хочется .xlsx) → SHIPMENT operation per item + waybill/TN/CMR с НДС 20%, итого с НДС.

### Smoke-проверка приёмки

1. Создать товар (только Название/SKU/Штрих-код/Ед.изм — без вес/объём).
2. Поставка вручную с упаковкой PALLET 120×80×150см, вес 500 кг × 2 паллеты.
3. Шаг 2 wizard → паллет-место `120×80, maxHeightCm=140` НЕ показывается (FE фильтр).
4. Шаг 3 → таблица с колонками Упак/Шт.упак/Всего шт/Сумма + Итого.
5. «Принять» → если worker не выбрал ячейку, авто-подбор. Если перегруз стеллажа — 409 с понятным сообщением.

### Auto-cleanup inventory

`InventoryCleanupService` крутится автоматически:
- При старте `product-service` → удаление nullable/empty rows (лог `Inventory cleanup (startup): empty=N, orphans=M`).
- Каждые 15 минут → то же самое.

Если нужно вручную:
```sql
DELETE FROM inventory WHERE quantity <= 0 AND (reserved_quantity IS NULL OR reserved_quantity <= 0);
DELETE FROM inventory WHERE cell_id IS NULL AND (reserved_quantity IS NULL OR reserved_quantity <= 0);
```

### RPA канал

- Чекбокс «Заполнить через 1С / Office (RPA)» пишет `localStorage.generationMode='rpa'`.
- Axios-интерцептор (`store/api.js:46`) проставляет header `X-Generation-Mode: rpa` на каждый запрос.
- product-service `GenerationModeInterceptor` → ThreadLocal → `DocumentRegistryService.register` → `DocumentClient.fetch(... mode=rpa)` → document-service `DocumentService.generate(mode='rpa')` → `PythonRpaClient.fill(...)` → http `localhost:8060/fill/<type>`.
- Python rpa-service запускается на Windows-хосте: `cd backend\rpa-service && .\run.ps1`. Без него галка дисейблится (`/api/documents/rpa/health` возвращает `enabled=false`).
- При сбое Python → fallback на PDF + header `X-Generation-Channel: rpa-fallback-error`.

### Ротация OAuth secrets (если делали bypass push-protection)

В текущем `SSOService/src/main/resources/application.properties` (HEAD) секреты уже параметризованы `${YANDEX_OAUTH_CLIENT_ID:}` / `${YANDEX_OAUTH_CLIENT_SECRET:}` / `${GOOGLE_OAUTH_CLIENT_ID:}` / `${GOOGLE_OAUTH_CLIENT_SECRET:}` с пустыми дефолтами — то есть на текущем коммите утечки нет. Проблема — в git history (коммит после bypass push-protection 2026-05-22), который надо либо очистить (`git filter-repo`), либо принять и ротировать.

```
1. Google Cloud Console → APIs & Services → Credentials → клиент 68579956901-...apps.googleusercontent.com → Reset secret
2. Yandex OAuth (https://oauth.yandex.ru/client/list) → клиент 1ed72370bec447119a34c600b213cc55 → Сбросить secret
3. Положить новые значения в env-vars (.env или системные):
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   YANDEX_OAUTH_CLIENT_ID=...
   YANDEX_OAUTH_CLIENT_SECRET=...
4. Restart SSOService — application.properties уже читает через ${...}.
```

Аналогично для SMTP: `spring.mail.password=${MAIL_PASSWORD:}` на HEAD тоже пустой default, но **`req.md:38-40` в публичном git содержит активный Gmail app-password** — ротировать в Google Account → Security → App passwords и удалить файл.

---

## 6.9 Документооборот uplift 🚧 IN PROGRESS 2026-05-24

После аудита RPA-канала (Python rpa-service vs backend payload) выявлено: робот умеет заполнять ~50 полей, backend кладёт ~15. Цель — закрыть гэп без расширения БД: подписи резолвятся из существующих `UserReadModel` + `OrganizationEmployee` через `RoleToPosition.label(role)` + `splitFullName`; транспорт/доверенность/контракт/carrier/время CMR §22-24 собираются формой в момент `complete()`/`createSession()` и идут только в payload документа (в entity не сохраняются). Для отсутствующих в БД полей (organizationPhone/Gln/Country, supplierCountry) **никаких дефолтов** — missing значит missing. Receipt-act → .docx только при явном чекбоксе RPA. picking-list / placement-list — только PDF, RPA-чекбокс дисейблится.

### Фазы (snapshot)

| Фаза | Что | Файлы |
|---|---|---|
| **A** ✅ | Internal endpoints: `POST /api/internal/users/by-ids` в SSO (UUID list → `[{userId, fullName, role}]`), `GET /api/internal/organizations/{orgId}/director` в org-service | SSO `InternalUserController`, org-service `InternalEmployeeController` |
| **B** ⏳ | `DataEnrichmentService.enrichSignatures(payload, orgId)`: утилиты `RoleToPosition.label` + `splitFullName`, резолв commissionMembers/chairmanName/responsiblePerson/startedBy/acceptedBy/releasedBy/handedOverBy UUID → «Иванов И.И., Кладовщик», резолв директора org | document-service |
| **C** ⏳ | `CompleteShipmentRequest` DTO расширен: транспорт+доверенность+контракт+accompanyingDocs (DOMESTIC), carrier+countryOfManufacture+8 hour/min §22-24+4 terms (EXPORT). Поля **не сохраняются в `ShipmentRequest` entity** — мерджатся в payload через `mergeManualFields(payload, manual)` | product-service |
| **D** ⏳ | `ReceiptSessionService.build*Payload`: contractNumber/Date из `req.*` или `Supply.snapshot` JSONB; acceptedBy/releasedBy/handedOverBy через `enrichSignatures` | product-service |
| **E** ⏳ | FE: новый `CompleteShipmentDialog` (FormWizard) перед «Завершить отгрузку» — 3 шага DOMESTIC + 4-й шаг для EXPORT; `ReceivePage CreateSupplyDialog` + contractNumber/Date; yup-схемы | client/src/pages |
| **F** ⏳ | `DocumentService.mapTo*Data`: убрать массовый `"—"` fallback → пусто/null; единый обогащённый payload для PDF и RPA | document-service |
| **G** ⏳ | picking-list / placement-list: `DocumentService.generate` принудительно `mode=programmatic` + лог; FE `GenerationModeCheckbox` prop `docType` → disabled + tooltip | document-service + client |
| **H** ⏳ | receipt-act .docx sanity: MinIO ключ `.docx`, Content-Type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, FE качает с правильным extension | product-service + client |
| **I** ⏳ | UI smoke по §6.8 чек-листу (10 типов × 2 канала) | manual |

### UI-правки (по страницам)

- **`ShipPage.js`** — новый `CompleteShipmentDialog` перед `complete(requestId)`. Шаги: Транспорт (vehicleMake/Number, trailerNumber, driverName), Доверенность (proxyNumber/Date/IssuedBy, sealNumber), Контракт (contractNumber/Date, accompanyingDocs). При `shipmentType=EXPORT` — 4-й шаг «Перевозчик и таможня» (carrierName/Inn/Address/Phone, countryOfManufacture, 8 раздельных int CMR §22-24, 4 terms-textarea). Все поля **опциональные** — если не заполнены, в документе остаётся пусто.
- **`ReceivePage.js`** / `CreateSupplyDialog.js` — contractNumber + contractDate в форме поставки (опц.).
- **`GenerationModeCheckbox.js`** — новый prop `docType`; для picking-list/placement-list чекбокс `disabled` + tooltip «Этот документ доступен только в PDF».
- **`RevaluationPage.js` / `WriteoffPage.js` / `InventoryPage.js`** — не меняются: подписи комиссии/ответственного остаются UUID-полями, резолв ФИО+должность делается на backend.
- **`OrganizationPage.js` / `SuppliersPage.js` / `ProfilePage.js`** — не меняются: phone/country/gln/country поставщика не вводятся, эти поля остаются missing в payload (по решению «БД не трогаем, дефолтов не подставляем»).
- **`DocumentsPage.js`** — sanity: фильтр выпадашки покрывает все типы (включая `analytics-report` = 12).

### UI smoke-чек-лист (после фаз A-H) ⬜

1. ⬜ Запустить `docker compose up -d postgres-sso postgres-org postgres-warehouse postgres-product redis rabbitmq minio minio-init` + бэк-сервисы локально через `./gradlew :…:bootRun` + `client/ npm start`.
2. ⬜ ShipPage → создать заявку **DOMESTIC** → собрать → «Завершить» → проверить, что `CompleteShipmentDialog` показывает **3 шага** (Транспорт / Доверенность / Контракт). Submit → в `/main/documents` появляются waybill/transport-note с заполненными полями (включая vehicleNumber/driverName/sealNumber/contractNumber если введены).
3. ⬜ ShipPage → создать заявку **EXPORT** → `CompleteShipmentDialog` показывает **4 шага**, четвёртый — «Перевозчик и таможня» с 8 раздельными hour/min полями CMR §22-24. Submit → пакет {transport-note + cmr + invoice} с заполненными `carrierName/Inn/Address/Phone`, `countryOfManufacture`, временем погрузки/разгрузки и terms.
4. ⬜ ReceivePage → заполнить `contractNumber` + `contractDate` в шаге 1 wizard приёмки → принять → receipt-order и receipt-act содержат эти реквизиты в шапке.
5. ⬜ Любая операция → нажать чекбокс **RPA** → документ приходит `.docx` / `.xlsx` (не PDF). В `/main/documents` кнопка «Скачать» отдаёт файл с правильным расширением.
6. ⬜ Picking-list / placement-list / revaluation-act / receipt-act-без-расхождений → `<GenerationModeCheckbox docType="…">` вообще **не рендерится** (компонент возвращает `null`). Для receipt-act-с-расхождениями (АктРасхождения) RPA разрешён — `DocumentService.isPdfOnly(type, data)` смотрит на `data.discrepancies`.
7. ⬜ RevaluationPage / WriteoffPage / InventoryPage → в сгенерированных PDF/docx подписи комиссии теперь резолвятся в формате «Иванов И.И., Бухгалтер» (а не UUID). Заведующий организации подтягивается в `directorName`/`directorTitle`/`approvedBy` автоматически через `DataEnrichmentService.enrichSignatures`.

### J. Аудит инвентаризации/переоценки/списания (2026-05-24)

Аудит трёх флоу выявил 6 дефектов: после фаз A-H часть подписей всё равно не докатится до документов, потому что backend кладёт «неправильные» ключи или не передаёт их вообще.

#### J.1 Инвентаризация

**Работает корректно:**
- Защита от двух параллельных сессий на одном складе.
- `startInventory` создаёт snapshot всех inventory в `inventory_count` (`expectedQuantity = inventory.quantity`).
- `recordActualCount` правильно считает `discrepancy = actual − expected`.
- `completeInventory`: расхождение в минус → `markedForWriteoff=true`; в плюс → `adjustInventory` (обновляет `inventory.quantity`, создаёт `ProductOperation INVENTORY`, эмитит `InventoryEvent ITEM_ADDED/ITEM_REMOVED`).
- `DocumentRegistryService.register` вызывается один раз с `REQUIRES_NEW` транзакцией.
- payload собирается с totals + per-line surplus/shortage.

**Найдены дефекты:**
- **J-4 (P1):** `commissionMembers` в session сохранены как JSON в `inventory_session.commission_members`, но при формировании payload не парсятся обратно — Python шаблон ИНВ-3 не получит членов комиссии.
- **J-5 (P2):** `adjustInventory` использует `findByProductIdAndWarehouseIdForUpdate` → потенциальный `NonUniqueResultException` при товаре в нескольких ячейках. У `InventoryCount` есть `batchId+cellId` — нужно использовать `findExactInventoryForUpdate`.
- **J-6 (P1):** FE `InventoryPage.onStart` шлёт только `warehouseId/userId/notes`. `responsibleUserId/reason/commissionMembers` ни в session, ни в документе. Нужен start-dialog как в `RevaluationPage`.
- *Минор:* `chairmanName = session.startedBy` — семантически кривовато (это автор сессии, не обязательно председатель), но `enrichSignatures` отрезолвит в любом случае.

#### J.2 Переоценка

**Работает корректно:**
- `findAllByProductIdAndWarehouseId` (List) — фикс `NonUniqueResultException`.
- `product.setPrice(newPrice)` обновляет цену.
- `ProductOperation REVALUATION` + `InventoryEvent REVALUED` на каждой affected inventory-row.
- Регистрация документа только через `OperationController.safeRegister` (нет дубля).
- payload содержит items + всех totals (`totalOldValue/totalNewValue/totalDifference/priceDifference`).

**Найдены дефекты:**
- **J-2 (P1):** Service кладёт ключ `responsibleUserId`, но `DataEnrichmentService.SIGNATURE_KEYS` смотрит на `responsiblePerson`. Резолва ФИО ответственного не произойдёт — он останется UUID-строкой.
- **J-3 (P2):** `chairmanName` не положен → Python шаблон `акт переоценки.xls` ждёт его в ячейке H19, придёт пусто.

#### J.3 Списание

**Работает корректно:**
- `cellId != null` → `findExactInventoryForUpdate(productId, batchId, warehouseId, cellId)`.
- `cellId == null` → FEFO распределение по N inventory-row.
- Per-row decrement + `InventoryEvent WRITTEN_OFF` per row.
- Drained inventory (qty=0) удаляется inline.
- Per-batch строки в payload с `unitPrice` из `batch.purchasePrice` (fallback `product.price`).
- Регистрация документа только через `OperationController.safeRegister`.

**Найдены дефекты:**
- **J-1 (P1, серьёзный):** `WriteOffService.result` не содержит `commissionMembers/responsibleUserId/chairmanName` — UUID положены только в `notes` строкой. СПС-документ всегда без подписей комиссии. Прямой пробел.

#### J.4 Сводный трекер дефектов

| # | Где | Что | Приоритет | Статус |
|---|---|---|---|---|
| J-1 | `WriteOffService.writeOff` | Добавить `commissionMembers/responsibleUserId/chairmanName` в `result` | P1 | ✅ 2026-05-24 |
| J-2 | `RevaluationService.revaluate` / `DataEnrichmentService.SIGNATURE_KEYS` | Унифицировать ключ `responsibleUserId` ↔ `responsiblePerson` (алиас в SIGNATURE_KEYS либо переименовать) | P1 | ✅ 2026-05-24 (Service кладёт оба ключа: `responsibleUserId` + `responsiblePerson`) |
| J-3 | `RevaluationService` + `WriteOffService` | `chairmanName = responsibleUserId` в payload | P2 | ✅ 2026-05-24 |
| J-4 | `InventoryCheckService.buildInventoryReportPayload` | Распарсить `session.commissionMembers` JSON → `List<UUID> commissionMembers` в payload через `objectMapper.readValue` | P1 | ✅ 2026-05-24 |
| J-5 | `InventoryCheckService.adjustInventory` | Заменить `findByProductIdAndWarehouseIdForUpdate` → `findExactInventoryForUpdate(productId, batchId, warehouseId, cellId)` | P2 | ✅ 2026-05-24 |
| J-6 | `InventoryPage.onStart` (frontend) | Start-dialog с выбором ответственного + причины + комиссии (как в `RevaluationPage`/`WriteoffPage`) | P1 | ✅ 2026-05-24 (переключено на `startInventoryCheckStructured` + UI с Ответственный/Причина/Комиссия) |

После фиксов — повторить smoke по 7 пунктам выше.

### K. Габариты ячейки: динамический учёт (2026-05-24) ⏳

Аудит §6.9-J выявил баги D-G1/D-G2 в проверках габаритов/веса (вес на полках не работает; кумулятивный вес стеллажа считает по `product.weightKg`, который теперь не используется). Параллельно пользователь уточнил модель:

- **Стеллаж:** одна общая `maxWeightKg`, нельзя превышать.
- **Ячейка/полка/паллет-место:** L/W — fit-check (sorted triplets, ротация ок); H — состояние, вычитается при placement и возвращается при removal.
- **Cell-level weight columns** (`cell.maxWeightKg`, `shelf.shelfCapacityKg`, `pallet.maxWeightKg`) — перестаём использовать, БД-колонки оставляем как deprecated.

#### Подзадачи

| # | Что | Файл |
|---|---|---|
| K-1 | SQL: `ALTER TABLE shelf/cell/pallet_place ADD remaining_height_cm NUMERIC(8,2)`. Backfill = `heightCm` (для pallet — `maxHeightCm`). | `sql-scripts/warehouseDB.sql` |
| K-2 | Entity: поле `remainingHeightCm` + `@PrePersist` init из heightCm/maxHeightCm. | warehouse-service entities |
| K-3 | Internal endpoint `POST /api/internal/slots/{slotId}/height` body `{delta}` атомарный inc/dec. | warehouse-service `InternalSlotController` (новый) |
| K-4 | `CellInfoDto.remainingHeightCm` + `shelfToMap/cellToMap/palletPlaceToMap` экспортируют поле. | warehouse-service + product-service |
| K-5 | `PlacementService.fitsByLinearDimensions`: H ≤ `remainingHeightCm`. Убрать cell.maxWeightKg checks. Оставить rack.maxWeightKg. | `PlacementService` |
| K-6 | Фикс D-G2: `computeWeightByRack` → `batch.packageWeightKg × ceil(quantity / unitsPerPackage)` вместо `product.weightKg × quantity`. | `PlacementService` |
| K-7 | `WarehouseClient.adjustSlotHeight(slotId, deltaCm)` в product-service. | product-service client |
| K-8 | `doReceive` → `adjustSlotHeight(cellId, -H × ceil(qty/upp))`. | `ProductOperationService` |
| K-9 | `ShipmentRequestService.complete` per-item → `adjustSlotHeight(cellId, +H × ceil(qty/upp))`. | `ShipmentRequestService` |
| K-10 | `WriteOffService.writeOff` per-row → `+H × ceil(taken/upp)`. | `WriteOffService` |
| K-11 | `transferProduct` → src `+H`, dst `−H`. | `ProductOperationService` |
| K-12 | `InventoryCheckService.adjustInventory` → знак по `discrepancy`; clamp на 0 при overflow в плюсе. | `InventoryCheckService` |
| K-13 | `InventoryCleanupService` — no-op для height (всё уже возвращено через write-off/ship/transfer). | `InventoryCleanupService` |
| K-14 | `SagaOrchestrator.compensate*` — симметричный adjust. | `SagaOrchestrator` |
| K-15+K-16 | FE: `ReceivePage.fitsBox/fitsPallet` — H vs `remainingHeightCm`; убрать `fitsWeight` для cell; UI «до Hсм осталось». | `ReceivePage.js` |
| K-17 | FE: `RackDialog` убрать поля cell/shelf/pallet weight (БД-колонки остаются). | `RackDialog.js` |

### L. ABC-анализ uplift (2026-05-24) — выручка вместо штук + ручной триггер

Аудит ABC выявил три неточности интерпретации:
- Оборот считался в штуках, а не в выручке → дешёвые ходовые товары задавливали дорогие низкочастотные.
- В обороте учитывались списания (WRITE_OFF) — это не товарооборот.
- `runManually` не имел публичного endpoint — пересчёт только cron 02:00.
- `@Cacheable("abcDistribution")` не инвалидировался при cron-пересчёте.

#### Реализовано

| # | Что | Файл | Статус |
|---|---|---|---|
| L-1 | `POST /api/analytics/abc-analysis/run` (DIRECTOR-only) + FE кнопка «Пересчитать» в `AbcDonutCard` на Analytics | `ProductAnalyticsController` + `AnalyticsPage.js` + `analyticsService.js` + `api.js` ABC_RUN | ✅ 2026-05-24 |
| L-2 | `@CacheEvict(value = "abcDistribution", allEntries = true)` на `runDailyAbcAnalysis` + `runManually` | `AbcAnalysisService` | ✅ 2026-05-24 |
| L-3 | Оборот = `qty × unitPrice` (batch.purchasePrice → product.price fallback). Учитываются **только** `OperationType.SHIPMENT`. Списания исключены. | `AbcAnalysisService.calculateAndSave` | ✅ 2026-05-24 |
| Default | При auto-placement если `product.abcClass == null` → класс "B" (нейтральный центр) | `PlacementService.autoPlacement` (без изменений) | ✅ confirmed |

#### Backlog (закрыт 2026-05-24)

| # | Что | Файл | Статус |
|---|---|---|---|
| L-4 | Удалить deprecated `Product.weightKg`/`volumeM3` из entity/SQL/DTO/ProductService/SupplyImportService/PlacementService | `ProductReadModel`, `productDB.sql`, 3 DTO, 3 сервиса | ✅ 2026-05-24 |
| L-5 | `responsibleUserId` + `commissionMembers` в `CreateReceiptSessionRequest`, проброс в `baseHeader` → payload (`chairmanName`/`responsiblePerson`/`responsibleUserId`/`commissionMembers`); FE — Select-поля в step 1 receive-wizard | `CreateReceiptSessionRequest`, `ReceiptSessionService`, `ReceivePage.js`, `schemas.js` | ✅ 2026-05-24 |
| L-6 | `SlotHeightRetryService` — in-memory ConcurrentLinkedQueue + `@Scheduled(30s)` retry с exp-backoff, MAX_ATTEMPTS=5, после провала ERROR-лог про DRIFT. `WarehouseClient.adjustSlotHeight` при провале → enqueue | `SlotHeightRetryService` (новый), `WarehouseClient` | ✅ 2026-05-24 |
| L-7 | Удалена ветка `existingInventory.isPresent()` в `doReceive` — недостижима из-за `ensureWarehouseCanFitProduct` + `InventoryCleanupService` чистит qty=0 inline | `ProductOperationService.doReceive` | ✅ 2026-05-24 |

### M. Фиксы по E2E-прогону (2026-05-24)

14 пунктов из ручного E2E. Статус:

| # | Что | Файл | Статус |
|---|---|---|---|
| M-1 | Паллет-слот показывал H=14.5см (толщина поддона) → таблица показывает «Поддон Д×Ш» + «Макс. высота груза» (maxHeightCm) | `OrganizationPage.RackSlotsTable` | ✅ |
| M-2 | «External ID» → «Внешний ID» | `SuppliesSection.js` | ✅ |
| M-3 | «Ед./упак.» → «шт. в 1 упак.» (shrink label, шире input) | `CreateSupplyDialog.js` | ✅ |
| M-4 | PALLET-форма уже без L/W (palletType + maxHeightCm) — verified | `OrganizationPage` slotForm | ✅ |
| M-5 | MUI Select multiple `value must be array` → `value={Array.isArray(field.value)?...:[]}` в 4 мультиселектах | Receive/Inventory/Revaluation/Writeoff | ✅ |
| M-6 | receipt-act PDF пустой товарный раздел → `buildItemRows` + items в payload + template итерирует items при пустых discrepancies | `ReceiptSessionService`, `receipt-act.html` | ✅ |
| M-7 | CMR §16 (Перевозчик) убран из формы complete + mergeManualFields | `CompleteShipmentDialog.js` | ✅ |
| M-8 | Опись: PDF-ключи корректны; добавлены Python-алиасы `total_amount_fact/accounted/totalAmount`. Если сумма 0 — значит у партии нет purchasePrice (цена не указана при приёмке) | `InventoryCheckService` | ✅ |
| M-9 | Invoice PDF: «Всего к оплате» = `totalAmount` (subtotal) → `totalAmountWithVat`; НДС-строка `vatAmount` → `totalVat`; добавлен «Общий вес» = `totalGrossWeight` | `invoice.html` | ✅ |
| M-10 | Revaluation: Python xls-шаблон концептуально про ОС (mock ×1.1) → revaluation-act сделан **PDF-only** (html-шаблон корректен с old/new ценами) | `DocumentService.isPdfOnly`, FE `GenerationModeCheckbox` | ✅ |
| M-11 | Smoke инвентаризации + списания после фиксов | — | ⬜ на пользователе |
| M-12 | «SHIPMENT» в «Последние операции» → `OP_TYPE_LABEL` дополнен SHIPMENT/STAGING (был только SHIP) | `MainPage.js` | ✅ |
| M-13 | Глобально «ИНН» → «УНП» в UI (поставщик/организация); recipient оставлен «УНП/ИНН» (РФ-кейс) | schemas + 6 страниц | ✅ |
| M-14 | Audit всех PDF-templates: receipt-act + invoice исправлены; receipt-order/waybill/transport-note/write-off-act/inventory-report/revaluation-act — ключи совпадают с payload ✓ | document-service templates | ✅ |

**Python xls-шаблоны (RPA-канал) — отдельный backlog:** templates_spec.py использует свои snake_case-ключи и mock-расчёты (вес «—», коэффициент ×1.1 для переоценки). Не трогалось без возможности запустить Python rpa-service. Рекомендация: для revaluation — только PDF (сделано); для invoice/inventory через RPA — проверить на Windows-хосте отдельно.

### Out-of-scope этой итерации

- D-1 (org-client 403), D-3 (.doc/.RTF миграция на XWPF), ротация OAuth/SMTP — отдельные треки.
- Carrier-entity (по решению — поля в форме при complete, не в БД).
- Auto-promote receipt-act на RPA (оставляем ручной чекбокс).
- Отчества в `UserReadModel` (берём из fullName через `splitFullName`).
- Любые SQL-миграции / новые колонки.

---

## 7. Где смотреть детали

- **Backend конвенции:** `backend/CLAUDE.md` (Gradle, package layout, DTO, JWT, RabbitMQ, Saga, RPA).
- **Frontend конвенции:** `client/CLAUDE.md` (RHF+yup, Redux slices, FormWizard, useSnackbar).
- **`poyasn.pdf`** + **`User-flow {работник,бухгалтер,директор}.pdf`** в корне — единственный сохранившийся authoritative source. Прежние `Требования к *Service.txt` и `Спецификация_требований_разработчика_SRS.pdf` отсутствуют в репо (отмечено 2026-05-24).
- **`CLIENT_PLAN.md`** — клиентский трек (закрыт).
- **`FLOWS.md`** — устарел (2026-05-06), описанные «нереализованные» Q-DOC-* / Q-X-3 закрыты. Не доверять.
- **Memory-сводки:** `feedback_backend_first_no_tests`, `feedback_no_code_comments_no_commits`, `project_questions_decisions`, `project_belarus_compliance`, `project_wms_subsystems`, `project_smtp_isp_block`, `project_k8s_state`, `project_test_coverage_state`.
