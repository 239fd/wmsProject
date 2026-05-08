# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is the **organization (umbrella) repo** for a warehouse-management system. Application code lives in two git submodules — do `git submodule update --init --recursive` before doing anything else, otherwise `backend/` and `client/` will be empty. After pulling on `main`, refresh submodules with `git submodule update --recursive --remote` (or just `--recursive` if you want the pinned SHAs).

- `backend/` — submodule (`https://github.com/239fd/wmsProjectBackend.git`). Multi-module Gradle build with Java 21 / Spring Boot 3.5 microservices. Has its own `CLAUDE.md`.
- `client/` — submodule (`https://github.com/239fd/wmsProjectClient.git`). React 19 SPA (Create React App). Has its own `CLAUDE.md`.
- `k8s/` — Kubernetes manifests, applied in numeric order (`00-namespace.yaml` … `09-frontend.yaml`).
- `sql-scripts/` — Postgres init scripts mounted into the four DB containers via `docker-compose.yml` (`userDB.sql`, `organizationDB.sql`, `productDB.sql`, `warehouseDB.sql`). They run **once** on first boot of an empty volume. After that, schema changes flow through Flyway in each service (`backend/<service>/src/main/resources/db/migration/V*.sql`) — see `backend/CLAUDE.md` for the migration list. Hibernate is `validate` everywhere, so the SQL must match the JPA entities. There is a near-duplicate `backend/SSOService/scripts/user-db.sql` used by SSO's standalone `docker-compose.yaml` — keep both in sync.
- `Требования к *Service.txt` — five Russian requirements documents at the umbrella root, one per business service. They describe expected behaviour and authoritative DB schema. **These are the source of truth for what each service should do** — when the code disagrees with them, treat it as a bug or a deliberate gap and surface it. `FLOWS.md` (also at the root) is the running map of implemented flows + open questions vs these requirements.
- `monitoring/` — Prometheus / Grafana / Loki / Jaeger stack (also wired into `docker-compose.monitoring.yml` inside backend).
- `docs/postman/WMS-API-Collection.json` — Postman collection covering every gateway-routed endpoint; useful as a quick reference for request/response shapes.
- Top-level `*.ps1` scripts (PowerShell, Windows-first) and `docker-compose.yml`/`DEPLOYMENT.md` are the entry points for running the whole system; the umbrella repo itself has no buildable code.

## Backend Gradle topology (important)

`backend/settings.gradle` includes all seven projects as plain subprojects:

```
include 'eureka-server'
include 'api-gateway'
include 'SSOService'
include 'document-service'
include 'warehouse-service'
include 'organization-service'
include 'product-service'
```

Consequences when running Gradle commands from `backend/`:

- All seven projects are addressable as `:SSOService`, `:api-gateway`, `:eureka-server`, etc., and pick up the root `subprojects { … }` config from `backend/build.gradle` (Java 21 toolchain, Checkstyle, JaCoCo, Spotless).
- `api-gateway` is a **Kotlin DSL** subproject (`build.gradle.kts` + `settings.gradle.kts`). The other six are Groovy DSL.
- The inner `settings.gradle(.kts)` files inside `eureka-server/` and `api-gateway/` are ignored when invoked from the root build — they only matter if you `cd` into those dirs and run their own `gradlew` directly.
- The `allCodeQuality` / `allTestWithCoverage` / `allFixAndCheck` aggregator tasks in root `build.gradle` operate on a **hardcoded list of five services only** (`codeQualityServices = ['document-service', 'product-service', 'warehouse-service', 'organization-service', 'SSOService']`). `eureka-server` and `api-gateway` are excluded — their `build.gradle(.kts)` files don't apply PMD/SpotBugs/Modernizer/CPD anyway.
- `org.gradle.java.home` in `backend/gradle.properties` is hardcoded to `C:/Program Files/Java/jdk-21`. On non-Windows or different JDK paths, override with `-Dorg.gradle.java.home=…` or edit the property.

## Common commands (run from `backend/`)

