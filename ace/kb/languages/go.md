# Go

> Authoritative for any task touching Go in this repo.
> **Version**: 1.22+ · **Module mode**: always on

## TL;DR (read this first; load deep sections only when needed)

- **Accept interfaces, return structs.** Define interfaces on the *consumer* side, not the producer side. Small interfaces (1–3 methods) are good.
- **Errors are values**, not exceptions. Every function that can fail returns `(T, error)`. Wrap with `fmt.Errorf("doing X: %w", err)`. Use `errors.Is`/`errors.As` to inspect.
- **`context.Context` first parameter** on every function that does I/O, can block, or might be cancelled. Always propagate.
- **Zero values useful** — design types so `T{}` is meaningful. Avoid `init()`. Construct dependencies explicitly in `main()`.
- **Concurrency**: every goroutine has an owner that stops it. Use `errgroup` for parallel work with errors. `select` with `time.After` or `context.WithTimeout` for cancellation. No `time.Sleep` in tests.
- **Tests**: table-driven, `_test` package for black-box, `t.Cleanup` over `defer`, hand-written fakes over mock frameworks. `go test -race` in CI.
- **Layout**: single-module repo with `cmd/`, `internal/` (private), `pkg/` (only if exporting). Use `internal/` aggressively.

**Deep sections below** — read only when the TL;DR points you there:
- § 1 Idioms & style (anti-patterns, error wrapping details)
- § 2 Testing patterns (table-driven examples, mocking philosophy)
- § 3 Concurrency & error handling (channel patterns, mutex rules, cancellation)
- § 4 Project layout & tooling (go.mod, golangci.yml, commands)

---

## 1. Idioms & style

### Accept interfaces, return structs

Define interfaces on the **consumer** side, not the producer side. A package exports concrete types; consumers define small interfaces describing what they need.

```go
// package storage — exports a concrete type
package storage

type PostgresAccounts struct { db *sql.DB }

func (p *PostgresAccounts) Get(ctx context.Context, id string) (*Account, error) { ... }

// package transfers — defines what IT needs
package transfers

type AccountReader interface {
    Get(ctx context.Context, id string) (*Account, error)
}

type Service struct {
    accounts AccountReader  // any type with Get() works
}
```

This makes testing trivial (a fake satisfies the small interface) and keeps packages decoupled.

### Errors are values

`error` is a return value, not an exception. Every function that can fail returns `(T, error)`. Callers must check.

```go
// Good
account, err := accounts.Get(ctx, id)
if err != nil {
    return fmt.Errorf("loading account %s: %w", id, err)
}

// Bad — ignoring error
account, _ := accounts.Get(ctx, id)
```

`fmt.Errorf` with `%w` wraps; the caller can `errors.Is` or `errors.As` against the wrapped chain.

### Context first, always

Every function doing I/O, blocking, or that could be cancelled takes `ctx context.Context` as the first argument. Always pass it through; never `context.Background()` mid-call-stack except at the top.

```go
// Good
func (s *Service) Submit(ctx context.Context, req SubmitRequest) (*Receipt, error) { ... }

// Bad — swallows cancellation
func (s *Service) Submit(req SubmitRequest) (*Receipt, error) {
    ctx := context.Background()  // wrong
    ...
}
```

### Zero values are useful

Design types so the zero value is meaningful. `sync.Mutex{}` works without initialization. `bytes.Buffer{}` works without `New`.

```go
// Good — zero value is a valid empty queue
type Queue struct {
    items []Item
    mu    sync.Mutex
}

// Avoid — requires construction
type Queue struct {
    items chan Item   // nil channel blocks forever; needs New()
}
```

Provide constructors (`NewX`) only when zero isn't useful or when validation is required.

### Avoid `init()`

`init()` makes initialization order non-obvious and untestable. Construct dependencies explicitly in `main()` and inject them.

```go
// Bad
func init() {
    db = openDB(os.Getenv("DATABASE_URL"))  // implicit, untestable
}

// Good
func main() {
    cfg := config.Load()
    db, err := openDB(ctx, cfg.DatabaseURL)
    if err != nil { log.Fatal(err) }
    defer db.Close()

    svc := transfers.NewService(db, ...)
    runServer(ctx, svc)
}
```

### Anti-patterns to flag in review

