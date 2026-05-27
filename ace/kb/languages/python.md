# Python

> Authoritative for any task touching Python in this repo.
> **Version**: 3.12+ · **Package manager**: `uv` (preferred) or `poetry`

## TL;DR (read this first; load deep sections only when needed)

- **Type hints on all public APIs**, `mypy --strict` clean. `Any` is a code smell; use `unknown` patterns (validate then narrow).
- **Boundary types**: Pydantic models for I/O validation; frozen dataclasses (`frozen=True, slots=True`) for internal records. Bare `dict`/`tuple` only inside one function.
- **Errors**: catch narrowest exception possible. Wrap third-party exceptions at the boundary with your own domain exception. Never `except Exception:` or bare `except:`. Don't log-and-re-raise — handle or propagate, not both.
- **Async or sync — pick per service.** If async, all I/O is async. Every `await` doing I/O has a timeout (`asyncio.wait_for` or `asyncio.TaskGroup`). Use `asyncio.TaskGroup` (3.11+) for structured concurrency.
- **Tests**: pytest, fixtures over setup, parametrize over loops, fakes over mocks, deterministic (no real time/network/random/filesystem). ≥80% coverage on changed lines.
- **Layout**: `src/<package>/` layout; `tests/` mirrors it. Lint with `ruff`; type with `mypy --strict`.

**Deep sections below** — read only when the TL;DR points you there:
- § 1 Idioms & style (anti-patterns, `match`/case, composition)
- § 2 Testing patterns (mocking philosophy, property tests)
- § 3 Concurrency & error handling (TaskGroup examples, threads/processes)
- § 4 Project layout & tooling (pyproject.toml, commands)

---

## 1. Idioms & style

### Type hints are mandatory on public APIs

Every public function, method, and dataclass field has type hints. `mypy --strict` runs in CI. `Any` is a code smell; use `object` if you truly mean "anything", or narrow with `TypeGuard`/`isinstance`.

```python
# Good
def get_account(account_id: str) -> Account | None: ...

# Bad
def get_account(account_id): ...
def get_account(account_id) -> Any: ...
```

### Structured data crosses module boundaries

Bare `dict` and `tuple` are fine *within* a function. Anything crossing a module boundary is a **Pydantic model** (for I/O / validation) or a **dataclass** (for internal records).

```python
# Good — boundary type
class TransferRequest(BaseModel):
    account_id: str
    amount_cents: int = Field(gt=0)
    idempotency_key: UUID

# Good — internal record
@dataclass(frozen=True, slots=True)
class TransferAttempt:
    request: TransferRequest
    attempted_at: datetime
    result: Literal["pending", "succeeded", "failed"]

# Bad — dict floating across modules
def submit(payload: dict) -> dict: ...
```

`frozen=True, slots=True` on dataclasses by default. Mutation is opt-in, not opt-out.

### Prefer composition over inheritance

Inheritance is for `is-a` relationships shared across the team's domain (e.g., `class TransferError(DomainError)`). Don't inherit to share helpers — use plain functions or a collaborator object.

### Use `match` for tagged unions

Python 3.10+ structural pattern matching makes union handling explicit and exhaustive.

```python
def handle(result: Result) -> Response:
    match result:
        case Success(value=v):
            return Response.ok(v)
        case Failure(error=e) if e.retryable:
            return Response.retry(after=e.retry_after)
        case Failure(error=e):
            return Response.failed(reason=str(e))
```

### Anti-patterns to flag in review

- `except Exception:` or bare `except:` — too broad. Catch the specific exception type.
- `*args, **kwargs` on public APIs when you actually know the signature. Be explicit.
- Mutable default arguments (`def f(x=[])`) — Python's classic foot-gun.
- `from module import *` outside of `__init__.py` re-exports.
- Module-level mutable state. Use a class or a context manager instead.
- Manual JSON parsing into dicts when a Pydantic model would catch errors at the boundary.
- `time.sleep` in async code — use `await asyncio.sleep`.

---

## 2. Testing patterns

**Framework**: `pytest` with `pytest-asyncio` for async. **HTTP testing**: `httpx`. **Property-based**: `hypothesis` for non-trivial pure logic.

### Test layout

Mirror `src/` under `tests/`. One test file per source file. Test name describes the behavior:

```
src/payments/ach.py
tests/payments/test_ach.py

def test_returns_idempotent_response_when_key_seen_within_window(): ...
def test_raises_validation_error_for_amount_below_minimum(): ...
```

### Fixtures over setup methods

```python
# Good
@pytest.fixture
def transfer_request() -> TransferRequest:
    return TransferRequest(
        account_id="acc_123",
        amount_cents=10_000,
        idempotency_key=uuid4(),
    )

def test_submit_returns_pending(transfer_request, ach_client):
    result = ach_client.submit(transfer_request)
    assert result.status == "pending"
```

### Parametrize over loops

```python
@pytest.mark.parametrize("amount,expected_error", [
    (0,      "amount must be positive"),
    (-1,     "amount must be positive"),
    (10**9,  "amount exceeds daily limit"),
])
def test_amount_validation(amount, expected_error):
    with pytest.raises(ValidationError, match=expected_error):
        TransferRequest(account_id="x", amount_cents=amount, idempotency_key=uuid4())
```

### Mocking philosophy

- **Mock at the boundary you own.** Don't mock `requests.get`; mock your own `HttpClient` interface.
- **Prefer fakes to mocks** for stateful collaborators (a real in-memory `Repository` is easier to reason about than a `MagicMock` with `.return_value` everywhere).
- Use `respx` or `httpx.MockTransport` for HTTP mocking — not `unittest.mock.patch` on `requests`.
- Mock side-effects (clocks, randomness, UUIDs) via dependency injection, not monkeypatching, when the code is yours.

