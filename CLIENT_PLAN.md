# CLIENT_PLAN.md — план работ по клиенту (React SPA)

> Дорожная карта по `client/` (сабмодуль `wmsProjectClient`).
> Дополняет `PLAN.md` (общий) и `FLOWS.md` (нереализованное на бэке).
> Последнее обновление: 2026-05-07.

---

## Контекст для новой сессии

### Репозиторий
- **Umbrella-репо**: `C:\Users\pavel\IdeaProjects\wmsProject_org` — корень проекта.
- **`backend/`** — git submodule `wmsProjectBackend` (Java 21, Spring Boot 3.5, 5 микросервисов + eureka + gateway).
- **`client/`** — git submodule `wmsProjectClient` (React 19, текущая работа).
- **Документы в корне**: `CLAUDE.md` (umbrella), `backend/CLAUDE.md`, `client/CLAUDE.md` — обязательно читать перед правками. `PLAN.md` (большой backend-роадмап), `FLOWS.md` (нереализованное на бэке), `CLIENT_PLAN.md` (этот файл).

### Стек клиента
- **React 19** + react-router-dom 7 (file-based naming под `src/pages/`, маршруты в `src/routes/AppRouter.js`).
- **MUI 7** (`Grid` v2 — `<Grid size={{ xs: 12, md: 4 }}>`, **не** `<Grid item xs>`). Только sx и theme tokens, никаких CSS-файлов.
- **Redux Toolkit** — `authSlice` + три справочника-кеша (`warehousesSlice`, `suppliersSlice`, `employeesSlice`, см. C.8). Остальное — local state + сервисы.
- **Формы**: `react-hook-form` + `yup` через `@hookform/resolvers/yup`. Все схемы централизованы в `src/validation/schemas.js`.
- **Build**: CRA `react-scripts` 5, **без** TypeScript / без ESLint-config-кроме CRA-дефолта.

### Архитектура
- **Auth**: JWT (RS256, 4ч access, 30д refresh в Redis на бэке). У `user` поле `role` (singular) из `/me`. `MainNavbar` фильтрует пункты по `user.role`. Защита маршрутов — `ProtectedRoute` + `RoleGuard` в `AppRouter.js`.
- **API endpoints** — все в `src/config/api.js` (`API_ENDPOINTS`). Никогда не хардкодить пути в компонентах/сервисах.
- **HTTP-слой (унифицирован, C.7 DONE 2026-05-07)**: единая точка — `src/store/api.js` (axios + interceptors). `src/services/httpService.js` — тонкая обёртка над тем же axios-инстансом, существует для обратной совместимости со всеми `*Service.js` (публичный API сохранён 1-в-1). Refresh-токенов и редирект на `/login` при провале выполняет axios response-интерсептор — дублирующая fetch-логика удалена. Токены в `localStorage`.
- **Сервисы** — `src/services/*Service.js`: `auth`, `profile`, `organization`, `warehouse`, `product`, `document`, `analytics`, `supplier`, `supply`, `shipRequest`, `erpExtractor`. Все на `httpService` (кроме authSlice thunks).

### Shared-инфраструктура (готовое, использовать)
- **`context/SnackbarContext.js`** — глобальный toast. Хук: `const { notify } = useSnackbar(); notify('Сохранено'); notify('Ошибка', 'error'); notify('Внимание', 'warning');`. **НЕ** делать локальные `Snackbar`-state в страницах.
- **`components/shared/EmptyState.js`** — плейсхолдер «нет данных». Пропы: `icon` (компонент), `title`, `description`, `actionLabel`, `onAction`, `sx`.
- **`components/shared/ConfirmDialog.js`** — universal confirm. Пропы: `open`, `onClose`, `onConfirm`, `title`, `message` (ReactNode), `confirmText`, `confirmColor` (`error`/`warning`/`success`/`primary`), `busy`, `cancelText`, `maxWidth`. **НЕ** писать inline `<Dialog>` для confirm.
- **`components/shared/LoadingSkeleton.js`** — `TableSkeleton({rows, columns})`, `ListSkeleton({rows})`, `CardsSkeleton({count, height})`, `FormSkeleton({fields})`. Применять при `loading === true` вместо `<CircularProgress />` на больших списках.
- **`components/shared/ErrorBoundary.js`** — обёртывает `<Outlet />` в `MainLayout`.

