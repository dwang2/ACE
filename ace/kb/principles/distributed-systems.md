# Distributed Systems Principles

Anything crossing a process boundary is distributed, even on the same host. The network *will* fail. Time *will not* be consistent. Concurrency *will* surprise you.

## TL;DR (read this first; load deep sections only when needed)

- **Fallacies are still true**: network isn't reliable, latency isn't zero, topology changes, transport isn't free. Every design says what happens when each fails.
- **Failures are partial**. A call can succeed, fail to send, send-but-lose-response, or time out. The interesting case is "you don't know if it happened" — solved by idempotency.
- **Idempotency** — calling twice = calling once. The single most important property. Patterns: naturally idempotent ops (SET not INCREMENT), idempotency keys with stored response, optimistic concurrency control, conditional writes.
- **Retries** — only retry transient failures (timeouts, connection errors, 5xx, 429). Exponential backoff with jitter. Cap retries (3–5). Respect `Retry-After`. Don't retry at every layer.
- **Timeouts** — every external call has one. Cascade inward (5s budget → each of 3 calls gets less). Propagate cancellation through context/signal.
- **Circuit breakers** — when upstream is failing, open the circuit, fail fast, save the upstream for recovery. Closed → Open (cooldown) → Half-Open (probe) → Closed.
- **Bulkheads & backpressure** — separate pools per upstream. Bounded queues. Push slowness back to caller (429), don't buffer until OOM.
- **Consistency** — strong within an aggregate, eventual across aggregates and services. CAP: when network partitions, choose consistency or availability — you don't get to dodge.
- **Sagas, not 2PC**, for multi-service operations. Each step is a local transaction; failures handled by compensation.
- **Messaging** — at-least-once is the norm. Consumers must be idempotent. Ordering only within a partition. **Outbox pattern** for atomic state change + event publish.
- **Time** — wall-clock drifts; use monotonic time for durations within a process, logical clocks for cross-system ordering. Persist UTC, display local.
- **Observability** — structured logs with trace IDs, RED metrics (rate/errors/duration) for services, USE for resources, OpenTelemetry traces propagated across every boundary.

**Deep sections below** — read only when designing a specific cross-network interaction.

---

## The Fallacies (still true, after all these years)

The "Fallacies of Distributed Computing" — assumptions that are wrong but easy to make:

1. The network is reliable.
2. Latency is zero.
3. Bandwidth is infinite.
4. The network is secure.
5. Topology doesn't change.
6. There is one administrator.
7. Transport cost is zero.
8. The network is homogeneous.

Every one of these is false. Every design must answer how it survives the failure of each.

---

## Failure modes

### Failures are partial

