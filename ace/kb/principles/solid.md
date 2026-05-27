# SOLID

Five OO design principles. Guidelines, not laws. Each names a real problem; over-applied they produce over-abstracted code.

## TL;DR (read this first; load deep sections only when needed)

- **S — Single Responsibility**: a module should have one *reason to change* (one stakeholder, one axis of change). Smell: `and` in the name, classes edited for unrelated reasons. Don't conflate with line count.
- **O — Open/Closed**: add behavior without editing tested code, via polymorphism (strategies, interfaces). Smell: `if type == X` chains that grow with every new case.
- **L — Liskov Substitution**: subtypes must honor their parent's contract (accept ≥ parent's preconditions, promise ≥ parent's postconditions). Smell: subclasses overriding to `NotImplementedError`, `isinstance` checks before calling methods.
- **I — Interface Segregation**: small client-specific interfaces over fat ones. In Go this is idiomatic; in Python/TS use `Protocol`/narrow types. Smell: implementations stubbing methods they don't use.
- **D — Dependency Inversion**: high-level modules depend on abstractions defined in *their own* layer; low-level modules implement those abstractions. Smell: domain code importing the database driver. Apply at boundaries that cross deployment units or that you want to test without the real thing.

**When to apply SOLID**: when fixing a problem (change cost, test cost, comprehension cost). Don't impose on green-field code as a checklist.

**Deep sections below** — read only when a specific principle needs more nuance.

---

## S — Single Responsibility Principle

> A module should have one reason to change.

The classic formulation ("one thing") is misleading. The better framing: **a module should serve one stakeholder, one axis of change.**

If the billing team and the reporting team both edit `OrderProcessor` for different reasons, it has two responsibilities. Split it.

### Smells

- A class with `and` in its name (`UserAuthAndProfile`).
- A file over ~500 lines with no obvious internal seams.
- A change request that requires editing a class for reasons unrelated to its name.
- Functions that mix levels of abstraction (parsing HTTP + computing tax + writing to DB in one method).

### Applied

```python
# Bad — one class, three reasons to change
class OrderService:
    def place_order(self, ...): ...        # business rules
    def render_email_receipt(self, ...): ... # presentation
    def export_for_finance(self, ...): ...   # reporting
```

```python
# Good — each responsibility in its own module
class OrderPlacement:  ...   # business rules
class ReceiptRenderer: ...   # presentation
class FinanceExporter: ...   # reporting
```

### Don't overdo it

A 30-line class doing two closely related things is fine. SRP is about *reasons to change*, not line count.

---

## O — Open/Closed Principle

> Modules should be open for extension, closed for modification.

You should be able to add new behavior without editing existing, tested code. This is achieved through **polymorphism** (interfaces, strategies, plugins) — not by predicting every future need with configuration.

### Smells

- `if type == "X": ... elif type == "Y": ...` chains that grow every time a new case is added.
- Editing the same file for every new feature in a family.
- Boolean flags accumulating on a method signature.

### Applied

```typescript
// Bad — every new payment method touches this switch
function process(p: Payment): Result {
  switch (p.type) {
    case "card":   return processCard(p);
    case "ach":    return processAch(p);
    case "wire":   return processWire(p);
    // case "crypto": ...  -- requires editing this file
  }
}
```

```typescript
// Good — strategy interface; new methods are new files
interface PaymentMethod {
  process(p: Payment): Result;
}

class CardPayment implements PaymentMethod { ... }
class AchPayment  implements PaymentMethod { ... }
// CryptoPayment is a new file; existing code unchanged
```

### Don't overdo it

If there will only ever be two cases, a switch is fine. OCP is for axes of variation that are *real* — open the file when adding case 3 only if case 4 is plausible.

---

## L — Liskov Substitution Principle

> Subtypes must be substitutable for their base types.

If `Square extends Rectangle` overrides `setWidth` to also set height, anyone holding a `Rectangle` reference and calling `setWidth(5); setHeight(10)` expecting `width=5, height=10` will be wrong. The subtype broke the supertype's contract.