```bash
# Build a single service (skip tests)
./gradlew :SSOService:bootJar -x test

# Run a single service locally (requires its DB + Redis + Eureka up)
./gradlew :SSOService:bootRun

# Tests — single service, with JaCoCo report (test is finalizedBy jacocoTestReport)
./gradlew :warehouse-service:test

# Single test class / method
./gradlew :SSOService:test --tests "by.bsuir.ssoservice.service.UserServiceTest"
./gradlew :SSOService:test --tests "*UserServiceTest.register_*"

# All tests with coverage across the five included services
./gradlew allTestWithCoverage

# Quality — single service runs spotlessCheck + PMD + SpotBugs + CPD + modernizer
./gradlew :SSOService:codeQuality

# All five services
./gradlew allCodeQuality

# Auto-fix: format + PMD auto-fixes, then re-check
./gradlew allFixAndCheck       # = allSpotlessApply + allPmdFix, finalizedBy allCodeQuality
./gradlew allSpotlessApply     # format only
./gradlew :SSOService:pmdFix   # PMD auto-fix for one service (defined in pmd-fixer.gradle)
```

JaCoCo coverage minimum is **50%** (`jacocoTestCoverageVerification` rule in `backend/build.gradle`). PMD/SpotBugs/Checkstyle have `ignoreFailures = true` everywhere — they produce reports under `*/build/reports/{pmd,spotbugs,checkstyle}/` but never fail the build.

## Client commands (run from `client/`)

Standard CRA: `npm start` (dev on :3000), `npm run build`, `npm test`. Backend URL is `REACT_APP_API_URL` (defaults to the gateway at `http://localhost:8765`).

## Architecture

Database-per-service microservices behind an API gateway. Service discovery via Eureka; async coordination via RabbitMQ.

| Service | Port | Database | Notable |
|---|---|---|---|
| eureka-server | 8761 | — | Spring Cloud Netflix Eureka |
| api-gateway | 8765 | — | Spring Cloud Gateway (WebFlux), Kotlin DSL build, JWT validation, Loki/Brave tracing |
| SSOService | 8000 | `user_db` (PG :5432) + Redis | OAuth2 authorization server, JWT issuer (RS256), refresh tokens in Redis |
| organization-service | 8010 | `organization_db` (PG :5433) | Org CRUD, employees, invitations (email + token), SMTP outbound |
| warehouse-service | 8020 | `warehouse_db` (PG :5434) | Warehouses, racks (SHELF/CELL/FRIDGE/PALLET), pallet places |
| product-service | 8030 | `product_db` (PG :5435) | Products/batches/inventory, supplies, suppliers, ship-requests, FEFO/FIFO, ABC analysis, ERP RPA extractor, persistent saga |
| document-service | 8040 | — (stateless) | Document generation (PDF default, Apache POI XLS/DOCX templates available) |

Internal package layout per service is uniform: `controller/ service/ repository/ model/ dto/ config/ exception/`. The product-service additionally has `saga/` and `validation/`; document-service has `rpa/` instead of `model/repository/`.

### Auth model (anchor in SSOService)
- Access token: JWT signed with **RS256**, **4-hour TTL** (configurable via `app.security.jwt.access-ttl-seconds`, default 14400). Private key on SSOService; other services validate against the public key exposed by `JwtPublicKeyController`. Claims include `sub` (userId), `email`, `role`, plus `organizationId` and `warehouseId` when known.
- Refresh token: opaque UUID stored in **Redis** keyed by userId, **30-day TTL** (`app.security.jwt.refresh-ttl-seconds=2592000`) — enables instant revocation on logout.
- Roles: `WORKER`, `ACCOUNTANT`, `DIRECTOR` (RBAC enforced via `SecurityFilterChain` and per-controller `X-User-Role` header checks downstream of the gateway). The user has explicitly fixed this set — don't add a fourth role.
- Login attempts (success + failure) are written to a `login_audit` table; refresh-token hashes are stored there too so `getActiveSessions()` can mark the current session.
- OAuth providers (Yandex, Google) are pre-configured — secrets are currently checked into `SSOService/src/main/resources/application.properties`. Treat that file as sensitive; do not regenerate or rotate without coordinating with the user.
- Internal cross-service calls use `/api/internal/**` paths (`InternalUserController` in SSO, `InternalEmployeeController` in org-service). The per-service JWT filter explicitly skips `/api/internal/**`, so these are reachable only from inside the cluster — never expose them through the gateway.

### CQRS / event sourcing convention
Most aggregates split state into a write-side event log and a read model — e.g. `WarehouseEvent` (event store) + `WarehouseReadModel` (projection), persisted via `WarehouseEventRepository` and `WarehouseReadModelRepository`. Commands save an event AND update the read model in the same transaction; queries hit the read model. The same pattern is in place for `UserEvent`/`UserReadModel`, `OrganizationEvent`/…, `RackEvent`/…, `ProductEvent`/…, `InventoryEvent`, `ProductOperationEvent`. RabbitMQ (`RabbitTemplate`) publishes domain events for cross-service consumers. Mirror this pattern when adding new aggregates rather than introducing a single mutable JPA entity.