A service call can:
- Succeed cleanly.
- Fail to send (the receiver never got the request).
- Send, but the response was lost (the request happened, you just don't know).
- Time out (you have no idea whether it happened).

**The interesting failure mode is #4.** Your code must work correctly whether the operation happened or not. That's what idempotency buys you.

### Crash anywhere

Any process can crash between any two instructions. Database writes, file writes, message sends — all of them can be interrupted halfway. Design accordingly:

- **Atomic operations** (one DB transaction, one durable write) succeed or fail as a unit.
- **Multi-step operations** must either be reversible (sagas, compensation) or idempotently resumable.
- **No "write to two systems" without a plan for what happens when one fails.**

---

## Idempotency

> Performing the operation twice has the same effect as performing it once.

The single most important property in a distributed system. Without it, retries are dangerous; with it, retries are routine.

### Patterns to make operations idempotent

1. **Naturally idempotent operations**: `SET x = 5` is idempotent; `INCREMENT x` is not.
2. **Idempotency keys**: caller provides a unique key; server stores `(key, result)`. Repeated calls with the same key return the stored result.
   - Window: 24h is a common default. Document yours.
   - Storage: Redis for fast dedup; durable table for audit.
3. **Optimistic concurrency control**: include an `ETag` or version; the operation fails if the version moved.
4. **Conditional writes**: `INSERT ... ON CONFLICT DO NOTHING`, `IF NOT EXISTS`, DynamoDB conditional expressions.

### When the response is lost

If your server processed the request but the response didn't reach the client, the client retries. With idempotency:

- Server sees the same idempotency key → returns the stored response.
- Client sees the response → moves on.

Without idempotency: the client gets a duplicate side-effect (or two transfers, or two charges).

---

## Retries

> Retries plus idempotency are how you survive transient failures.

Rules:

1. **Retry transient failures only**: timeouts, connection errors, 5xx server errors, 429 rate limits. Do not retry 4xx client errors (except 408, 425, 429, 449) — they won't get better.
2. **Use exponential backoff with jitter**: not constant intervals (thundering herd), not pure exponential (synchronized retry storms).
   ```
   delay = min(cap, base * 2^attempt) * random(0.5, 1.5)
   ```
3. **Cap total retries**: 3 to 5 is typical. Beyond that, you're not retrying — you're DoS-ing the upstream.
4. **Respect `Retry-After`** headers from 429/503 responses.
5. **Distinguish at-least-once from exactly-once delivery semantics.** Network protocols generally give you at-least-once; "exactly-once" is achieved by the consumer being idempotent.
6. **Don't retry at every layer.** If the client retries, the gateway retries, and the service retries, one timeout becomes 27 attempts. Pick one layer.

---

## Timeouts

> Every external call has a timeout.

A call with no timeout is a resource leak waiting to happen. One slow upstream → all your goroutines/connections/threads parked → your service is down.

- **Set timeouts deliberately.** Read latency SLOs for the upstream; set the timeout above p99 + headroom.
- **Cascade timeouts inward.** If the user request has a 5s budget and you make 3 sequential calls, each gets less than 5s — not 5s each.
- **Propagate cancellation.** Pass `context.Context` (Go), `AbortSignal` (TS), `CancellationToken` (Python via `asyncio`) through. When the caller gives up, the work stops.

---

## Circuit breakers

When an upstream is failing, calling it harder doesn't help. Open the circuit, fail fast, save the upstream for recovery.

State machine:

- **Closed** (normal): requests flow. Track error rate over a sliding window.
- **Open** (tripped): error rate breached threshold. New requests fail immediately for a cooldown period. No load goes to the failing upstream.
- **Half-open** (probing): cooldown elapsed. Let a small number of requests through. If they succeed, close the circuit. If they fail, open again.

Common pitfall: per-instance circuit breakers in a fleet make decisions on too little data. Consider per-pool breakers or central rate signals.

---

## Bulkheads and backpressure

A failure in one part of the system should not consume resources from the rest.

- **Bulkheads**: separate thread pools, connection pools, or queues per upstream. The slow-upstream's queue fills up; the rest of the system keeps working.
- **Backpressure**: when downstream is slower than upstream, push the slowness back to the caller (queue length triggers 429s) rather than buffering unboundedly until you OOM.
- **Bounded queues, always.** Unbounded queues are how memory leaks happen.

---

## Consistency

### Strong vs. eventual

- **Strong consistency**: after a write, all subsequent reads see it. Achievable within one database; expensive across systems.
- **Eventual consistency**: after a write, reads will *eventually* see it. Cheaper, scales better, and is the only option for cross-region or cross-system propagation.

Most distributed systems mix both: strongly consistent within an aggregate, eventually consistent across aggregates and services.

### CAP, in one sentence

When the network partitions, a system must choose between consistency (refuse writes that can't be coordinated) and availability (accept writes that may conflict). You don't get to dodge this.

### Read-your-writes

A common useful guarantee: a client's own writes are immediately visible to its own subsequent reads, even if global eventual consistency takes longer. Often implemented with sticky routing or version tokens.

---

## Distributed transactions and sagas

Two-phase commit across services is a trap — high coordination cost, lockup on partial failures, vendor-specific support.

The pragmatic alternative is the **saga pattern**:

- Decompose a multi-service operation into a sequence of local transactions.
- Each step publishes an event that triggers the next step.
- Failures are handled by **compensation**: emit a reverse event to undo earlier steps.

```
1. Reserve inventory  (success)
2. Charge payment     (success)
3. Ship order         (FAILS)
4. Refund payment     (compensation)
5. Release inventory  (compensation)
```

Sagas are eventually consistent. Design the UI and downstream consumers to tolerate intermediate states ("Pending", "Cancelled-while-charging") — they will be visible.

---

## Messaging

### At-least-once is the norm

Most brokers (Kafka, SQS, RabbitMQ in default modes) deliver at-least-once. **Consumers must be idempotent.** This is not optional.

### Ordering

- **Within a partition / single consumer**: order is preserved.
- **Across partitions**: no order guarantees.
- **Across topics**: no order guarantees.

Design partition keys so that **events that must be ordered share a key**. Account-scoped events all key on account ID; ordering within an account is preserved.

### Outbox pattern

> Atomic state change *and* event publish.

You can't atomically write to a database and publish to a broker — they're different systems. The outbox pattern fixes it:

1. In the same DB transaction that changes state, insert a row into an `outbox` table.
2. A separate process reads `outbox` and publishes to the broker, marking rows as sent.
3. If the publisher crashes, it retries on restart. At-least-once delivery; consumer dedups.

Avoid dual writes (write to DB then publish) — they will lose events on crash.

---

## Time

### Clocks are not consistent

- **Wall-clock time** (`now()`) drifts between hosts. Don't use wall-clock time for ordering events across systems.
- **NTP keeps clocks within ~milliseconds**, usually. Sometimes worse. Plan for skew.
- **For ordering across machines**, use logical clocks (Lamport, vector clocks) or causal references (e.g., "Event B happened in response to Event A, ID = ...").
- **For durations and timeouts within a single process**, use monotonic time, not wall-clock.

### Time zones

Persist UTC. Display in user-local time. Never the other way around.

---

## Observability

Distributed systems are debuggable only if you can see across them. Three pillars:

- **Logs** — structured, with trace IDs, sampled appropriately.
- **Metrics** — RED (Rate, Errors, Duration) for request-driven services; USE (Utilization, Saturation, Errors) for resources. Aggregate, low-cardinality dimensions.
- **Traces** — OpenTelemetry spans from the entry point through every downstream call. Propagate `traceparent` everywhere.

**Correlation IDs propagate across every boundary.** If a request crosses 5 services, all 5 services' logs reference the same trace ID. Without this, debugging incidents is archeology.

---

## How agents apply these principles

### Architect agent

- For every new service-to-service call, the design doc says: *timeout, retry policy, idempotency story, circuit breaker, failure mode*.
- For every new async event, the design doc says: *partition key, ordering requirement, idempotency story, schema version*.
- The threat model includes a failure-mode analysis. "Database is unreachable for 5 minutes — what happens?"

### Developer agent

- Every outbound HTTP/gRPC/queue call has a timeout. No defaults from the library; pick deliberately.
- Every consumer (HTTP handler that creates state, queue worker) is idempotent or explicitly documents why it doesn't need to be.
- No dual writes to DB + broker without the outbox pattern.
- No wall-clock time for cross-system ordering.

### DevOps agent

- SLOs defined with explicit error budgets.
- Alerts are symptom-based (users hit errors) not cause-based (CPU is high).
- Dashboards show the RED metrics for every service edge.
- Trace propagation tested — synthetic traces show end-to-end.