### Хуки для справочников (использовать вместо ручного `useEffect` + service call)
- `src/hooks/index.js` — `useWarehouses()`, `useEmployees()`, `useSuppliers()`, `useInventoryByWarehouse(id)`. Возвращают `{ data, loading, error, refresh, setData }`.
- Первые три (warehouses/employees/suppliers, **C.8 DONE 2026-05-07**) сидят на Redux-кеше: список грузится один раз на orgId и шарится между страницами; повторные mount'ы отдают данные мгновенно из кеша. После CRUD-операций страница вызывает `refresh()` — обновлённый кеш виден всем подписчикам. Logout очищает кеш через `extraReducers`.
- `useInventoryByWarehouse` остался на `useDirectoryFetch` (зависит от warehouseId, меняется после операций — кеширование контрпродуктивно).
- `src/hooks/useDirectoryFetch.js` — generic-обёртка для остальных ad-hoc fetch'ей.

### Конвенции UI
- **Все user-facing строки на русском.** Не переводить.
- Layout страницы: `<Box bgcolor="#f5f5f5" minHeight="100vh" pt={4} pb={6}><Box maxWidth={1440} mx="auto" px={{xs:2, md:3}}>...</Box></Box>` (см. `OrganizationPage`, `EmployeesPage` etc).
- Узкие формы (Login/Register/Profile/Settings) — без full-bleed background, в Paper по центру с maxWidth 400-680.
- Иконки — из `@mui/icons-material`.
- Цвета статусов: success — зелёный, warning — оранжевый, error — красный, default — серый. `Chip` для статусов с `color` пропом.

### Backend gotchas (важно помнить)
- Большинство POST-эндпоинтов на product-service ждут параметры **в query string**, не в body — особенно inventory-check. Проверяй контроллеры: `@RequestParam` vs `@RequestBody`.
- Headers: бэк требует `X-User-Id`, `X-User-Role`, `X-Organization-Id` в части ручек. Gateway пробрасывает их из JWT, но не везде. Если 400 «Required header missing» — добавить в request явно.
- Многие responses на product-service — `Map<String, Object>` (не строгий DTO). Поля могут варьироваться. Рендер должен быть толерантен.
- Backend использует UUID для всех id. На клиенте мы храним их как строки.
- Регистрация: 2 эндпоинта (`/api/auth/register/director` и `/api/auth/register/invitation`), legacy `/api/auth/register` **не существует**.
- Backend changes сделаны попутно (требуют пересборки):
  - `EmployeeResponse` (org-service) — поля `isActive`, `isBlocked`.
  - `CompleteOAuthRegistrationRequest` (sso-service) — поле `invitationToken`; `OAuthService.completeRegistration` — обработка invitation OAuth.

### Команды
- `cd client && npm start` — dev-сервер :3000. Прокси на `REACT_APP_API_URL` (default `http://localhost:8765` — gateway).
- `cd client && npm run build` — production bundle.
- `cd client && npm test` — Jest watch.
- Backend: `cd backend && ./gradlew :<service>:bootRun` (нужно поднять Eureka, Postgres, Redis, RabbitMQ — `docker-compose up -d` из umbrella).

### Что не использовать
(пусто — TypeScript / i18n / dark theme окончательно отвергнуты, в backlog не возвращаются)

---

## Текущее состояние

