# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is the **organization (umbrella) repo** for a warehouse-management system. Application code lives in two git submodules — do `git submodule update --init --recursive` before doing anything else, otherwise `backend/` and `client/` will be empty. After pulling on `main`, refresh submodules with `git submodule update --recursive --remote` (or just `--recursive` if you want the pinned SHAs).

- `backend/` — submodule (`https://github.com/239fd/wmsProjectBackend.git`). Multi-module Gradle build with Java 21 / Spring Boot 3.5 microservices. Has its own `CLAUDE.md`.
- `client/` — submodule (`https://github.com/239fd/wmsProjectClient.git`). React 19 SPA (Create React App). Has its own `CLAUDE.md`.
- `k8s/` — Kubernetes manifests, applied in numeric order (`00-namespace.yaml` … `09-frontend.yaml`).
- `sql-scripts/` — DB init scripts mounted into PostgreSQL containers via `docker-compose.yml` (`userDB.sql`, `organizationDB.sql`, `productDB.sql`, `warehouseDB.sql`). **Schema authority** — services run with `spring.jpa.hibernate.ddl-auto=validate`, so JPA does NOT create tables; DDL changes go here. There is a near-duplicate `backend/SSOService/scripts/user-db.sql` used by the SSO service's own `docker-compose.yaml` — keep both in sync if you change the user schema.
- `monitoring/` — Prometheus / Grafana / Loki / Jaeger stack (also wired into `docker-compose.monitoring.yml` inside backend).
- `docs/postman/WMS-API-Collection.json` — Postman collection covering every gateway-routed endpoint; useful as a quick reference for request/response shapes.
- Top-level `*.ps1` scripts (PowerShell, Windows-first) and `docker-compose.yml`/`DEPLOYMENT.md` are the entry points for running the whole system; the umbrella repo itself has no buildable code.

## Backend Gradle topology (important)

`backend/settings.gradle` uses both forms — they are not interchangeable:

```
includeBuild 'eureka-server'        // composite build, separate Spring Boot project
includeBuild 'api-gateway'          // composite build, uses Kotlin DSL build.gradle.kts
include      'SSOService'           // subproject of root `warehouseMicroservices`
include      'document-service'
include      'warehouse-service'
include      'organization-service'
include      'product-service'
```

Consequences when running Gradle commands from `backend/`:

- The five `include`d services are addressable as `:SSOService`, `:warehouse-service`, etc., and inherit `subprojects { … }` from `backend/build.gradle` (Java 21 toolchain, Checkstyle, JaCoCo, Spotless).
- `eureka-server` and `api-gateway` are **separate builds** — they do not get the root subprojects config, do not appear in the root `:codeQuality` aggregate, and must be built directly (`cd eureka-server && ./gradlew bootJar`) or via composite-build task references.
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
| SSOService | 8000 | `user_db` (PG :5432) + Redis | OAuth2 authorization server, JWT issuer |
| organization-service | 8010 | `organization_db` (PG :5433) | |
| warehouse-service | 8020 | `warehouse_db` (PG :5434) | |
| product-service | 8030 | `product_db` (PG :5435) | Saga orchestration (`saga/SagaOrchestrator.java`, `ReceiveSagaState.java`) |
| document-service | 8040 | — | RPA document generation (`rpa/DocumentRpaService.java`) |

Internal package layout per service is uniform: `controller/ service/ repository/ model/ dto/ config/ exception/`. The product-service additionally has `saga/` and `validation/`; document-service has `rpa/` instead of `model/repository/`.

### Auth model (anchor in SSOService)
- Access token: JWT signed with **RS256**, 15-minute TTL. Private key on SSOService; other services validate against the public key exposed by `JwtPublicKeyController`.
- Refresh token: opaque UUID stored in **Redis** keyed by userId, 7-day TTL — enables instant revocation on logout.
- Roles: `WORKER`, `ACCOUNTANT`, `DIRECTOR` (RBAC enforced via `SecurityFilterChain`).
- Login attempts (success + failure) are written to a `login_audit` table.
- OAuth providers (Yandex, Google) are pre-configured — secrets are currently checked into `SSOService/src/main/resources/application.properties`. Treat that file as sensitive; do not regenerate or rotate without coordinating with the user.

### CQRS / event sourcing convention
Several services split state into a write-side event log and a read model — e.g. `WarehouseEvent` (event store) + `WarehouseReadModel` (projection), persisted via `WarehouseEventRepository` and `WarehouseReadModelRepository`. Commands save an event AND update the read model in the same transaction; queries hit the read model. RabbitMQ (`RabbitTemplate`) publishes domain events for cross-service sagas. Mirror this pattern when adding new aggregates rather than introducing a single mutable JPA entity.

### Saga (product-service)
Long-running flows like goods receipt are orchestrated by `SagaOrchestrator` with state in `ReceiveSagaState`. Touching shipment/receipt logic usually means editing the saga + the participating services' event handlers; don't bypass it with synchronous calls.

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
