# API Design

Principles for HTTP/REST, gRPC, or async (events) APIs. Team default: HTTP+JSON with OpenAPI for sync, versioned event schemas for async.

## TL;DR (read this first; load deep sections only when needed)

- **Design from the consumer's perspective.** Endpoints model operations and resources, not internal tables. If the caller wants "transfer money", that's one endpoint, not three.
- **Be predictable**: same patterns across the API, same status codes for same situations, same field names for same concepts.
- **Be evolvable**: assume you'll add fields, change shapes, add operations without breaking existing callers.
- **HTTP methods**: GET (safe, idempotent), POST (create/invoke), PUT (full replace, idempotent), PATCH (modify), DELETE (idempotent). Idempotent = calling twice = calling once.
- **Status codes** from the small set: 200/201/202/204 success · 400 malformed · 401 unauth · 403 forbidden · 404 missing · 409 conflict · 422 validation · 429 rate-limited · 5xx server. **Never** 200 with `"error": ...` in body.
- **Error shape** — one shape everywhere. RFC 7807 (`application/problem+json`) is a fine default: `type`, `title`, `status`, `detail`, `code` (machine-readable, stable), `trace_id`.
- **Versioning** — pick one strategy (URL `/v1/...` or `Accept` header). Breaking change = new version. Additive change = same version.
- **Pagination** — cursor-based from day one. Avoid offset/page-number.
- **Idempotency keys** — every POST that creates state takes `Idempotency-Key` header. Server dedupes on `(caller, key)` for 24h. Critical for retry safety; include in v1.
- **Rate limit** — document, return 429 with `Retry-After`, include rate-limit headers on every response.
- **Auth** — OAuth/OIDC for users, API keys via `Authorization: Bearer`, mTLS for service-to-service. No homegrown schemes.
- **For async events** — schema is the contract, use schema registry, events are past-tense and immutable, at-least-once delivery = consumers must be idempotent.

**Deep sections below** — read only when designing a specific endpoint/contract needs more detail.

---

## Core principles

### Design from the consumer's perspective

The first question is not "what data do we have to expose?" but "what does the caller want to *do*?" Endpoints model **operations and resources**, not internal tables.

If a caller's natural ask is "transfer money from A to B", that's one operation. It should not require them to chain three calls and reconcile partial failures.

### Be predictable

Same patterns across the API. Same status codes for the same situations. Same field names for the same concepts. Consistency lets callers learn one endpoint and predict the others.

### Be evolvable

APIs are forever. Design assuming you'll need to add fields, change shapes, and add operations *without breaking existing callers*. The cost of getting v1 wrong is paid by every client team for years.

### Be honest about errors

Every operation can fail. The error model is part of the API; design it deliberately, not as an afterthought.

---

## HTTP/REST specifics

### Resources and URLs

- **Nouns for resources**: `/accounts/{id}`, `/transfers/{id}`.
- **Verbs are HTTP methods**, not URL segments: `POST /transfers`, not `POST /createTransfer`.
- **Plural collections**, singular item paths derived: `/accounts` returns a list; `/accounts/{id}` returns one.
- **Nested only when ownership is real**: `/accounts/{id}/transfers` lists transfers *for that account*. Don't nest more than two levels deep.
- **Actions that don't fit CRUD** are sub-resources with a verb-y name: `POST /transfers/{id}/cancel`. Use sparingly.

### HTTP methods and idempotency

| Method | Use | Idempotent? | Safe? |
|---|---|---|---|
| GET    | Read a resource | Yes | Yes |
| POST   | Create or invoke an action | No (usually) | No |
| PUT    | Replace a resource fully | Yes | No |
| PATCH  | Modify part of a resource | No (by default) | No |
| DELETE | Remove a resource | Yes | No |

"Idempotent" means **calling twice has the same effect as calling once**. For POST that creates resources, idempotency is *not free* — see "Idempotency keys" below.

### Status codes

Pick from the small set everyone knows:

| Code | Use |
|---|---|
| 200 | Success, body returned |
| 201 | Created. `Location` header points at the new resource |
| 202 | Accepted for async processing; body describes how to poll |
| 204 | Success, no body |
| 400 | Malformed request — caller error, fix the request |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource doesn't exist (or caller can't see it) |
| 409 | Conflict — current state precludes the request |
| 422 | Validation failed (request was well-formed but semantically wrong) |
| 429 | Rate limited |
| 500 | Server bug |
| 502/503/504 | Upstream / overload / timeout |

Don't invent new codes. Don't return 200 with `"error": ...` in the body.

### Error response shape

One shape, used everywhere. RFC 7807 (`application/problem+json`) is a fine default:

```json
{
  "type": "https://errors.example.com/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Account a_123 has balance 5000, transfer requires 10000",
  "instance": "/transfers",
  "code": "INSUFFICIENT_FUNDS",
  "trace_id": "01HE..."
}
```