Полный wire-up к бэкенду закончен (Спринты 1–4, 2026-05-07). Все страницы (16 рабочих) подключены к API; mock-данные удалены. Спринты 5-6 (полировка):
- Глобальный `SnackbarContext`, `EmptyState`, `ErrorBoundary`.
- Расширенный `ConfirmDialog` (`confirmText`/`confirmColor`/`busy`) применён везде, где есть destructive action: OrganizationPage, EmployeesPage, SuppliersPage, ShipPage, InventoryPage, SettingsPage.
- Skeleton-loaders (`TableSkeleton`, `ListSkeleton`, `CardsSkeleton`, `FormSkeleton`) — на всех страницах с табличной/списочной загрузкой.
- Хуки `useWarehouses` / `useEmployees` / `useSuppliers` / `useInventoryByWarehouse` мигрированы в RevaluationPage, WriteoffPage, EmployeesPage, OrganizationPage, ShipPage, SuppliesPage, ReceivePage, InventoryPage. Остаётся **только** AnalyticsPage (там warehouses/employees напрямую не используются — analytics-endpoints отдают свои данные).
- Удалён dead-код `WriteoffPage_new.js`.
- ESLint config + Prettier config (`.eslintrc.json`, `.prettierrc.json`, `.prettierignore`) добавлены.

Backend-расширения, сделанные попутно (требуют пересборки SSO + organization-service):
- `EmployeeResponse` — поля `isActive`, `isBlocked`.
- `CompleteOAuthRegistrationRequest` — поле `invitationToken`; `OAuthService.completeRegistration` — обработка invitation OAuth с проверкой email match.

---

## Tier 1.5 — недоделки (требуют backend)

