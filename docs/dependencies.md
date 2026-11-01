# Campus Neighbour Dependency and Environment Inventory

## Purpose

This document records the dependency versions and runtime environment
identified from the `feat/campus-neighbour-app` branch for Update2.

The status distinguishes configuration values extracted from repository
files from versions that have been verified by actually running the project.

## Runtime environment

| Item | Project requirement | Local environment | Source | Status |
|---|---|---|---|---|
| Operating system | Not specified | macOS 26.3.1 | `sw_vers` | Recorded |
| Java | Java 21 | Java 26.0.2.1 | `apps/api/pom.xml`, `java -version` | Compatibility pending |
| Node.js | To be confirmed from repository configuration | Node 24.13.0 | `node -v` | Recorded |
| pnpm | 10.33.0 | 10.33.0 | root `package.json`, `pnpm -v` | Confirmed matching |
| Docker | Required for local services | Docker 29.8.0 | `docker --version` | Recorded |
| Docker Compose | Required for local services | v5.5.1 | `docker compose version` | Recorded |

## Frontend dependencies

| Component | Declared version | Source | Status |
|---|---:|---|---|
| React | `^19.2.0` | `apps/web/package.json` | Extracted |
| React DOM | `^19.2.0` | `apps/web/package.json` | Extracted |
| TanStack Router | `^1.0.0` | `apps/web/package.json` | Extracted |
| TanStack Query | `^5.0.0` | `apps/web/package.json` | Extracted |
| Zustand | `^5.0.0` | `apps/web/package.json` | Extracted |
| i18next | `^25.0.0` | `apps/web/package.json` | Extracted |
| react-i18next | `^16.0.0` | `apps/web/package.json` | Extracted |
| `@stomp/stompjs` | `^7.0.0` | `apps/web/package.json` | Extracted |
| lucide-react | `^0.577.0` | `apps/web/package.json` | Extracted |
| TypeScript | `~5.9.3` | `apps/web/package.json` | Extracted |
| Vite | `^8.0.0` | `apps/web/package.json` | Extracted |
| `@vitejs/plugin-react` | `^6.0.0` | `apps/web/package.json` | Extracted |
| Tailwind CSS | `3.4.19` | `apps/web/package.json` | Extracted |
| PostCSS | `^8.5.0` | `apps/web/package.json` | Extracted |
| Autoprefixer | `^10.4.0` | `apps/web/package.json` | Extracted |
| Vitest | `^4.0.0` | `apps/web/package.json` | Extracted |
| Testing Library React | `^16.0.0` | `apps/web/package.json` | Extracted |
| Testing Library Jest DOM | `^6.0.0` | `apps/web/package.json` | Extracted |
| jsdom | `^28.0.0` | `apps/web/package.json` | Extracted |
| `@types/react` | `^19.0.0` | `apps/web/package.json` | Extracted |
| `@types/react-dom` | `^19.0.0` | `apps/web/package.json` | Extracted |
| `@types/node` | `^24.0.0` | `apps/web/package.json` | Extracted |
| Playwright | `^1.58.0` | `apps/web/package.json` | Extracted |

## Backend dependencies

| Component | Declared version | Source | Status |
|---|---:|---|---|
| Java | `21` | `apps/api/pom.xml` | Extracted; local compatibility pending |
| Spring Boot | `4.1.1` | `apps/api/pom.xml` | Extracted |
| Spring Web MVC | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Spring Security | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Spring Validation | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Spring WebSocket | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Spring Session Data Redis | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Spring Boot Flyway starter | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Flyway PostgreSQL support | Managed by project configuration | `apps/api/pom.xml` | Extracted |
| PostgreSQL driver | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| MyBatis-Plus | `3.5.17` | `apps/api/pom.xml` | Extracted |
| SpringDoc OpenAPI | `3.0.3` | `apps/api/pom.xml` | Extracted |
| Spring Boot Test | Managed by Spring Boot | `apps/api/pom.xml` | Extracted |
| Testcontainers PostgreSQL | Managed by project configuration | `apps/api/pom.xml` | Extracted |

## Infrastructure services

| Service | Image or version | Local port | Source | Status |
|---|---|---:|---|---|
| PostgreSQL | `postgres:18.3` | `54329` | `infra/compose.yml` | Extracted |
| Redis | `redis:8.6.1-alpine` | `6379` | `infra/compose.yml` | Extracted |
| API | Project-built image | `8088` | `infra/compose.yml` | Configuration extracted |
| Web | Project-built image | `8088` | `infra/compose.yml` | Configuration extracted |

## Package scripts

| Purpose | Command | Source |
|---|---|---|
| Start frontend | `pnpm --filter @campus/web dev` | root `package.json` |
| Build frontend | `pnpm --filter @campus/web build` | root `package.json` |
| Run frontend tests | `pnpm --filter @campus/web test` | root `package.json` |
| Run frontend E2E tests | `pnpm --filter @campus/web test:e2e` | root `package.json` |

## Verification status

- Dependency declarations have been extracted from the development branch.
- The project requires pnpm `10.33.0`, and the local pnpm version matches.
- The project declares Java `21`, while the local machine currently reports Java `26.0.2.1`.
- Java compatibility has not yet been verified.
- Complete frontend, backend, infrastructure and CI execution has not yet been verified.
- Exact resolved frontend versions should be checked against `pnpm-lock.yaml`.
- Maven-resolved versions should be confirmed by a successful backend build.
- No real passwords, tokens or private environment values are recorded in this document.
## R7 Update2 环境记录

### 已确认的项目配置

The following values were extracted from the `feat/campus-neighbour-app`
branch configuration:

- pnpm requirement: `10.33.0`
- Backend Java requirement: `21`
- PostgreSQL image: `postgres:18.3`
- Redis image: `redis:8.6.1-alpine`
- PostgreSQL host port: `54329`
- Redis host port: `6379`
- API service port: `8088`
- Frontend package: `apps/web`
- Backend package: `apps/api`
- Docker Compose file: `infra/compose.yml`

### Local machine status

- Operating system: macOS `26.3.1`
- Java: `26.0.2.1`
- Node.js: `24.13.0`
- pnpm: `10.33.0`
- Docker: `29.8.0`
- Docker Compose: `v5.5.1`

### Verification status

- pnpm installation and version matching: verified.
- Repository dependency configuration: extracted from the development branch.
- Java compatibility: not verified; the project declares Java 21 while the local machine reports Java 26.
- Complete backend startup: not verified.
- Complete frontend startup: not verified.
- Complete CI execution: not verified.
- Cross-device reproduction: not verified.

### Current blocker

The local Java version does not match the Java version declared by
`apps/api/pom.xml`. Before claiming that the backend environment is
reproducible, install or activate Java 21 and rerun the backend build and
startup checks.

No real passwords, tokens, or private environment values should be recorded
in this document.
