# Rust

> Authoritative for any task touching Rust in this repo. Note: Rust isn't in the team's default stack — adopt via ADR before introducing.
> **Edition**: 2021 · **Toolchain**: `rustup`, stable, MSRV documented in `Cargo.toml`

## TL;DR (read this first; load deep sections only when needed)

- **Encode invariants in types.** Newtypes for IDs/amounts (`AccountId(String)`, `Cents(u64)`). Enums for state machines, not status flags. `Option<T>` for nullable, `Result<T, E>` for fallible.
- **Ownership**: take `&str`/`&[T]` for read-only params; return owned (`String`/`Vec<T>`). Avoid lifetimes in public APIs unless necessary.
- **Errors**: library code → concrete error enum with `thiserror`. Binary code → `anyhow::Result` with `.context()`. Use `?` for propagation; never `unwrap()`/`expect()` in non-test code without a `// SAFETY:` comment.
- **Async**: Tokio is the default. Every external call has a timeout (`tokio::time::timeout`). Never block the executor — use `tokio::task::spawn_blocking` for sync I/O or heavy CPU.
- **Concurrency**: `Arc<T>` for shared ownership, `tokio::sync::Mutex` for async locks, channels for actor-style. `JoinSet` over ad-hoc spawns. `Send + Sync` complaints usually mean the design is wrong.
- **Tests**: built-in `cargo test`. Unit tests in `#[cfg(test)] mod tests`; integration in `tests/`. `proptest` for property-based; `wiremock` for HTTP. `cargo llvm-cov` for coverage.
- **Layout**: split `lib.rs` from `main.rs` — main is a thin shell, library is testable. Use Cargo workspaces for multi-crate.

**Deep sections below** — read only when the TL;DR points you there:
- § 1 Idioms & style (`thiserror`/`anyhow` examples, anti-patterns)
- § 2 Testing patterns (async tests, property tests, wiremock)
- § 3 Concurrency & error handling (Send+Sync, select!, channel patterns)
- § 4 Project layout & tooling (Cargo.toml, workspace setup, commands)

---

## 1. Idioms & style

### Lean on the type system

Rust's compiler is your first reviewer. Encode invariants in types:

- **Newtypes** for IDs, amounts, and anything that shouldn't be interchangeable with another `String` or `i64`.
  ```rust
  pub struct AccountId(String);
  pub struct Cents(u64);   // not just `u64`; that's any number
  ```
- **Enums for state machines.** A `Transfer` that can be Pending, Succeeded, or Failed is an `enum`, not a struct with status flags.
  ```rust
  pub enum Transfer {
      Pending { submitted_at: DateTime<Utc> },
      Succeeded { settled_at: DateTime<Utc>, receipt: String },
      Failed { error: String, retryable: bool },
  }
  ```
- **`Option<T>` instead of nullable.** **`Result<T, E>` instead of throwing.** Both are required reading.

### Ownership: prefer borrowing for parameters, owning for return values

```rust
// Function takes a borrow; caller keeps ownership
fn validate(req: &TransferRequest) -> Result<(), ValidationError> { ... }

// Function returns owned data; caller decides what to do with it
fn build_receipt(t: &Transfer) -> Receipt { ... }
```

Take `&str` over `String` when you only need to read. Take `&[T]` over `Vec<T>` when you only need to iterate. Returning `&str` or `&[T]` requires a lifetime — usually clearer to return owned data.

### Errors: `Result<T, E>` always; concrete error types

- **Library code**: define your own error enum with `thiserror`. Each variant tells the caller what happened and includes enough data to handle it.
- **Application/binary code**: `anyhow::Result` is fine — you're catching errors to log/display, not to programmatically handle.

```rust
// lib code
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransferError {
    #[error("validation failed: {0}")]
    Validation(String),
    #[error("insufficient funds: have {have}, need {need}")]
    InsufficientFunds { have: u64, need: u64 },
    #[error("gateway error")]
    Gateway(#[source] reqwest::Error),
}

pub fn submit(req: &TransferRequest) -> Result<TransferId, TransferError> { ... }

// binary code
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let cfg = config::load().context("loading config")?;
    run(&cfg).context("running service")?;
    Ok(())
}
```

### `?` is the right tool for propagation

```rust
fn submit(req: TransferRequest) -> Result<Receipt, TransferError> {
    validate(&req)?;                       // bail on err
    let id = gateway::send(&req)?;
    Ok(Receipt::new(id, req.amount))
}
```