- **`code`**: machine-readable. Callers switch on this. Stable forever.
- **`title`**: human-readable summary. May be edited (it's not part of the contract).
- **`detail`**: specifics for debugging. Never includes secrets, never includes stack traces.
- **`trace_id`**: lets the caller correlate with your logs when they report a problem.

### Versioning

Pick **one** strategy and stick to it:

- **URL versioning**: `/v1/transfers`, `/v2/transfers`. Easy to route; ugly for clients to migrate.
- **Header versioning**: `Accept: application/vnd.acme.v2+json`. Cleaner but harder to discover.

Whichever you pick, the rule is: **breaking changes require a new version**. Additive changes (new optional fields, new endpoints) don't.

Run versions in parallel for at least a documented sunset window. Communicate deprecation in `Sunset` and `Deprecation` headers.

### Pagination

For any collection that can grow, paginate from day one. **Cursor-based** is the default:

```
GET /transfers?limit=50&cursor=eyJ...

200 OK
{
  "data": [ ... ],
  "next_cursor": "eyJ...",     // null when no more
  "has_more": true
}
```

Avoid offset/page-number pagination — it breaks when data changes between requests and gets slower as pages grow.

### Filtering, sorting, field selection

- **Filtering**: `?status=pending&account_id=a_1`. Repeated keys for OR (`?status=pending&status=succeeded`), or explicit operators (`?amount_cents__gte=1000`).
- **Sorting**: `?sort=-created_at` (`-` prefix for descending).
- **Field selection / sparse fieldsets**: `?fields=id,status,amount_cents`. Optional, but valuable for big resources.

### Idempotency keys (for POST that creates resources)

A client retries a `POST` after a network error. Without idempotency, they may double-create.

- **Client generates a UUID per logical operation** and sends it as `Idempotency-Key` header.
- **Server dedupes** on `(authenticated_caller, idempotency_key)` for a documented window (24h is common).
- **First request stores the response**; subsequent requests with the same key return the stored response, even if the in-flight request hasn't finished.

This is the single most important reliability primitive for any API that creates state. Include it in v1.

### Rate limiting

- **Document the limit**. Per-key, per-IP, per-account.
- **Return 429** with `Retry-After` header.
- **Include rate-limit headers on every response** so well-behaved clients can self-regulate:
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Authentication

- **OAuth 2 / OIDC** for user-context calls.
- **API keys** for server-to-server, sent as `Authorization: Bearer <key>` — never as a query param (leaks to logs).
- **mTLS** when both sides are services you control and you want strong identity.
- **No homegrown auth schemes.**

### CORS

- Be explicit about allowed origins. `Access-Control-Allow-Origin: *` is rarely appropriate for an authenticated API.
- Pre-flight (`OPTIONS`) handled correctly — cached aggressively via `Access-Control-Max-Age`.

---

## gRPC specifics

When using gRPC instead of HTTP+JSON:

- **`.proto` files in the repo** are the canonical contract. Generated code is generated, not committed (or committed with a check that it's up to date).
- **Field numbers are immutable.** Once assigned, never reused. Removed fields get `reserved`.
- **Optional vs. required**: in proto3, all fields are optional by default. Document which are semantically required.
- **Streaming**: server-streaming, client-streaming, bidi-streaming. Each adds complexity; use only when the use case demands it.

---

## Async / event APIs

When the API is "publish an event to a broker":

- **Schema is the contract.** Use Avro, Protobuf, or JSON Schema with a schema registry. Don't ship "trust me, the docs say what's in it".
- **Events are versioned.** Same rules as HTTP: additive changes okay, breaking changes need a new version.
- **Past tense, immutable.** `TransferSubmitted`, not `SubmitTransfer`. (See `domain-driven-design.md`.)
- **Include enough context** so consumers don't have to look up data via a separate API for every event.
- **At-least-once delivery is the norm.** Consumers must be idempotent.

---

## OpenAPI (HTTP spec)

- **OpenAPI 3.1** spec checked into the repo: `api/openapi.yaml` (or generated from code annotations).
- **CI validates the spec** on every PR.
- **Linted** with `spectral` or similar — catches inconsistencies, missing descriptions, undocumented errors.
- **Server stub or client SDK** generated from the spec; the spec is upstream.
- **Examples on every response** — they make the docs usable.

---

## How agents apply API design

### Architect agent

- Reviews API designs for consistency with existing endpoints in the same service or product family.
- Requires versioning strategy decided before merge (and documented in an ADR for the first API in a service).
- Watches for `POST` operations that create resources without idempotency keys — usually requests a change.
- Watches for endpoint shapes that smell like "RPC over HTTP" (`/doThing`, mixed verbs) — usually proposes resource-oriented redesign.

### Developer agent

- Reads the existing OpenAPI spec before adding/changing endpoints.
- Updates the spec in the same PR as the implementation, never separately.
- Validates inputs at the boundary using a schema validator (Pydantic, Zod, etc.) — never trusts client input.

### Reviewer

- Verifies error responses follow the team's error shape.
- Verifies status codes are appropriate (no 200-with-error-in-body).
- Verifies new endpoints have examples in the OpenAPI spec.
