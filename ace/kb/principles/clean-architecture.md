# Clean Architecture

Organize code so business logic doesn't depend on infrastructure. Variants: Hexagonal (Ports & Adapters), Onion — same idea, different vocabulary.

## TL;DR (read this first; load deep sections only when needed)

**The layers** (outermost to innermost):
1. **Frameworks & Drivers** — HTTP server, ORM, message broker. Off-the-shelf.
2. **Adapters** — HTTP handlers, repositories, gateway clients. Translate between external and internal vocabulary.
3. **Application** — use cases / interactors. One per user-visible action. Where transactions and authz live.
4. **Domain** — entities, value objects, domain services, events. Pure. No I/O.

**The dependency rule**: source code dependencies point *inward only*. Domain knows nothing about application. Application knows nothing about adapters. Adapters know nothing about frameworks. This is the entire architecture in one sentence.

**The payoff**: domain unit-testable without a database. Swap infrastructure without rewriting business code. Layers tell you where to find things.

**Common mistakes to avoid**:
- **Anemic domain** — all logic in services, entities are dumb data. Fix: behavior on the entity that owns the state.
- **Leaky abstractions** — repositories returning ORM rows. Fix: repositories return aggregates, conversion in adapter.
- **Use cases knowing HTTP** — taking `Request`, returning `JsonResponse`. Fix: plain command/result objects, HTTP adapter translates.
- **Over-architecting** — 200-line CRUD doesn't need four layers. Start simple; promote to layers when they earn their keep.

**Deep sections below** — read only when a layering decision is genuinely hard.

---

## The Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Frameworks & Drivers       (HTTP server, ORM, message bus) │
├─────────────────────────────────────────────────────────────┤
│  Adapters                   (HTTP handlers, repositories,   │
│                              gateway clients)                │
├─────────────────────────────────────────────────────────────┤
│  Application                (use cases, orchestration)       │
├─────────────────────────────────────────────────────────────┤
│  Domain                     (entities, value objects,        │
│                              domain services, events)        │
└─────────────────────────────────────────────────────────────┘
```

### The dependency rule

**Source code dependencies point inward only.** The domain knows nothing about the application layer. The application knows nothing about adapters. Adapters know nothing about frameworks.

This is the entire architecture in one sentence. Every other rule below is a consequence.

---

## What goes in each layer

### Domain (innermost)

- **Entities** — types with identity, defined entirely by business rules.
- **Value objects** — immutable types with invariants (`Money`, `EmailAddress`, `AccountId`).
- **Domain services** — stateless behaviors that span multiple entities.
- **Domain events** — facts published when state changes.
- **Repository *interfaces*** — the domain says *what* persistence it needs, not *how*.

What's **not** here:
- HTTP, JSON, ORM annotations, framework decorators, environment variables, logging libraries, clock, RNG.

The domain is pure. Given inputs, produces outputs. No I/O. Highly testable.

### Application

- **Use cases / interactors** — one class per user-visible action ("submit transfer", "cancel order"). Orchestrates domain objects.
- **Input/output port interfaces** — what the use case needs from the outside world (`AccountRepository`, `NotificationSender`), and what it returns.
- **Application services** — broader coordinators when the use case is multi-step.

Use cases are where *transactions* often start and end. They are where *authorization* checks belong. They are the API of your service from the inside.

```python
class SubmitTransferUseCase:
    def __init__(
        self,
        accounts: AccountRepository,
        gateway: PaymentGateway,
        events: DomainEventPublisher,
        clock: Clock,
    ):
        self.accounts = accounts
        self.gateway = gateway
        self.events = events
        self.clock = clock

    async def execute(self, cmd: SubmitTransferCommand) -> TransferId:
        source = await self.accounts.get(cmd.from_account)
        if source is None:
            raise AccountNotFound(cmd.from_account)
        transfer = source.initiate_transfer(cmd.to_account, cmd.amount, self.clock.now())
        await self.gateway.submit(transfer)
        await self.accounts.save(source)
        await self.events.publish(TransferSubmitted.from_(transfer))
        return transfer.id
