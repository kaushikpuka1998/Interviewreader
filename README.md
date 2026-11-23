<p align="center">
  <img src="docs/logo.svg" alt="Interview Reader icon" width="88" />
</p>

<p align="center">
  <img src="docs/logo-wordmark.svg" alt="InterviewReader" width="420" />
</p>

<p align="center">
  Interview preparation in one place: <b>4,700+ interview questions with answers</b>, <b>2,500+ runnable coding problems</b>,
  <b>scored system-design practice</b> and mock interviews, across Java, React, Node.js, Go, SQL, Kafka, Microservices, AWS and more.
</p>

<p align="center">
  <a href="https://interviewreader.cloud"><b>🚀 interviewreader.cloud</b></a>
  &nbsp;·&nbsp; <a href="https://interviewreader.cloud/terms">Terms &amp; Privacy</a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-4-646cff?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Spring Boot" src="https://img.shields.io/badge/Spring%20Boot-3.2-6db33f?logo=springboot&logoColor=white">
  <img alt="Java" src="https://img.shields.io/badge/Java-21-f89820?logo=openjdk&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql&logoColor=white">
  <img alt="Railway" src="https://img.shields.io/badge/Deployed%20on-Railway-0b0d0e?logo=railway&logoColor=white">
</p>

---

## ✨ Features

- **Interview questions with answers**: search and filter by technology (Java, React, Node, Go, SQL, HLD, Kafka, Microservices, Design Patterns, Angular, Ruby on Rails, AWS, Behavioral), category, difficulty and read status. Every question has a deep-linkable slug URL.
- **Coding practice**: run code online in many languages, see per-test results, submission history and an estimated time and space complexity graph for accepted solutions. Filter problems by topic and company.
- **System design practice**: draw an architecture on the canvas and run it against traffic targets, or answer by voice or typing and get a score out of 10 with interviewer-style feedback.
- **Mock interviews, company roadmaps, DSA sheets, resume builder, question of the day and leaderboard.**
- **Progress tracking**, notes, dark mode, resizable sidebar and a responsive mobile layout.
- **SEO and sharing**: per-page titles, structured data, sitemap and plain-HTML pages for crawlers.

## 🖼️ Screenshot

> _Add a screenshot at `docs/screenshot.png` to have it render here._

<p align="center">
  <img src="docs/screenshot.png" alt="Interview Reader screenshot" width="900"
       onerror="this.style.display='none'">
</p>