If you find yourself writing `match … { Ok(v) => v, Err(e) => return Err(...) }`, use `?` + `From` conversion (or `.map_err(...)`).

### Anti-patterns to flag in review

- **`unwrap()` / `expect()` in non-test code** without a comment proving it can't panic. Use `?` or handle the variant.
- **`clone()` everywhere to satisfy the borrow checker.** Often a sign the design is fighting ownership; reconsider.
- **`Arc<Mutex<T>>` sprinkled everywhere.** Sometimes correct, often a sign that the concurrency design is unclear.
- **`unsafe` without a `// SAFETY:` comment** explaining why each invariant holds.
- **`String` parameters when `&str` would do** (or `&Path`, `&[u8]`).
- **Re-exporting everything from `lib.rs`.** Module structure is API; design it.
- **Catching errors with `let _ = ...`** to make them go away. The compiler warned for a reason.
- **`as` casts between numeric types of different widths** without bounds checking — use `try_into()` and handle the failure.

---

## 2. Testing patterns

**Framework**: built-in `cargo test`. **Property tests**: `proptest`. **Async**: `tokio::test`. **HTTP mocking**: `wiremock`.

### Unit tests live in the file

```rust
// src/validators.rs
pub fn validate_amount(amount: u64) -> Result<(), ValidationError> { ... }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_zero() {
        let err = validate_amount(0).unwrap_err();
        assert!(matches!(err, ValidationError::AmountTooLow));
    }

    #[test]
    fn accepts_minimum() {
        assert!(validate_amount(1).is_ok());
    }
}
```

`#[cfg(test)]` means the module compiles only for tests — no overhead in production binaries.

### Integration tests live in `tests/`

```
crate/
├── src/
│   └── lib.rs
└── tests/
    └── submit_transfer.rs    # each file is its own binary
```

Each file in `tests/` is compiled as a separate binary and can only use the crate's public API — exactly right for integration testing.

### Test naming

Snake-case, describes behavior: `submit_returns_idempotent_response_when_key_seen_within_window`.

### Async tests with Tokio

```rust
#[tokio::test]
async fn submits_transfer_via_gateway() {
    let mock = wiremock::MockServer::start().await;
    wiremock::Mock::given(method("POST"))
        .and(path("/transfers"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"id": "t_1"})))
        .mount(&mock)
        .await;

    let client = GatewayClient::new(&mock.uri());
    let id = client.submit(sample_request()).await.unwrap();
    assert_eq!(id, "t_1");
}
```

### Property-based testing for pure logic

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn round_trip_serialize(amount in 1u64..1_000_000) {
        let cents = Cents(amount);
        let s = cents.to_string();
        let parsed: Cents = s.parse().unwrap();
        assert_eq!(parsed, cents);
    }
}
```

### Determinism rules

- Don't use `std::time::Instant::now()` or system clocks in production code. Inject a clock trait.
- Mock external services with `wiremock` (HTTP) or hand-written test doubles.
- Use `rand::SeedableRng` and pass an injected RNG when randomness matters.

### Coverage

- `cargo llvm-cov` produces line + branch coverage.
- ≥ 80% on changed lines.
- Don't game it — `unwrap()` in tests counts as covered even when production paths panic.

---

## 3. Concurrency & error handling

### Choose your async runtime once

**Tokio** is the team default unless an ADR says otherwise. Pick `multi_thread` for servers, `current_thread` for CLIs.

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = config::load()?;
    let app = build_app(&cfg).await?;
    axum::Server::bind(&cfg.addr).serve(app.into_make_service()).await?;
    Ok(())
}
```

### Send + Sync boundaries

Types you share across tasks must be `Send + Sync`. The compiler enforces this. When it complains:

1. **Most of the time, your design is wrong.** A bare `RefCell` across `await` points is not okay.
2. Use `Arc<T>` for shared ownership across tasks.
3. Use `tokio::sync::Mutex` for async-aware locks; `std::sync::Mutex` for short critical sections without `await` inside.
4. Use channels (`tokio::sync::mpsc`, `oneshot`, `broadcast`) for actor-style designs.

### `select!` for cancellation and timeouts

```rust
use tokio::time::{timeout, Duration};

let result = timeout(Duration::from_secs(5), gateway.submit(&req)).await
    .map_err(|_| TransferError::GatewayTimeout)??;
```

Every external call has a timeout. No exceptions.

### Structured concurrency: `JoinSet` over `tokio::spawn` ad hoc

```rust
let mut set = tokio::task::JoinSet::new();
for user_id in user_ids {
    set.spawn(get_profile(user_id));
}
while let Some(res) = set.join_next().await {
    let profile = res??;
    ...
}
```