- Empty interfaces (`interface{}` / `any`) crossing package boundaries. Be specific.
- Generic helper packages (`utils`, `helpers`, `common`). Put helpers next to their callers.
- Panic for normal control flow. Panics are for programmer errors (impossible states), not failed I/O.
- Ignored errors via `_`. If you truly don't care, comment why.
- Naked returns in long functions. Be explicit.
- `time.Sleep` in tests. Use channels or `testing/synctest`.
- Goroutines without a clear lifecycle — every `go` statement should answer "who stops it?"
- `interface{}` slice or map values as a "generic" workaround when generics would do.

---

## 2. Testing patterns

**Framework**: Go's standard `testing` package. `testify/require` for assertions when the standard library is too verbose. **Mocking**: avoid — use small interfaces and hand-written fakes.

### Test file layout

Tests live next to the code, same package or `_test` package:

```
package transfers
func Submit(...) (...) { ... }       // transfers.go

package transfers                    // same package — can test unexported
func TestSubmit_HappyPath(t *testing.T) { ... }  // transfers_test.go

package transfers_test               // black-box — only public API
func TestSubmit_RejectsZeroAmount(t *testing.T) { ... }
```

Prefer black-box (`_test` package) for new code — it forces you to test through the public API.

### Table-driven tests are the default

```go
func TestValidateAmount(t *testing.T) {
    tests := []struct {
        name    string
        amount  int64
        wantErr string
    }{
        {"zero", 0, "amount must be positive"},
        {"negative", -1, "amount must be positive"},
        {"too large", 1_000_000_000, "amount exceeds daily limit"},
        {"valid", 10_000, ""},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateAmount(tt.amount)
            if tt.wantErr == "" {
                require.NoError(t, err)
                return
            }
            require.ErrorContains(t, err, tt.wantErr)
        })
    }
}
```

### Test names describe behavior

`TestSubmit_ReturnsIdempotentResponseWhenKeySeenInWindow`, not `TestSubmit2`.

### Fakes over mocks

Hand-write a fake that implements the interface. It's usually 10 lines and far more readable than a mock framework.

```go
type fakeAccountReader struct {
    accounts map[string]*Account
}

func (f *fakeAccountReader) Get(ctx context.Context, id string) (*Account, error) {
    a, ok := f.accounts[id]
    if !ok {
        return nil, ErrNotFound
    }
    return a, nil
}
```

### `t.Cleanup` over `defer` in tests

`t.Cleanup(fn)` runs after the test (and its subtests) finish. Plays nicely with parallel tests.

### Race detector in CI

`go test -race ./...` always. A test passing without `-race` is not passing.

### Coverage

`go test -coverprofile=coverage.out ./...`. The ≥ 80% bar applies. Branch coverage matters more than line coverage for state-machine-heavy code.

---

## 3. Concurrency & error handling

### The concurrency model

Goroutines + channels + sync primitives. The mantra: **"Don't communicate by sharing memory; share memory by communicating."** — but `sync.Mutex` is fine when it's clearly the right tool.

### Every goroutine has an owner who stops it

```go
// Bad — leak
go pollUpdates(client)   // who stops it? nobody. leak.

// Good — context controls lifetime
go func() {
    if err := pollUpdates(ctx, client); err != nil && !errors.Is(err, context.Canceled) {
        log.Error("poll updates", "err", err)
    }
}()
// when ctx is cancelled (e.g., shutdown), the goroutine exits
```

### `errgroup` for parallel work with errors

```go
import "golang.org/x/sync/errgroup"

g, ctx := errgroup.WithContext(ctx)

var profile *Profile
g.Go(func() error {
    var err error
    profile, err = getProfile(ctx, userID)
    return err
})

var balance *Balance
g.Go(func() error {
    var err error
    balance, err = getBalance(ctx, userID)
    return err
})

if err := g.Wait(); err != nil {
    return nil, fmt.Errorf("loading dashboard: %w", err)
}
```

`errgroup` cancels sibling work as soon as one fails. Use `g.SetLimit(n)` to cap concurrency for fanout.

### Channel patterns

- **Unbuffered** for synchronization (sender blocks until receiver ready).
- **Buffered** for queues with a known bound. The bound is the design — pick deliberately.
- **Direction in signatures** (`chan<- T`, `<-chan T`) so callers know intent.
- **Close on the sender side only.** Multiple senders → use `sync.Once` or a dedicated coordinator.