Or just open the **[live app](https://interviewreader.cloud)**.

## 🧱 Tech stack

| Layer      | Stack                                                                 |
|------------|-----------------------------------------------------------------------|
| Frontend   | React 18, Vite 4, Tailwind CSS 3, Framer Motion                       |
| Backend    | Spring Boot 3.2 (Java 21), Spring Web, Spring Data JPA / Hibernate    |
| Database   | PostgreSQL 16                                                          |
| Cache      | Redis (Spring Cache) — read-through caching to cut DB load            |
| Hosting    | Railway (frontend + backend + managed Postgres + Redis)              |

## 🏗️ Architecture

```mermaid
flowchart LR
  U[Browser] -->|slug URLs, fetch| FE[React + Vite SPA]
  FE -->|/api/questions ...| BE[Spring Boot API]
  BE -->|1. check cache| R[(Redis)]
  BE -->|2. on miss: JPA / Hibernate| DB[(PostgreSQL)]
  BE -.->|first-boot seed from bundled questions.json| DB
```

- The SPA calls the backend at `VITE_API_BASE` (defaults to `http://localhost:8082/api`).
- Hibernate owns the schema (`ddl-auto: update`) and the app seeds the `questions` table on first boot from a `questions.json` bundled on the classpath (`QuestionMigrationService`).
- Read endpoints are cached in **Redis** first; Postgres is only queried on a cache miss.

## 📁 Project structure

```
.
├── package.json                 # frontend scripts + deps (root)
├── scripts/
│   └── build-questions.mjs      # (legacy) builds questions.json from markdown
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/questions.json    # seed data (also bundled into the backend jar)
│   └── src/
│       ├── App.jsx              # container: state, routing, data loading
│       ├── main.jsx             # slug router
│       ├── lib/                 # api, storage, slug helpers
│       └── components/          # Sidebar, ReaderPane, Markdown, NotFound, …
└── backend/
    └── src/main/
        ├── java/com/interview/backend/
        │   ├── controller/      # QuestionController, HealthController
        │   ├── entity/ repository/ service/
        │   └── migration/       # QuestionMigrationService (DB seeding)
        └── resources/
            ├── application.yml          # local config
            └── application-prod.yml     # Railway config
```

## 🚀 Getting started (local)

### Prerequisites
- Node.js 18+
- Java 21 + Maven
- PostgreSQL 16 running locally
- Redis running locally

### 1. Database & cache
```bash
# Postgres
docker run --name interview-pg -e POSTGRES_DB=interviewdb \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=1998 \
  -p 5432:5432 -d postgres:16

# Redis
docker run --name interview-redis -p 6379:6379 -d redis:7
```
> Redis is optional for local dev — if it isn't running, the app logs a warning and
> serves straight from Postgres (caching just no-ops). See [Caching](#-caching-redis).

### 2. Backend
```bash
cd backend
./mvnw spring-boot:run     # serves http://localhost:8082/api
```
Defaults (see `backend/src/main/resources/application.yml`): `interviewdb` / `postgres` / `1998`. Override with env vars — see below.

### 3. Frontend
```bash
npm install
npm run dev                # serves http://127.0.0.1:5173
```

## 🔧 Environment variables

**Backend**

| Variable              | Purpose                          | Local default |
|-----------------------|----------------------------------|---------------|
| `DATABASE_URL`        | JDBC url (`jdbc:postgresql://…`)  | `jdbc:postgresql://localhost:5432/interviewdb` |
| `DATABASE_USER`       | DB user                          | `postgres`    |
| `DATABASE_PASSWORD`   | DB password                      | `1998`        |
| `PORT`                | HTTP port                        | `8082`        |
| `REDIS_URL`           | Redis connection (`redis://[:pass@]host:port`) | `redis://localhost:6379` |
| `CORS_ALLOWED_ORIGINS`| comma-separated allowed origins  | `http://localhost:5173,http://localhost:3000` |

**Frontend**

| Variable         | Purpose                | Default                          |
|------------------|------------------------|----------------------------------|
| `VITE_API_BASE`  | Backend API base URL   | `http://localhost:8082/api`      |

> On Railway, `application-prod.yml` builds the JDBC url from the Postgres plugin's
> `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` variables. Add the **Redis** plugin and
> set `REDIS_URL=${{Redis.REDIS_URL}}`, and set `CORS_ALLOWED_ORIGINS` to your frontend
> origin (`https://interviewreader.cloud`).

## 📡 API

Base path: `/api`

| Method | Endpoint                       | Description                                        |
|--------|--------------------------------|----------------------------------------------------|
| `GET`  | `/questions`                   | Paginated search (`tech, category, difficulty, search, status, page, size`) |
| `GET`  | `/questions/{id}`              | Single question by id                              |
| `GET`  | `/questions/categories?tech=`  | Categories for a technology                        |
| `GET`  | `/questions/stats`             | Totals / counts                                    |
| `GET`  | `/health`                      | Liveness probe (used by Railway healthcheck)       |

## ⚡ Caching (Redis)

The question data is effectively read-only, so read endpoints are cached in Redis to
take load off Postgres. Implemented with Spring's cache abstraction
(`@Cacheable` / `@CacheEvict`) backed by a `RedisCacheManager`.

**Cached reads** (`QuestionService`):

| Cache            | Method                | Key                                                  |
|------------------|-----------------------|------------------------------------------------------|
| `questionSearch` | `searchQuestions(…)`  | `tech|category|difficulty|search|page|size|sort`     |
| `questionById`   | `getById(id)`         | `id`                                                 |
| `categories`     | `getCategoriesByTech` | `tech`                                               |
| `stats`          | `getTotalCount` / `getCountByTech` | `total` / `tech`                        |

Design notes & Eviction Policy:

- **TTL 10 min, `ir:` key prefix.** Keys automatically expire after 10 minutes to prevent indefinitely stale data.
- **Immediate Eviction on Writes.** Strong consistency is enforced across the architecture. Whenever a write occurs (via `save`, `saveAll`, `update`, or `delete` in `QuestionService`), the application uses `@CacheEvict(value = {...}, allEntries = true)`. This completely wipes the `questionSearch`, `categories`, `stats`, and `questionById` caches. While wiping everything on a single write might seem aggressive, it is optimal here because this is a heavily read-optimized application where content changes are extremely rare compared to reads. 
- **Search caches only anonymous browses** (`condition = "#status == null"`). Status
  filters (Visited / Solved / Unsolved) depend on per-user `visitedIds`/`readIds`, so
  they skip the cache to avoid cross-user leakage.
- **Human-readable JSON values.** Values serialize as JSON via
  `GenericJackson2JsonRedisSerializer`; paginated results use a small `CachedPage`
  wrapper so Spring's `Page` can round-trip through JSON.
- **Fail-open architecture.** A `CacheErrorHandler` logs and falls back to Postgres if Redis is
  unavailable — requests never fail because of the cache.

**Verify it's working locally** — hit the same endpoint twice and watch the backend
log (SQL is logged at `DEBUG`):

```bash
curl -s "http://localhost:8082/api/questions?page=0&size=50" -o /dev/null   # 1st: runs SQL
curl -s "http://localhost:8082/api/questions?page=0&size=50" -o /dev/null   # 2nd: no SQL (cache hit)

docker exec -it interview-redis redis-cli KEYS 'ir:*'        # see cached keys
docker exec -it interview-redis redis-cli GET  'ir:stats::total'
```

## 📝 Content / data

Questions originally came from Markdown files that were compiled into `questions.json`
by `scripts/build-questions.mjs`, then seeded into Postgres on first boot.

> **Note:** the Markdown source files have since been removed from the repo, so the
> **PostgreSQL database is now the source of truth**. Re-running the seed script will
> produce an empty file until the Markdown sources are restored. Manage question
> content directly in the database (or restore the `java/ react/ sql/ …` Markdown and
> re-run the seed) if you need to regenerate `questions.json`.

## 📦 Build

```bash
npm run build     # frontend production build -> frontend/dist
cd backend && ./mvnw clean package   # backend jar
```

---

<p align="center"><sub>© Interview Reader · Built with React, Spring Boot &amp; PostgreSQL · Read the <a href="https://interviewreader.cloud/terms">Terms &amp; Privacy notice</a></sub></p>