`JoinSet` ensures spawned tasks are awaited and lets you cancel the whole batch if one fails.

### Don't block the executor

Inside an `async fn`, never:
- Call sync I/O (`std::fs`, blocking `reqwest::blocking`, etc.)
- Hold a `std::sync::Mutex` across `.await`
- Do long CPU work without yielding

For sync I/O or CPU-heavy work, use `tokio::task::spawn_blocking`. The runtime has a separate thread pool for it.

### Error handling rules

1. **Libraries return `Result<T, MyError>`** — concrete enum, `thiserror`-derived.
2. **Binaries return `anyhow::Result<T>`** at the top.
3. **`?` propagates; `From` impls (auto-derived by `thiserror`) handle conversion.**
4. **`panic!` is for impossible states only.** Like Go's panic — programmer errors, not failed I/O.
5. **`unwrap` and `expect` are banned in non-test code** unless preceded by a `// SAFETY:` or `// INVARIANT:` comment proving the call can't panic.
6. **Log errors at the boundary**, not at every layer. Use `tracing` with structured fields.

---

## 4. Project layout & tooling

### Single-crate service

```
service-name/
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml      # pins toolchain version
├── README.md
├── src/
│   ├── main.rs              # entry — wire deps, start server
│   ├── lib.rs               # library API for testing
│   ├── api/
│   │   └── mod.rs
│   ├── domain/
│   │   ├── mod.rs
│   │   ├── transfer.rs
│   │   └── errors.rs
│   ├── adapters/
│   │   ├── mod.rs
│   │   ├── postgres.rs
│   │   └── gateway.rs
│   └── config.rs
├── tests/                   # integration tests
└── benches/                 # criterion benchmarks
```

Split `lib.rs` from `main.rs`. `main.rs` is a thin shell that calls into the library; the library is testable in isolation.

### Cargo workspace (for multiple crates)

```
workspace/
├── Cargo.toml               # [workspace] with members = ["crates/*"]
├── Cargo.lock               # one lockfile for the whole workspace
├── crates/
│   ├── service-api/
│   ├── service-domain/
│   └── service-adapters/
```

Internal crates use path dependencies; external crates are pinned in the workspace `Cargo.toml` under `[workspace.dependencies]` so versions stay consistent.

### `Cargo.toml` essentials

```toml
[package]
name = "service-name"
version = "0.1.0"
edition = "2021"
rust-version = "1.80"        # MSRV

[dependencies]
tokio = { version = "1", features = ["macros", "rt-multi-thread", "signal"] }
axum = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }

[dev-dependencies]
tokio = { version = "1", features = ["test-util"] }
wiremock = "0.6"
proptest = "1"

[profile.release]
lto = "thin"
codegen-units = 1
strip = true
```

### `rust-toolchain.toml`

```toml
[toolchain]
channel = "1.80"
components = ["rustfmt", "clippy", "rust-src"]
```

Pins the toolchain so every developer and CI agent uses the same version.

### Tooling commands

```bash
# Format (idempotent; pre-commit)
cargo fmt

# Check formatting in CI
cargo fmt --check

# Lint
cargo clippy --all-targets --all-features -- -D warnings

# Build
cargo build
cargo build --release

# Test
cargo test                          # all unit + integration + doc tests
cargo test --lib                    # unit only
cargo test --test submit_transfer   # specific integration test

# Coverage
cargo llvm-cov --workspace --lcov --output-path lcov.info

# Audit dependencies for known vulnerabilities
cargo audit

# Find unused deps
cargo machete

# Check what `cargo build` will compile (faster than build)
cargo check

# Run with structured logs
RUST_LOG=info,service_name=debug cargo run
```

### Lint config

`Cargo.toml`:

```toml
[lints.rust]
unsafe_code = "forbid"        # crate-level. Lift if you genuinely need unsafe.
missing_docs = "warn"

[lints.clippy]
pedantic = { level = "warn", priority = -1 }
missing_errors_doc = "allow"
module_name_repetitions = "allow"
```

CI: `cargo clippy -- -D warnings` fails the build on any lint.

### Dependency hygiene

- `Cargo.lock` committed (yes, even for libraries — for reproducible CI).
- `cargo audit` in CI; high/critical advisories fail the build.
- New dependency = ADR or PR description justification. Rust dependency trees grow fast.
- Prefer fewer, well-maintained crates over many small ones.
- `cargo deny` for license compliance if your org cares (most do).
