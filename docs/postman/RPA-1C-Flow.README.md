# RPA-1 (1С) flow — как запустить тест

## 1. Поднять инфраструктуру + сервисы

Из корня репо (`C:\Users\pavel\IdeaProjects\wmsProject_org`):

```powershell
# Самый быстрый путь — всё через docker-compose
docker-compose up -d
```

Это поднимет:
- **postgres-sso** (порт 5432), **postgres-org** (5433), **postgres-warehouse** (5434), **postgres-product** (5435) — БД.
- **redis** (6379) — refresh tokens, кеш.
- **rabbitmq** (5672, UI :15672) — event bus.
- **minio** (9000 API, 9001 console) — хранилище документов.
- **eureka-server** (8761), **api-gateway** (8765).
- **sso-service** (8000), **organization-service** (8010), **warehouse-service** (8020), **product-service** (8030), **document-service** (8040).
- **wms-client** (3000) — React фронт.

Проверка готовности (15-30 сек после `up`):

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
curl http://localhost:8765/actuator/health   # gateway
curl http://localhost:8761                    # eureka UI
```

Все должны быть `healthy / Up`.

### Альтернатива: dev-режим (быстрее итерация по коду)

```powershell
# Терминал 1 — инфра
docker-compose up -d postgres-sso postgres-org postgres-warehouse postgres-product redis rabbitmq minio

# Терминал 2-8 — сервисы (порядок важен: eureka первый!)
cd backend
gradle :eureka-server:bootRun
gradle :api-gateway:bootRun
gradle :SSOService:bootRun
gradle :organization-service:bootRun
gradle :warehouse-service:bootRun
gradle :product-service:bootRun     # ← здесь сидит RPA-1
gradle :document-service:bootRun
```

## 2. Подготовить RPA-1

```powershell
# Запустить WinAppDriver (один раз)
& "C:\Program Files\Windows Application Driver\WinAppDriver.exe"
# Должен показать: Listening on http://127.0.0.1:4723/
```

В `backend/product-service/src/main/resources/rpa.properties` уже прописаны твои пути:

```properties
rpa.onec.enabled=true
rpa.onec.executable=D:\\1C\\8.3.27.1688\\bin\\1cv8ct.exe
rpa.onec.base-path=C:\\Users\\pavel\\OneDrive\\Документы\\utdemo
rpa.onec.username=Администратор (ФедоровБМ)
rpa.onec.section-name=Закупки
rpa.onec.journal-name=Заказы поставщикам
```

Если 1С уже была открыта руками — закрой, чтобы WinAppDriver запускал чистую сессию.

## 3. Импортировать коллекцию в Postman

1. Postman → Import → выбрать `docs/postman/RPA-1C-Flow.postman_collection.json`.
2. Если бэк на нестандартном хосте — поменяй `baseUrl` в Collection Variables (по умолчанию `http://localhost:8765`).
3. Run collection (▶ кнопка вверху коллекции) — все 10 шагов выполнятся подряд. Или запускать запросы вручную сверху вниз.

## 4. Что должно произойти

Шаги 1-7 — обычный backend flow:

- **1. Register director** — создаёт DIRECTOR-аккаунт. accessToken/refreshToken сохраняются автоматически.
- **2. Whoami** — забираем userId.
- **3. Create organization** — создаём «ООО Тест» (УНП 123456789).
- **4. Re-login** — повторный login чтобы получить JWT с проставленным `organizationId` (после регистрации DIRECTOR org-id ещё не в токене).
- **5. Create warehouse** — «Главный склад».
- **6. Create supplier** — «ОАО Молочные продукты».
- **7. Create product** — «Молоко 3.2%, 1л».

Шаг 8 — собственно RPA-1:

- **8. Run RPA-1** — `POST /api/erp-extractor/run?mode=onec`.
  - В этот момент **на экране должна открыться 1С** (1cv8ct.exe запускается с базой utdemo).
  - Бот находит поле «Пользователь», выбирает «Администратор (ФедоровБМ)», жмёт «ОК».
  - Открывается главное окно УТ.
  - Бот кликает раздел «Закупки», потом пункт «Заказы поставщикам».
  - Открывается список заказов поставщикам.
  - Бот итерирует строки таблицы, читает `externalId / expectedDate / supplierName / productName / expectedQuantity`.
  - 1С закрывается через `driver.quit()`.
  - Response: `{ source: '1C-RPA', found: N, new: M, success: true }`.

- **9. Verify deliveries** — `GET /api/erp-extractor/deliveries` — должны появиться записи с `source = '1C-RPA'`.
- **10. Verify log** — `GET /api/erp-extractor/log` — лог запусков, последний должен быть `success=true`.

## 5. Если что-то сломалось

| Симптом | Что делать |
|---|---|
| Шаг 1 → 503 / Connection refused | Какой-то сервис не поднялся. `docker logs <container>` или `gradle bootRun` логи. |
| Шаг 4 (re-login) → 401 | Email из шага 1 не сохранился. Проверь Collection Variables → `directorEmail`. |
| Шаг 8 → 500 «Login failed» | Селекторы поля «Пользователь» не подошли. Сделай скриншот окна логина 1С + дай в Accessibility Insights `Name`/`AutomationId` поля. |
| Шаг 8 → 500 «Navigation failed: Журнал не найден» | Либо раздел «Закупки» не нашёлся, либо «Заказы поставщикам» под другим именем в этой версии УТ. То же — Accessibility Insights. |
| Шаг 8 → success=true, но `found=0` | XPath для строк таблицы не подошёл. Открой таблицу руками в 1С, дай Accessibility tree одной строки. |
| 1С открылась, но бот ничего не делает | WinAppDriver не подключился — проверь что он запущен на 127.0.0.1:4723. `curl http://127.0.0.1:4723/status` должен вернуть JSON. |
| Шаг 8 → fallback «1C extractor выключен» | `rpa.onec.enabled=false`. Поправить в `rpa.properties` (или env-var `RPA_ONEC_ENABLED=true`) и рестартануть product-service. |

## 6. Как тушить

```powershell
docker-compose down       # сервисы остановлены, БД-volumes сохраняются
docker-compose down -v    # ВСЁ удалить включая БД (для чистого следующего запуска)
```
