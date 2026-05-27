# The Twelve-Factor App

Principles for building cloud-native services. Originally for Heroku PaaS, but applies to Kubernetes, ECS, Lambda, anything modern.

## TL;DR (read this first; load deep sections only when needed)

1. **Codebase** — one repo per service, many deploys. Same code → dev/staging/prod, config differs.
2. **Dependencies** — declare explicitly (lockfiles); isolate via Docker. No "install this on the server first" steps.
3. **Config** — in environment variables, validated at startup with a typed loader (Pydantic Settings, Zod, viper). `.env.example` checked in; secrets in a secrets manager.
4. **Backing services** — DB, cache, broker reached via URL. App doesn't care if local Docker or managed cloud.
5. **Build, release, run** — strictly separate. Build artifact + config = release. Releases tagged and immutable. Rollback = redeploy a previous release.
6. **Processes** — stateless. No local disk for state. Sessions in Redis/DB. Any process handles any request.
7. **Port binding** — app binds to `$PORT` and serves HTTP/gRPC itself. Not "we run inside nginx". Expose `/healthz` and `/readyz`.
8. **Concurrency** — scale by adding processes horizontally. Different process types (web/worker/cron) scale independently.
9. **Disposability** — fast startup, graceful shutdown on SIGTERM (drain → finish in-flight with deadline → close). Crash-safe at any moment.
10. **Dev/prod parity** — same backing services in dev as prod. Postgres in dev if Postgres in prod (testcontainers/Docker Compose).
11. **Logs** — to stdout/stderr as structured events. No log files in the app. JSON in prod, plain text in dev. Never log secrets/full PII.
12. **Admin processes** — migrations and one-off scripts as separate processes using same codebase + config. Not "log in and run SQL".

**Deep sections below** — read only when implementing a specific factor needs more detail.

---

## I. Codebase

> One codebase tracked in revision control, many deploys.

One codebase = one app. If two apps share code, they share it as a *library*, not by sharing a repo and deploying parts of it.

- **One repo per service** (unless the team has explicitly adopted a monorepo, in which case one *module/directory* per service).
- **The same codebase deploys to dev, staging, prod.** The only differences are config (factor III).

---

## II. Dependencies

> Explicitly declare and isolate dependencies.

Never rely on a tool or library being "available on the system". Declare it; install it from a manifest.

- **Lockfiles committed**: `uv.lock`, `go.sum`, `pnpm-lock.yaml`, `Cargo.lock`.
- **`Dockerfile` builds from a known base image**, installs declared dependencies, and produces a runnable artifact. No "install this on the server first" steps.
- **Build is reproducible**. Same commit + same lockfile = same image bytes (modulo timestamps).

---

## III. Config

> Store config in the environment.

Config = anything that varies between deploys. Database URLs, API keys, feature flag URLs, log levels.

- **Read from environment variables**, not config files committed to the repo.
- **Validate at startup** with a typed loader (Pydantic Settings, `viper`, Zod, `figment` for Rust). If config is invalid, fail fast — don't start the service.
- **`.env.example`** in the repo lists every required variable with a comment. The real `.env` is gitignored.
- **Secrets** come from a secrets manager (AWS Secrets Manager, Vault, GitHub Encrypted Secrets for CI). Never in `.env` files committed anywhere.

```python
# Good — Pydantic Settings, fails on startup if invalid
class Settings(BaseSettings):
    database_url: PostgresDsn
    redis_url: RedisDsn
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()  # raises if env is missing or invalid
```

---

## IV. Backing services

> Treat backing services as attached resources.

Database, cache, message broker, third-party APIs — all of them are resources reached via a URL. The app should not care whether the database is local Docker, RDS, or someone's laptop, as long as the URL works.

- **No code path "knows" the backing service is local vs. managed.** Different environments swap URLs; code is unchanged.
- **Switching providers** (e.g., RDS → CloudSQL) is a config change plus possibly an adapter swap — not a rewrite.

---

## V. Build, release, run

> Strictly separate the build and run stages.

- **Build**: source code + dependencies → image artifact (Docker image, jar, binary). Happens in CI on every push.
- **Release**: image + config for an environment → a deployable release. Tagged, immutable, identifiable. Often `image:sha + config-version`.
- **Run**: launch a release in an execution environment.

You should be able to *roll back* to a previous release without rebuilding. The release artifact is the unit of deploy and rollback.

---