### Determinism rules

- No real time. Inject a `Clock` or use `freezegun`.
- No real network. Use `MockTransport` or `respx`.
- No unseeded randomness. Inject the RNG or seed it.
- No real filesystem. Use `tmp_path` fixture.

### Coverage

- ≥ 80% on changed lines (enforced by CI).
- 100% on pure logic (validators, calculators, parsers) — no excuses.
- Branch coverage on, not just line coverage.

---

## 3. Concurrency & error handling

### Async or sync — pick per service, not per function

If a service is async (FastAPI), it's async all the way down: every I/O call uses an async client. Mixing `def` and `async def` for the same logical operation is a smell; pick one.

If you must call sync code from async, use `asyncio.to_thread` and contain it at the edge.

### `asyncio` rules

- Every `async def` doing I/O takes a timeout or is wrapped by one (`asyncio.wait_for`). No unbounded awaits.
- Use `asyncio.TaskGroup` (3.11+) for structured concurrency, not bare `asyncio.gather` for new code.
- Cancel scopes: when a parent task is cancelled, every child task is cancelled. Don't swallow `CancelledError` — re-raise after cleanup.

```python
async def fetch_user_dashboard(user_id: str) -> Dashboard:
    async with asyncio.TaskGroup() as tg:
        profile_t = tg.create_task(get_profile(user_id))
        balance_t = tg.create_task(get_balance(user_id))
        recent_t  = tg.create_task(get_recent_transactions(user_id))
    return Dashboard(profile_t.result(), balance_t.result(), recent_t.result())
```

### Threads and processes

- Threads: I/O-bound parallelism only. Use `concurrent.futures.ThreadPoolExecutor`.
- Processes: CPU-bound work. Use `concurrent.futures.ProcessPoolExecutor` or a job queue (Celery/RQ/Arq).
- The GIL exists. Don't pretend it doesn't.

### Error handling

**Errors are values too — but in Python they're exceptions.** Rules:

1. **Catch the narrowest exception you can.** `except ValueError`, not `except Exception`.
2. **Don't catch what you can't handle.** Let it propagate. The boundary layer (HTTP handler, queue consumer, CLI entry) decides what to do.
3. **Wrap third-party exceptions at the boundary.** Don't let `requests.exceptions.ConnectionError` leak into your domain code.

```python
# At the boundary
class PaymentGatewayError(Exception):
    def __init__(self, message: str, *, retryable: bool, cause: Exception | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.__cause__ = cause

async def submit_via_gateway(req: TransferRequest) -> str:
    try:
        resp = await http_client.post("/transfers", json=req.model_dump())
        resp.raise_for_status()
        return resp.json()["id"]
    except httpx.TimeoutException as e:
        raise PaymentGatewayError("gateway timeout", retryable=True, cause=e)
    except httpx.HTTPStatusError as e:
        retryable = e.response.status_code in (500, 502, 503, 504)
        raise PaymentGatewayError(f"gateway returned {e.response.status_code}",
                                  retryable=retryable, cause=e)
```

4. **Logging happens once, at the handler.** Don't log-and-re-raise. Either handle or propagate; not both.
5. **Don't use exceptions for control flow** where a return value would be clearer. Use `Result`/`Either` patterns (or a sentinel value) for expected failures; exceptions for the unexpected.

---

## 4. Project layout & tooling

### Directory layout

```
service-name/
├── pyproject.toml
├── uv.lock                  (or poetry.lock)
├── README.md
├── src/
│   └── service_name/        # importable package — note underscore
│       ├── __init__.py
│       ├── api/             # HTTP layer (FastAPI routers, request/response models)
│       ├── domain/          # pure business logic, no I/O
│       ├── adapters/        # external clients (DB, queue, HTTP)
│       ├── config.py        # settings, env loading
│       └── main.py          # entry point
├── tests/
│   ├── unit/                # mirrors src/, no I/O
│   ├── integration/         # real DB/queue via testcontainers
│   └── conftest.py
├── docs/
└── scripts/                 # dev/ops helpers
```

The `src/` layout is non-negotiable — it prevents `tests/` from accidentally importing the local working tree instead of the installed package.

### `pyproject.toml` essentials

```toml
[project]
name = "service-name"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "pydantic>=2.9",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5",
    "mypy>=1.11",
    "ruff>=0.6",
    "respx>=0.21",
    "hypothesis>=6",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM", "RUF", "ASYNC", "S", "N"]
ignore = ["S101"]  # asserts are fine in tests

[tool.mypy]
strict = true
python_version = "3.12"

[tool.pytest.ini_options]
asyncio_mode = "auto"
addopts = "--strict-markers --strict-config -ra"
```

### Tooling commands (used by CI; should also work locally)

```bash
# Install
uv pip install -e '.[dev]'        # or: poetry install

# Lint + format check
ruff check .
ruff format --check .

# Auto-fix
ruff check --fix .
ruff format .

# Type check
mypy --strict src

# Test
pytest                            # all
pytest tests/unit -x              # stop at first failure
pytest -k "idempotency"           # by name
pytest --cov=src --cov-report=term-missing

# Run the service locally
uvicorn service_name.main:app --reload
```

### Dependency hygiene

- Pin everything via the lockfile (`uv.lock` / `poetry.lock`) — commit it.
- New dependency = ADR or PR description justification. Avoid quietly growing the dependency tree.
- Dependabot updates the lockfile; the developer reviews and merges.
