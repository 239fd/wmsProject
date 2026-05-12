# Backend highest-priority backlog 🔥

> Приоритет выше Sprint 7 (документация защиты) и Sprint 8 (восстановление тестов).
> Зафиксировано 2026-05-08. Делать в первую очередь после возобновления работы.

---

## HP-1. Полный набор документов РБ (RPA-шаблоны для 8 типов)

### Текущее состояние (проверено 2026-05-08)

- `document-service` имеет **PDF-генераторы** через `PdfDocumentService` (Apache PDFBox) для **всех 14 типов**:
  receipt-order · release-order · shipment-order · inventory-report · revaluation-act · write-off-act · waybill (ТТН) · picking-list · receipt-act · invoice-fact · invoice · transport-note (ТН) · cmr · discrepancy-act.
  Дефолтный `?format=pdf` работает для всех.
- `DocumentRpaService` (Apache POI на XLS/DOCX-шаблонах) имеет **только 5 шаблонов** в `backend/document-service/documents template/`:
  - `Приходной ордер.XLS` (receipt-order)
  - `акт переоценки.xls` (revaluation-act)
  - `инвентарихационная опись.xls` (inventory-report)
  - `списание.docx` (write-off-act)
  - `ттнls.xls` (waybill / ТТН)
- В `DocumentService.java` (`backend/document-service/src/main/java/by/bsuir/documentservice/service/`) `case "..." -> rpaService.generateXxx(mapToXxxData(data))` определён только для этих 5. Для остальных 8 типов вызов идёт в PDF без RPA-альтернативы.

### Что делать

1. Создать XLS/DOCX-шаблоны (с кириллическими именами файлов, как остальные) для **8 пропущенных типов**:
   - `release-order` (отпускной ордер)
   - `transport-note` (ТН — товарная накладная)
   - `cmr` (CMR международная)
   - `invoice-fact` (счёт-фактура)
   - `invoice` (инвойс)
   - `picking-list` (лист подбора)
   - `receipt-act` (акт приёмки)
   - `discrepancy-act` (акт о расхождении)
2. В `DocumentService.java` (~строка 191) добавить `case "..." -> rpaService.generateXxx(mapToXxxData(data));` для каждого типа.
3. В `DocumentRpaService.java` добавить `generateXxx(...)` методы (паттерн из 5 существующих).
4. Mapper-методы `mapToXxxData(Map<String, Object>) → DTO` в `DocumentService` (5 уже есть — повторить паттерн).
5. **Сверить с требованиями БР-законодательства**: УНП плательщика и получателя, БИК, ОКПО, юр. адреса, серия и номер документа, реквизиты ответственного, место для печати/подписи. Дополнить шаблоны и DTO.
6. PDF-генераторы (`PdfDocumentService.generateXxxPdf`) тоже привести в соответствие — отрисовать те же поля в PDF-разметке.

### Файлы

- `backend/document-service/documents template/` — новые шаблоны.
- `backend/document-service/src/main/java/by/bsuir/documentservice/service/DocumentService.java` — `case`'ы + mappers.
- `backend/document-service/src/main/java/by/bsuir/documentservice/rpa/DocumentRpaService.java` — generate-методы.
- `backend/document-service/src/main/java/by/bsuir/documentservice/service/PdfDocumentService.java` — расширить PDF-разметку.

### Acceptance

- Все 14 типов работают и `?format=pdf`, и `?format=xls`/`?format=docx`.
- В сгенерированных документах присутствуют все обязательные реквизиты по БР.
- Юнит-тест на каждый mapper (валидный input → корректный DTO).
- Smoke-тест на каждый generator (вызов → не-null `documentId`, файл скачивается).

### Оценка: 2-3 рабочих дня

8 шаблонов × ~30 мин + 8 mappers + generate-методов × ~30 мин + ревью БР-полей + базовые тесты.

---

## HP-2. Пагинация на всех списочных endpoints 🟡 В ПРОЦЕССЕ (старт 2026-05-11)

### Прогресс

- ✅ **Эталон закрыт на Suppliers** (2026-05-11). Не запущен/не проверен в работающем стеке — ждёт прогона `/main/suppliers`.
  - Backend: `SupplierRepository` (`Page<> findByIsActiveTrue(Pageable)`, `Page<> findByOrganizationIdAndIsActiveTrue(UUID, Pageable)` рядом со старыми `List<>`), `SupplierService.getAll(orgId, Pageable) → Page<SupplierResponse>` рядом со старым `getAll(orgId) → List`, `SupplierController` (`@PageableDefault(size=20, sort="name")` + `MAX_PAGE_SIZE=100` capping через `capSize()`). Контракт ответа стал `Page<SupplierResponse>` — **breaking**.
  - Frontend: `services/supplierService.js` — `list({page, size, sort})`, default `size=1000` чтобы autocomplete-кейсы (`useSuppliers` через Redux-slice) получали «весь» справочник одним вызовом. `pages/SuppliersPage.js` — отвязан от Redux-кеша, локальный state `{page, rowsPerPage}`, `<TablePagination>` (10/20/50/100, RU-локализация `labelRowsPerPage`/`labelDisplayedRows`). После CRUD: `dispatch(invalidateSuppliers())` + локальный refetch — autocomplete на других страницах подхватит при следующем mount.