### Smells

- Subclasses that override methods to throw `NotImplementedError`.
- Subclasses that strengthen preconditions ("the base accepts any string; I only accept non-empty").
- Subclasses that weaken postconditions ("the base guarantees returns ≥ 0; I might return -1").
- Tests that check "is the object an instance of X?" before calling a method.

### Applied — preconditions, postconditions, invariants

A subtype:
- Accepts **at least as much** as the base accepts (cannot strengthen preconditions).
- Promises **at least as much** as the base promises (cannot weaken postconditions).
- Maintains all the base's invariants.

### Don't overdo it

LSP is really a statement about contracts. If your "subclass" violates the parent's contract, it isn't really a subclass — model the relationship differently (composition, separate types, sum types).

---

## I — Interface Segregation Principle

> Clients should not be forced to depend on methods they do not use.

A fat interface couples its clients to every method, even the ones they ignore. Splitting interfaces by client need reduces coupling.

### Smells

- An interface with 20 methods where each implementer uses only 3.
- Mocks/fakes that have to stub a dozen methods to test one path.
- Changes to one method causing recompiles in clients that don't call it.

### Applied

```go
// Bad — readers forced to depend on Write/Delete
type AccountStore interface {
    Get(id string) (*Account, error)
    Save(*Account) error
    Delete(id string) error
    Audit(id string) ([]Event, error)
}

// Good — clients depend only on what they need
type AccountReader interface {
    Get(ctx context.Context, id string) (*Account, error)
}
type AccountWriter interface {
    Save(ctx context.Context, a *Account) error
}
```

In Go, this is idiomatic — interfaces defined on the consumer side are naturally segregated.

### Don't overdo it

A few related methods on one interface is fine. ISP is for interfaces that have *clearly* separable client groups.

---

## D — Dependency Inversion Principle

> Depend on abstractions, not on concretions. High-level modules should not depend on low-level modules.

The business logic should not import the database driver. The database driver implements an interface that the business logic defines.

### Smells

- `import` chain that goes from your domain logic out to specific infrastructure (Postgres, Redis, AWS).
- Unit tests for business logic that require spinning up a database.
- Inability to swap a dependency (e.g., from Postgres to MySQL) without editing domain code.

### Applied

```
domain/      ──defines──▶  AccountRepository (interface)
adapters/    ──implements──▶ PostgresAccountRepository
```

The arrow direction is what "inverted" means. Without DIP, the arrow goes from domain → adapters; with DIP, both arrows point at the abstraction in the middle.

```python
# domain/repositories.py — defines the interface
class AccountRepository(Protocol):
    async def get(self, account_id: str) -> Account | None: ...
    async def save(self, account: Account) -> None: ...

# domain/services.py — uses the interface
class AccountService:
    def __init__(self, repo: AccountRepository):
        self.repo = repo
    async def transfer(self, ...): ...

# adapters/postgres.py — implements the interface
class PostgresAccountRepository:
    async def get(self, account_id: str) -> Account | None: ...
    async def save(self, account: Account) -> None: ...

# main.py — wires it up
service = AccountService(repo=PostgresAccountRepository(pool))
```

### Don't overdo it

DIP for *every* dependency creates noise. Apply it at boundaries that:
- Cross a deployment unit (DB, queue, external API), or
- You expect to change (different storage in tests vs. prod), or
- You want to test without the real thing.

A pure function calling a pure function does not need DIP between them.

---

## How agents apply SOLID in review

When the architect or developer agent reviews a PR:

1. **Read the diff first; don't preach SOLID at green-field code.** SOLID is a tool for explaining problems, not a checklist to impose.
2. **Name the principle when a violation matters.** "This method has three reasons to change — that's an SRP smell. Suggest splitting at the seam between X and Y."
3. **Quantify the cost.** SOLID violations matter when they hurt change cost, test cost, or comprehension cost. A theoretical violation in stable code is not worth refactoring.
4. **Refactor in a separate PR** when the change is large. Don't bundle a SOLID rewrite with a feature.