| Что | Зависимость |
|---|---|
| ~~OrganizationPage — список слотов внутри стеллажа~~ | ✅ DONE (2026-05-08): добавлен `GET /api/racks/{rackId}/slots` (warehouse-service `RackService.getSlotsByRack` → `{rackId, rackName, kind, slots[]}`). На клиенте — раскрытие стеллажа в `OrganizationPage` показывает sub-table со слотами; колонки зависят от `kind` (SHELF/CELL/FRIDGE/PALLET). После добавления слота кеш стеллажа освежается. Требует пересборки warehouse-service. |
| ~~InventoryPage — детальный список записей сессии~~ | ✅ DONE (2026-05-08): `InventoryCheckService.getInventorySession` теперь возвращает поле `records[]` с `productName/productSku/cellId/expectedQuantity/actualQuantity/discrepancy/markedForWriteoff/isFilled`. На клиенте — таблица записей с цветовой индикацией расхождений и статусами (Не записано / OK / Расхождение / К списанию). Требует пересборки product-service. |
| ~~MainPage — реальная статистика~~ | ✅ DONE (2026-05-08): role-specific dashboards. WORKER — заявки на отгрузку (мой склад), активная инвентаризация-баннер, мои последние операции. ACCOUNTANT — помечено к списанию (warning-баннер), активные поставки, последние списания/переоценки. DIRECTOR — складов/сотрудников/поставщиков/заявок/поставок + последние операции по орг + баннер «склад без ответственного». Без дублирования AnalyticsPage (там KPI остатков и периоды), без новых backend-эндпоинтов. |
| ~~D.11 — DocumentDownloadButton после операций~~ | ✅ DONE (2026-05-08): product-service `OperationController` после `receive`/`writeOff`/`revaluate` синхронно вызывает document-service через новый `DocumentClient` (lb://DOCUMENT-SERVICE) и кладёт `documentId` в ответ. Если document-service недоступен — operation всё равно зафиксирован, просто без documentId (graceful fallback). Клиент: `<DocumentDownloadButton>` в `components/shared/`, подключён в Alert'ах с результатом операции на Receive (по одной кнопке на каждый принятый товар), Writeoff и Revaluation. Требует пересборки product-service. |

---

## AnalyticsPage — 3 вкладки + тренд (2026-05-08)

`Pages/AnalyticsPage.js` переработана на табы. Сверху — KPI-карточки (всего на складах · уникальных позиций · операции за период · доступно), под ними селектор периода (week/month/quarter/year). Тренд-индикатор (↑ зелёный +N% / ↓ красный -N% / → серый 0%) на трёх KPI: «Операции за период», «Всего на складах», «Доступно». «Уникальных позиций» — без тренда (без снэпшотов корректно не восстанавливается).

Источники:
- **Operations trend** — `GET /api/analytics/operations/compare?startDate&endDate` (product-service `ProductAnalyticsService.getOperationsComparison`): операции за `[start,end]` vs `[start-len, start-1]`, `deltaPercent`.
- **Inventory trend** — `GET /api/analytics/inventory/compare?startDate&endDate` (product-service `ProductAnalyticsService.getInventoryComparison`): прошлое состояние восстанавливается через сумму операций (`inflow` = receipt qty, `outflow` = ship + writeoff qty, `delta = inflow - outflow`, `totalAtStart = totalNow - delta`). Тренд = `delta / totalAtStart * 100`. Если данных за прошлый период нет (delta=0 или старт=0) — `null`, бейдж не отображается.

Требует пересборки product-service. Ниже — три вкладки:

- **Обзор** — `Эффективность складов` карточками (имя · уникальных товаров · объём · заполненность с цветным прогресс-баром: <70% синий, 70-90 оранжевый, >90 красный) + два панели: «Операции по типам» (горизонтальные progress-bars с %) + «Загруженность по дням».
- **Операции** — таблица операций с фильтрами по типу + складу + период (наследуется от селектора сверху). Источник `productService.getOperationsHistory({type, warehouseId, startDate, endDate})`. Поля: дата · тип (цветной Chip) · склад · товар · кол-во · сотрудник · operationId. Sticky-header, sortBy дате убыв.
- **Сотрудники** — таблица из `analyticsService.getEmployeesAnalytics(orgId)`. Только для DIRECTOR (иначе info-баннер). Колонки: ФИО+email (через `useEmployees` lookup) · роль · в компании (дней) · всего операций · разбивка по типам (cluster Chip'ов цветовых).

Lazy-loading: при клике на вкладку идёт fetch только её данных. Селектор периода сверху влияет на все три (общий KPI + Обзор + Операции получают новый dateRange; Сотрудники — без периода, у бэка нет такого фильтра).

## Tier 1.5 — клиентское ✅ закрыто (2026-05-08)

- ✅ ReceivePage wizard для нескольких товаров (B.6).
- ✅ ReceivePage история приёмок — вкладка «История» с фильтром склад + «только мои», источник `productService.getOperationsHistory({type:'RECEIVE'})`.
- ✅ OrganizationPage — ФИО ответственного в карточке склада через lookup в `employees`, fallback «уволен или недоступен» при stale `userId`.

---

## A. UX — TODO

(A.1 SnackbarContext, A.2 Skeleton, A.3 EmptyState, A.4 ErrorBoundary — сделано.)

## B. Формы

| ID | Что | Заметка |
|---|---|---|
| B.5 | ✅ **react-hook-form + yup DONE (2026-05-07)** — все 14 форм (Login/RegisterDirector/RegisterByInvitation/Profile/ChangePassword/Suppliers/Employees-invitation/Org/Wh/Rack/Slot/Writeoff/Revaluation/Inventory-start/Inventory-record/Supplies/Ship/Receive) на `useForm` + `yupResolver`. Схемы в `src/validation/schemas.js`. Массивы (Supplies/Ship items) — через `useFieldArray`. Слот (поля зависят от `rack.kind`) — submit-time валидация с `setError`. ErpExtractor оставлен на manual state (один Select `api`/`rpa`, RHF не даёт пользы). Settings/auth-snackbar мигрированы на глобальный `useSnackbar()` параллельно. | DONE |
| B.6 | ✅ **Wizard DONE (2026-05-08)** — `components/shared/FormWizard.js` (Stepper + Back/Next/Submit с per-step `trigger(fields)`-валидацией). Применён в `ReceivePage` (3 шага: параметры → товары[] → подтверждение, массовая приёмка через цикл `receiveProduct` с прогресс-баром и списком ошибок) и `ShipPage.CreateRequestDialog` (3 шага: получатель → склад+стратегия+товары → подтверждение). | DONE |

## C. Структурное

| ID | Что | Заметка |
|---|---|---|
| C.7 | ✅ **HTTP-слои объединены (2026-05-07)** — `httpService.js` теперь тонкая обёртка над axios-инстансом из `store/api.js`. Refresh, redirect, error-нормализация — единая логика в axios-интерсепторе. Все 11 сервисов работают без изменений. | DONE |
| C.8 | ✅ **Redux slices DONE (2026-05-07)** — `warehousesSlice`/`suppliersSlice`/`employeesSlice` живут поверх существующих хуков. Кешируют список по `orgId`, инвалидируются на logout, защищены от concurrent dispatch. SuppliersPage мигрирован на `useSuppliers()`, чтобы CRUD обновлял общий кеш. | DONE |
| C.9 | ✅ **Хуки мигрированы во все 8 страниц.** AnalyticsPage не нуждается (нет справочных запросов). | DONE |

## D. UI

| ID | Что | Заметка |
|---|---|---|
| D.10 | **Quick-actions расширение MainPage** — drag/sort плитки, закрепление любимых действий, кастомный порядок per user; persistence в `localStorage` или Redux-persist. Цена: средняя — DnD-библиотека (~10 KB) + persistence-слой. | OPEN · low-priority (в последнюю очередь) |
| D.12 | ✅ **Breadcrumbs DONE (2026-05-08)** — `components/shared/PageBreadcrumbs.js` подключён в `MainLayout`, отображается под navbar на всех под-страницах `/main` (на самой главной скрыт). Сегменты автогенерируются из pathname через `ROUTE_LABELS`. Глубинные сегменты (Ship → request, Inventory → session, Org → warehouse → rack → slot) пока через диалоги — крошки фиксированы на странице. | DONE |
| D.14 | ✅ **Миграция `ConfirmDialog` закончена** — применён во всех 6 страницах (Org/Employees/Suppliers/Ship/Inventory/Settings). | DONE |

(D.11 — в Tier 1.5 backend (закрыт). D.13 dark theme — отвергнут окончательно.)

## E. Качество кода

| ID | Что | Заметка |
|---|---|---|
| E.17 | ✅ **Prettier + ESLint** — `.prettierrc.json`, `.prettierignore`, `.eslintrc.json` добавлены в `client/`. | DONE |

(E.15 удалить WriteoffPage_new.js — сделано. E.16 TS-миграция, E.18 i18n — отвергнуты окончательно.)

---

## Очерёдность

**Спринт 6 — DONE (2026-05-07)**:
- ✅ C.9 finish — хуки во всех страницах.
- ✅ D.14 finish — `ConfirmDialog` везде.
- ✅ E.17 ESLint + Prettier.

**Спринт 7 — DONE (2026-05-08)**:
1. ✅ **C.7** HTTP-merge (2026-05-07).
2. ✅ **C.8** Redux slices для справочников (2026-05-07).
3. ✅ **B.5** react-hook-form + yup на всех 14 формах (2026-05-07).
4. ✅ **B.6** Wizard — `FormWizard` + ReceivePage (mass receive) + ShipPage create-request (2026-05-08).
5. ✅ **D.12** Breadcrumbs — `PageBreadcrumbs` в `MainLayout`, автогенерация из pathname (2026-05-08).

**Tier 1.5 (backend-зависимое)** — параллельно по мере готовности соответствующих эндпоинтов на бэке.

---

## Что важно при возобновлении работы

1. **Backend перезапустить**: правки в `EmployeeResponse` (org-service) и `CompleteOAuthRegistrationRequest` / `OAuthService` (sso-service) требуют `./gradlew :SSOService:bootJar :organization-service:bootJar -x test` + рестарт обоих сервисов.
2. **localStorage** на клиенте: при апгрейде со старой сессии (или если в localStorage остался `user: "undefined"` от раньше) — Clear storage или incognito-окно.
3. **OAuth invitation flow** при тестировании: backend проверяет совпадение email из OAuth-провайдера с email в приглашении. На моках/тестовых аккаунтах это часто не совпадает — пользователь увидит понятную ошибку и редирект на форму инвайта.