### Mutex rules

- Lock and unlock in the same scope. `defer mu.Unlock()` immediately after `mu.Lock()`.
- Hold the lock for as little code as possible. No I/O under a lock.
- `RWMutex` only when the read/write ratio is *measurably* skewed. For low contention, `Mutex` is faster.

### Error handling rules

1. **Wrap with context using `%w`.** The wrap should add information, not repeat what the inner error said.
   ```go
   return fmt.Errorf("submitting transfer %s: %w", req.ID, err)
   ```

2. **Sentinel errors for callers to switch on.** Defined as package-level vars.
   ```go
   var ErrInsufficientFunds = errors.New("insufficient funds")
   ...
   if errors.Is(err, ErrInsufficientFunds) { ... }
   ```

3. **Typed errors when callers need data.**
   ```go
   type ValidationError struct {
       Field, Reason string
   }
   func (e *ValidationError) Error() string { return e.Field + ": " + e.Reason }
   ...
   var ve *ValidationError
   if errors.As(err, &ve) { ... }
   ```

4. **Don't log and return.** Log at the boundary (HTTP middleware, main, top of a worker loop). Returning errors from internal functions should not log.

5. **`panic` is for programmer errors only.** Nil deref of a value the type system says can't be nil, an `unreachable` switch default — those panic. Failed I/O does not.

### Cancellation

A cancelled context is *not* an error in the application sense. Check `errors.Is(err, context.Canceled)` or `context.DeadlineExceeded` and log at debug or info, not error, for shutdown paths.

---

## 4. Project layout & tooling

### Single-module repo (most services)

```
service-name/
├── go.mod
├── go.sum
├── README.md
├── cmd/
│   └── service-name/        # main package
│       └── main.go
├── internal/                # private to this module
│   ├── api/                 # HTTP handlers, routing
│   ├── domain/              # pure business logic
│   ├── storage/             # DB adapters
│   ├── client/              # outbound HTTP/gRPC clients
│   └── config/
├── pkg/                     # only if exporting for other modules — usually empty
├── api/                     # OpenAPI / proto definitions
├── deployments/             # Dockerfile, k8s manifests
└── scripts/
```

**Use `internal/` aggressively.** Anything not exported for cross-repo use goes in `internal/` — the compiler enforces it can't be imported from outside.

`pkg/` only if you have a reason to publish reusable packages. Many repos shouldn't have it.

### `go.mod` essentials

```go
module github.com/org/service-name

go 1.22

require (
    github.com/go-chi/chi/v5 v5.x
    github.com/jackc/pgx/v5 v5.x
    go.opentelemetry.io/otel v1.x
)
```

Pin major versions only; let `go.sum` lock the rest. Tidy regularly: `go mod tidy`.

### Tooling commands

```bash
# Format (idempotent; run on save)
gofmt -w .
goimports -w .

# Lint
golangci-lint run

# Build
go build ./...

# Vet (built-in checks)
go vet ./...

# Test
go test ./...                                 # all
go test -race ./...                           # with race detector (CI default)
go test -coverprofile=cov.out ./...
go test -run TestSubmit ./internal/transfers  # specific test
go test -bench=. ./internal/...               # benchmarks

# Module
go mod tidy                                   # remove unused, add missing
go mod why <module>                           # why is this dependency here?
```

### `.golangci.yml` essentials

```yaml
linters:
  enable:
    - errcheck       # unchecked errors
    - govet
    - staticcheck
    - ineffassign
    - unused
    - gocritic
    - revive
    - bodyclose      # http response bodies closed
    - contextcheck   # context propagation
    - errorlint      # %w usage, errors.Is/As
    - gosec          # security checks
    - nilerr
    - rowserrcheck
    - sqlclosecheck

linters-settings:
  gocritic:
    enabled-tags: [diagnostic, performance, style]

issues:
  exclude-use-default: false
```

### Dependency hygiene

- `go.sum` committed; CI runs `go mod verify`.
- Renovate/Dependabot tracks updates.
- New direct dependencies require justification in the PR description.
- Avoid pulling in heavyweight frameworks. The standard library is often enough.