- ❌ **product-service pending:** Supply, ShipmentRequest, Product (getAll/byCategory), Batch (byProduct/getAll), Inventory (byWarehouse/byProduct), Operation (markedItems), ErpExtractor (deliveries).
- ❌ **warehouse-service pending:** Warehouse (getAll/getByOrg), Rack (getRacksByWarehouse/getCellsByRack/getSlotsByRack).
- ❌ **Frontend pending:** SuppliesPage, ShipPage (requests + history), ReceivePage history tab, AnalyticsPage Operations tab, DocumentsPage (UI на уже-paginated бэке).

### Текущее состояние (проверено 2026-05-08)

- Большинство list-endpoints возвращают `List<X>` через `findAll()` или `findByOrganizationId(...)`. На крупном складе (10k+ строк inventory, 10k+ operations) это O(n) network + memory + не отвечает требованию PER-2 (≤5 сек).
- **Исключение**: org-service `getEmployees(orgId, page, size)` уже умеет `Pageable` (см. `EmployeeManagementService` + frontend `organizationService.getEmployees`).
- **Без пагинации**:
  - **product-service**: `getOperationsHistory`, `getInventory(warehouseId)`, `getMarkedForWriteOff`, `searchProducts`, `Supply.list`, `Supplier.list`, `ShipRequest.list`.
  - **warehouse-service**: `getWarehousesByOrg`, `getRacksByWarehouse`, `getSlotsByRack` (только что добавил — без пагинации).
  - **document-service**: `GET /api/documents` уже paginated, проверить, что фронт корректно отображает.

### Что делать

#### Backend

Заменить `List<X>` на `Page<X>` через все 3 слоя:

- В `*Repository` — заменить `findAll()` / `findByXxx(...)` на варианты с `Pageable`.
- В `*Service` — пробросить `Pageable` через все list-методы.
- В `*Controller` — `@PageableDefault(size = 20)` + `Pageable pageable` параметр (Spring magic). Возвращать `ResponseEntity<Page<X>>`.

#### Frontend

Добавить `<TablePagination>` (MUI) на табличные страницы:

- `DocumentsPage` (уже paginated на бэке, нужен UI)
- `AnalyticsPage` Operations tab
- `ShipPage`
- `SuppliesPage`
- `SuppliersPage`
- `ReceivePage` history tab

Сервис-методы принимают `{ page, size }`. Текущие сервисы уже принимают params, нужно просто пробросить.

#### Тесты

- На корректность `Page` response: `content[]`, `totalPages`, `totalElements`, `number`, `size`.
- Smoke / performance тест на 10k записей не падает.

### Файлы (минимум)

- `backend/product-service/src/main/java/by/bsuir/productservice/repository/{ProductOperationRepository, InventoryRepository, SupplyRepository, SupplierRepository, ShipRequestRepository, ProductReadModelRepository}.java`
- `backend/product-service/src/main/java/by/bsuir/productservice/service/*.java` — все list-методы.
- `backend/product-service/src/main/java/by/bsuir/productservice/controller/*.java` — `@PageableDefault(size = 20)`.
- `backend/warehouse-service/...` — аналогично для warehouses + racks + slots.
- `client/src/services/*.js` — обновить `list()` / `getXxx()` принимать `{ page, size }`.
- `client/src/pages/*.js` — добавить `<TablePagination>` под таблицы; локальный state для `page` + `rowsPerPage`.

### Acceptance

- Все list endpoints на бизнес-сервисах пагинируются.
- Default `size = 20`, max `size = 100`.
- Frontend на табличных страницах показывает MUI `<TablePagination>` с переключением страниц.
- Сервер не падает на 10k+ операциях (smoke / performance тест).
- В `Page` JSON-response: `content[]`, `totalPages`, `totalElements`, `number`, `size`.

### Оценка: 2-3 рабочих дня

Backend ~1.5 дня (тронуть много `Repository`/`Service`/`Controller`). Frontend ~0.5-1 день (добавить `<TablePagination>` в ~6-7 страниц). Smoke-тесты ~0.5 дня.

---

## Совокупная оценка

**HP-1 + HP-2 ≈ 4-6 рабочих дней** на одного бэкендера + ~1 день на фронте для HP-2.

После них браться за Sprint 7 (документация защиты, см. `PLAN.md §5`) и Sprint 8 (восстановление тестов, см. `PLAN.md §2.6`).