## VI. Processes

> Execute the app as one or more stateless processes.

The process has no durable local state. Anything that must persist between requests goes to a backing service.

- **No writing to local disk** for anything that matters. Local disk is a scratch pad that vanishes when the container restarts.
- **No in-memory session state** that can't be reconstructed. Session data goes in Redis or a database. (Caches are fine — by definition they can be lost.)
- **A request handled by one process must be safely handle-able by another.** Load balancers route freely.

---

## VII. Port binding

> Export services via port binding.

The app provides itself as a service by binding to a port and listening for HTTP/gRPC. It does *not* assume it's running behind a particular web server or PaaS.

- **The app binds to the port specified by `$PORT`.** Defaults are fine for local dev.
- **No "we run inside nginx" coupling.** The app *is* the server.
- A health endpoint (`/healthz`) and readiness endpoint (`/readyz`) are exposed for orchestrators.

---

## VIII. Concurrency

> Scale out via the process model.

Add capacity by adding processes (horizontally), not by making one process bigger (vertically) beyond reason.

- **Each process is single-purpose**: web, worker, scheduler. Different process types scale independently.
- **No assumption about which process handles which request.** Stateless processes (factor VI) is what makes this possible.

```
web      → handle HTTP                (scale: 4 → 20)
worker   → consume jobs from queue    (scale: 2 → 50)
cron     → schedule periodic jobs     (scale: 1)
```

---

## IX. Disposability

> Maximize robustness with fast startup and graceful shutdown.

- **Fast startup**: a process should be ready to serve traffic in seconds, not minutes. Slow startup blocks scaling.
- **Graceful shutdown** on SIGTERM:
  1. Stop accepting new requests (deregister from load balancer).
  2. Finish in-flight requests with a deadline.
  3. Close connections cleanly.
- **Crash safety**: a process killed at any moment must not corrupt durable state. Use transactions; idempotent operations; durable queues.

```python
# Sketch — adjust per framework
async def lifespan(app: FastAPI):
    yield
    # On shutdown
    await stop_accepting_requests()
    await finish_in_flight(timeout=30)
    await close_connections()
```

---

## X. Dev/prod parity

> Keep development, staging, and production as similar as possible.

The bigger the gap, the more bugs that only appear in prod.

- **Time gap**: deploy often. Hours, not weeks.
- **Personnel gap**: the developer who wrote it is responsible for it in prod.
- **Tools gap**: same backing services in dev as in prod. Use Postgres in dev, not SQLite, if prod is Postgres. Run a local stack (Docker Compose or testcontainers).

---

## XI. Logs

> Treat logs as event streams.

The app writes logs to stdout/stderr as **structured events**. The runtime captures and routes them.

- **Stdout/stderr only.** No log files. No log rotation in the app.
- **JSON output** in production. Plain text in dev for readability.
- **One event = one line.** Trace IDs, request IDs, user IDs (hashed if PII-sensitive) on every line.
- **Don't log secrets.** Don't log full PII. Redact at the logger.

```python
log.info("transfer.submitted",
         transfer_id=t.id, account_id_hash=hash_id(t.account_id),
         amount_cents=t.amount.cents, currency=t.amount.currency,
         trace_id=ctx.trace_id)
```

---

## XII. Admin processes

> Run admin/management tasks as one-off processes.

Database migrations, one-off scripts, REPLs — run them as separate processes using the same codebase and config as the running app.

- **Migrations** are scripts in the repo, run by CI on deploy or by an explicit command. Not "log into the database and run SQL".
- **Backfills, data fixes** — checked into the repo, code-reviewed, idempotent where possible.
- **The script's environment is the app's environment.** Same dependencies, same config.

---

## How agents apply 12-Factor

### DevOps agent

- New service onboarding: walk the 12-factor list as a checklist before the first deploy.
- Reject Dockerfiles that bake config in or write to local disk for state.
- Verify graceful shutdown by killing the container during load tests; in-flight requests should complete or be retried, not 502.

### Developer agent

- New env var? Add to `.env.example` with a comment. Validate at startup.
- Tempted to write a file for state? Stop and use a backing service.
- Tempted to read config from a file? Use env vars; let the deploy mount the file as config if needed.

### Architect agent

- In design docs, call out which backing services the app needs and how they're treated (factor IV).
- For services that *must* be stateful (databases, queues), they are *backing services*, not the app — the app remains stateless.