```

### Adapters

- **Inbound adapters** — translate external requests into use case calls. HTTP handlers, queue consumers, CLI commands, scheduled job entrypoints.
- **Outbound adapters** — implement the port interfaces the use case depends on. Postgres repository, HTTP client to a payment gateway, SQS publisher.

Adapters are the only layer that imports framework or library types. They convert between the external world's vocabulary (HTTP requests, SQL rows, JSON payloads) and the domain/application vocabulary.

```python
# adapter/http/transfers.py
@router.post("/transfers")
async def submit(req: SubmitTransferRequestModel, use_case: SubmitTransferUseCase = Depends(...)):
    cmd = SubmitTransferCommand(
        from_account=AccountId(req.from_account_id),
        to_account=AccountId(req.to_account_id),
        amount=Money(req.amount_cents, req.currency),
    )
    transfer_id = await use_case.execute(cmd)
    return SubmitTransferResponseModel(transfer_id=str(transfer_id))
```

### Frameworks & Drivers (outermost)

The HTTP server, ORM, message broker client, etc. These are off-the-shelf libraries. You depend on them; they don't depend on you.

`main` (or the equivalent in your language) lives here. It wires everything: reads config, constructs adapters, injects them into use cases, starts the server.

---

## Why the dependency rule matters

### Testability

The domain has no I/O, so unit tests run in milliseconds with no fixtures. Use cases test against in-memory fakes of the repositories — fast and deterministic.

```python
async def test_submit_transfer_publishes_event():
    accounts = InMemoryAccountRepository(seeded=[
        Account(id=AccountId("a"), balance=Money(10_000, "USD")),
        Account(id=AccountId("b"), balance=Money(0, "USD")),
    ])
    gateway = FakePaymentGateway()
    events = CapturingEventPublisher()
    use_case = SubmitTransferUseCase(accounts, gateway, events, FixedClock("2026-04-15T12:00:00Z"))

    await use_case.execute(SubmitTransferCommand(AccountId("a"), AccountId("b"), Money(1_000, "USD")))

    assert events.published == [TransferSubmitted(...)]
```

No database, no HTTP, no clock — and yet a complete behavior test.

### Replaceability

Swap Postgres for DynamoDB? Write a new outbound adapter. The use case doesn't change. Swap REST for gRPC? Write a new inbound adapter. The use case doesn't change.

This isn't theoretical — it's how you migrate between vendors, run multiple deployment shapes (HTTP service, batch job, Lambda), and keep tests isolated.

### Comprehension

When you trace a feature from request to response, the layers tell you what to expect at each step. New engineers can find things.

---

## Common mistakes

### Anemic domain

The domain becomes plain data containers; all the logic lives in "services" in the application layer. The architecture is layered, but the *value* of putting logic in the domain is lost.

**Fix**: behavior goes on the entity that owns the state it operates on. `Account.transfer_to(other, amount)`, not `TransferService.do_transfer(account, other, amount)`.

### Leaky abstractions

The repository interface returns ORM rows or a framework's `QuerySet`. Now the domain depends on the ORM through the interface.

**Fix**: repositories return *aggregates*, full stop. Conversion happens inside the adapter.

### Use cases that know about HTTP

A use case takes a `Request` object or returns a `JsonResponse`. Now the application layer depends on the web framework.

**Fix**: use cases take and return plain command/result objects. The HTTP adapter translates.

### Over-architecting small services

A 200-line CRUD service does not need four layers. Clean Architecture pays off when the domain logic justifies it.

**Fix**: start simple. Promote to layers when a layer would actually pull its weight. Tracking debt as "this is currently flat, will split when domain grows" is fine.

### Dependency injection by ceremony

If your DI container takes more code to configure than it saves, drop it. In Python, Go, and TS, constructor injection by hand at `main()` is usually plenty.

---

## How agents apply Clean Architecture

### Architect agent

- In design docs, label each component by its layer.
- Reject designs where the dependency rule is violated (domain importing framework, etc.) — or accept with an explicit "we are intentionally flat here, will split when X" note.
- Define repository interfaces in the domain; implementations live in adapters.

### Developer agent

- Before writing new code, check which layer it belongs in. New behavior on an entity? Domain. New orchestration of two entities? Application. New external integration? Adapter.
- Test the domain in isolation. If a domain test needs a database, the layering is wrong.
- When tempted to import a framework type into the domain, stop and propose a port instead.

### Reviewer

- Watch for `import` lines that cross layers the wrong way.
- Watch for use cases that take HTTP/queue/CLI-specific arguments.
- Watch for adapters that contain business logic — they should be translators, not deciders.