### Saga (product-service)
Long-running flows are orchestrated by `saga/SagaOrchestrator` with state persisted to `saga_state` (one row per saga, `payload` is JSON). The orchestrator also keeps an in-memory `ConcurrentHashMap` mirror that is rehydrated from the table on `ContextRefreshedEvent` so a restart picks up `PENDING`/`COMPENSATING` sagas. Two sagas exist:

- **Receive saga** (`ReceiveSagaState`): `BATCH_CREATION` → `INVENTORY_UPDATE` → `OPERATION_RECORD` → `COMPLETED`.
- **Ship saga** (`ShipSagaState`): `STOCK_RESERVATION` → `STAGING` → `DOCUMENT_GENERATION` → `INVENTORY_UPDATE` → `OPERATION_RECORD` → `COMPLETED`.

**Compensation реально откатывает изменения** (D-PR-5 закрыт 2026-05-01). `compensate(...)` (receive) удаляет operation, откатывает `Inventory.quantity` (или удаляет inventory если стало ≤0), удаляет batch. `compensateShipSaga(...)` удаляет operation+staging, восстанавливает `Inventory.quantity`, освобождает `reservedQuantity`. `documentId` не трогает (document-service stateless). При сбое самой компенсации статус переходит в `COMPENSATION_FAILED` — требует ручного вмешательства.

### RabbitMQ topology
Each service declares its own exchanges/queues/bindings in `<service>/config/RabbitMQConfig.java`. Conventions: one `TopicExchange` per service (`sso.exchange`, `organization.exchange`, `warehouse.exchange`), routing keys mirror events (`organization.archived`, `warehouse.deleted`, `employee.status.changed`, `user.director.deleted`), queues are durable. Cross-service consumers append the consumer name (`organization.archived.sso.queue`). The currently wired cross-service flows: SSO publishes `user.director.deleted` → org-service archives the org and warehouse-service deletes its warehouses; org-service publishes `organization.archived` and `employee.status.changed` → SSO clears `organization_id`/`is_active`; warehouse-service publishes `warehouse.deleted` → SSO clears `warehouse_id` on affected users.

## Deployment

Two paths, both driven from the umbrella repo root. **All scripts are PowerShell** (`.ps1`) — invoke from PowerShell, not bash:

- **Docker Compose** — `docker-compose.yml` defines four PostgreSQL instances (host ports 5432–5435), Redis (6379), RabbitMQ (5672 / management UI 15672), all backend services, and the React frontend on :3000. Convenience scripts: `build-images.ps1` (builds every service image with the `wms/` prefix), `deploy-docker.ps1` (build + up), `cleanup-docker.ps1` (down + prune).
- **Kubernetes** — apply `k8s/00-…yaml` … `k8s/09-…yaml` in order, or run `deploy-k8s.ps1`. `start-port-forwards.ps1` / `stop-port-forwards.ps1` set up local access; `cleanup-k8s.ps1` removes everything including PVs.

`DEPLOYMENT.md` has the full step-by-step (with troubleshooting section).

### Port map (single source of truth)

When the docker-compose stack is up these are reachable on `localhost`:

| Port                             | What                                                              |
|----------------------------------|-------------------------------------------------------------------|
| 3000                             | React frontend                                                    |
| 5432–5435                        | postgres-sso / -org / -warehouse / -product                       |
| 6379                             | Redis                                                             |
| 5672 / 15672                     | RabbitMQ broker / management UI                                   |
| 8000 / 8010 / 8020 / 8030 / 8040 | SSO / Organization / Warehouse / Product / Document               |
| 8761                             | Eureka                                                            |
| 8765                             | API Gateway (also where the frontend's `REACT_APP_API_URL` points)|
| 9411                             | Zipkin tracing endpoint (used by every service)                   |
| 3100                             | Loki (log aggregation)                                            |

## Conventions to preserve

- Java 21, `-Xlint:all -Xlint:-serial` everywhere; Spotless = google-java-format AOSP, 4-space indent.
- Tests: JUnit 5 + Mockito + AssertJ + MockMvc; Testcontainers for full integration, H2 for fast repository tests. Test classes use Russian `@DisplayName` strings — match the existing style.
- New services should be added under `include` in `backend/settings.gradle` and follow the `controller/service/repository/...` package layout so they pick up Checkstyle/JaCoCo from the root build automatically.
- Russian is used in user-facing strings (controller messages, `@DisplayName`, README/DEPLOYMENT). Keep it; don't translate to English.
