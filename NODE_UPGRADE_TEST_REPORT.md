# Node.js Upgrade Test Report – LMS Service

Date: 2026-11-05
Upgrade: `node:20-alpine` → `node:24.22.1-alpine` (Node v24.22.1, npm 11.19.1 – confirmed in the built image)

## 1. Changes made

| File | Change |
|---|---|
| `app/Dockerfile` | `FROM node:20-alpine AS builder` → `FROM node:24.22.1-alpine AS builder` |
| `app/package-lock.json` | Regenerated with `npm install --package-lock-only --ignore-scripts` inside `node:24.22.1-alpine` (npm 11). Adds missing optional platform-specific entries (e.g. `@napi-rs/nice-*`, `@msgpackr-extract-*`). No `package.json` change, no source code change. |

`npm install` also rewrote `app/yarn.lock` as a side effect; that was reverted (`git checkout app/yarn.lock`) as unrelated.

## 2. Build results

| Attempt | Result |
|---|---|
| Baseline: Node 20 image, original lockfile | Success (exit 0) |
| Node 24 image, original lockfile | **Failed** at `npm ci` (EUSAGE, 44 "Missing ... from lock file" errors) |
| Node 24 image, regenerated lockfile | **Success** – `Successfully built`, tagged `shiksha-lms-service:node24`; `npm ci` and `npm run build` (`nest build`, 0 TS errors) passed |

## 3. Issues and fixes

1. **`npm ci` lockfile out of sync on Node 24 (npm 11).** The lockfile, generated with an older npm, lacks optional cross-platform package entries which npm 11 requires. Same lockfile passes on Node 20 (npm 10).
   Fix: regenerated `package-lock.json` with npm 11 (above).
2. No other Node 24 compatibility errors were observed in build, tests, or runtime.

## 4. Services / components verified (Node 24 image, run against throwaway local Postgres 15 and Redis 7 containers, not the remote DB from `.env`)

| Check | Result (actual) |
|---|---|
| Container runs Node | `v24.22.1` |
| App boot (`npm run start:dev`, image CMD) | "Nest application successfully started", all routes mapped, "Application is running on port:4000" |
| PostgreSQL connection (TypeORM) | `GET /health/ready` → 200, `{"status":"ok", database up}` |
| Liveness | `GET /health/live` → 200 |
| Docker HEALTHCHECK | `healthy` |
| Redis connection | Redis showed active client connections from the app; BullMQ queue job add/obliterate succeeded (`bullmq job 1`) |
| `sharp` | `require('sharp')` OK |
| Chromium + Puppeteer (certificate PDFs) | Chromium 156.0.8078.79; Puppeteer launched and generated a PDF (5979 bytes) |
| TypeORM CLI (`npm run migration:show`) | Works on Node 24; lists 6 migrations (all pending on the empty test DB; migrations were not executed) |
| `GET /health` (full) | **503** – `user-service`, `assessment-service`, `event-service` "timeout of 3000ms exceeded". These external services are not available in this isolated test environment, so integrations with them were **not verified**. Database was `up`. |

## 5. Test results

Command: `npx jest` inside the built image. Node 24 results compared to the same command on a Node 20 baseline image built from the unmodified Dockerfile.

| | Node 20 (baseline) | Node 24 |
|---|---|---|
| Test suites | 5 failed, 3 passed, 8 total | 5 failed, 3 passed, 8 total |
| Tests | 1 failed, 75 passed, 76 total | 1 failed, 75 passed, 76 total |

Passing suites (both): `course-category.dto.spec`, `coach-progress-dashboard.spec`, `tracking.service.spec`.

Failing suites – **identical on Node 20 and Node 24, i.e. pre-existing and not caused by the upgrade**:
- `src/enrollments/users-enrolled-courses.spec.ts` – TS2561/TS2551: `categoryId` not in `UsersEnrolledCoursesDto` (DTO now uses `categoryIds`).
- `src/lessons/dto/lesson-context.dto.spec.ts` – Cannot find module `src/common/utils/helper.util` (jest has no `src/` path mapping).
- `src/certificate/certificate-course-pdf.spec.ts` – Cannot find module `src/common/utils/response` (same cause).
- `src/courses/courses.service.spec.ts` – Cannot find module `src/modules/modules.service` (same cause).
- `src/lessons/lessons.service.spec.ts` – 1 test fails: "rejects an independent test lesson" (expected BadRequestException, promise resolved).

E2E: `npx jest --config ./test/jest-e2e.json` (Node 24) → suite failed to run: TS2349 in `test/app.e2e-spec.ts` (`import * as request from 'supertest'` not callable). The e2e test was not run on the Node 20 baseline, so it is unconfirmed whether this is pre-existing; it is a TypeScript import-style error unrelated to the Node version.

These failures were left untouched per the "only Node-upgrade-related changes" constraint.

## 6. Remaining issues

- 5 unit suites / 1 unit test (and the e2e suite) fail for reasons unrelated to the Node upgrade (see above); they need separate fixes (jest `moduleNameMapper` for `src/`, stale DTO test, lessons test, supertest import).
- Integrations with user-service, assessment-service and event-service were not verifiable in this environment.
- `nest start` prints a Node 24 `DEP0190` deprecation warning (from the Nest CLI child-process spawn); non-blocking.
- `docker compose` plugin is not installed on this machine, so `docker-compose.yml` was not used; services were started with plain `docker run`.
- Local temp containers/network and the temporary Node 20 baseline image were removed after testing; image `shiksha-lms-service:node24` remains.
