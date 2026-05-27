# TypeScript

> Authoritative for any task touching TypeScript in this repo.
> **Version**: TypeScript 5.x, Node 20+ · **Package manager**: `pnpm`

## TL;DR (read this first; load deep sections only when needed)

- **Strict mode + `noUncheckedIndexedAccess`** in `tsconfig.json`. `any` is a code smell; use `unknown` + type guard.
- **`type` for unions/mapped/primitives; `interface` for extensible object shapes.** No enums — use string union types.
- **Discriminated unions for state machines.** Compiler narrows in each `case`.
- **Validate at the boundary** with Zod (or equivalent). Every HTTP body, queue message, env var goes through a schema before becoming a typed value.
- **Errors are `Error` subclasses**, never strings. Use ES2022 `cause`. Wrap third-party errors at the boundary.
- **Concurrency = `Promise` + `async`/`await`.** `await` everything, or explicit `void p.catch(...)` for fire-and-forget. Enable `@typescript-eslint/no-floating-promises`. Every external call takes `AbortSignal`. Default timeouts everywhere.
- **React**: function components only. Default to URL state + server state (TanStack Query). Local state only for transient UI. No barrel exports.
- **Tests**: Vitest + Testing Library (query by role/label/text, not classes). msw for HTTP mocking — same handlers in tests and dev.
- **Layout**: feature folders in `src/features/`, co-locate component + test + styles.

**Deep sections below** — read only when the TL;DR points you there:
- § 1 Idioms & style (Zod patterns, React anti-patterns)
- § 2 Testing patterns (msw setup, Testing Library examples)
- § 3 Concurrency & error handling (Promise.allSettled, AbortController, error wrapping)
- § 4 Project layout & tooling (tsconfig, package.json, ESLint flat config, commands)

---

## 1. Idioms & style

### Strict mode is non-negotiable

```jsonc
// tsconfig.json — minimum required flags
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

`strict: true` alone isn't enough. `noUncheckedIndexedAccess` catches the common bug where `arr[i]` is treated as `T` instead of `T | undefined`.

### `any` is a code smell; `unknown` is the right tool

```typescript
// Bad
function parse(input: any): User { ... }

// Good — force the caller to narrow
function parse(input: unknown): User {
  if (!isUser(input)) throw new ValidationError("not a user");
  return input;
}
```

If you genuinely need to bypass the type system, use `unknown` + a type guard, not `any`. If you must use `any`, add `// eslint-disable-next-line` with a comment explaining why.

### `type` vs `interface`

- **`type`** for unions, intersections, mapped types, and primitives.
- **`interface`** for object shapes that may be extended or implemented.
- For a plain record type, either works; pick one convention per file and stick with it.

```typescript
type Status = "pending" | "succeeded" | "failed";  // union — must be `type`

interface Account {
  id: string;
  balanceCents: bigint;
}  // shape — `interface` is conventional
```

### Discriminated unions over enums

Enums in TypeScript are quirky (numeric enums have surprising behavior, const enums interact badly with bundlers). Prefer string union types or discriminated unions.

```typescript
// Avoid
enum Status { Pending, Succeeded, Failed }

// Prefer — union
type Status = "pending" | "succeeded" | "failed";

// Better for state machines — discriminated union
type Transfer =
  | { status: "pending"; submittedAt: Date }
  | { status: "succeeded"; settledAt: Date; receipt: string }
  | { status: "failed"; error: string; retryable: boolean };

function describe(t: Transfer): string {
  switch (t.status) {
    case "pending":   return `pending since ${t.submittedAt.toISOString()}`;
    case "succeeded": return `settled (${t.receipt})`;
    case "failed":    return `failed: ${t.error}`;
  }
}
```

TypeScript narrows inside each `case`, so `t.receipt` is only available in the `"succeeded"` branch — exactly right.

### Validate at the boundary with Zod (or equivalent)

Trust nothing from the outside. Every HTTP body, queue message, env var, and config file goes through a schema validator before becoming a typed value.

```typescript
import { z } from "zod";

const TransferRequest = z.object({
  accountId: z.string().min(1),
  amountCents: z.bigint().positive(),
  idempotencyKey: z.string().uuid(),
});
type TransferRequest = z.infer<typeof TransferRequest>;

// At the HTTP boundary:
app.post("/transfers", async (req, res) => {
  const parsed = TransferRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const transfer = parsed.data;  // fully typed
  ...
});
```

### Errors are `Error` subclasses

```typescript
// Bad — throwing a string loses the stack
throw "something went wrong";

// Good
class PaymentGatewayError extends Error {
  override name = "PaymentGatewayError";
  constructor(message: string, readonly retryable: boolean, readonly cause?: unknown) {
    super(message);
  }
}
```

ES2022 `cause` works too: `throw new Error("wrap", { cause: original })`.

### React idioms (when applicable)

- Function components only. No class components in new code.
- Hooks are called unconditionally at the top of the component.
- **Lift state up only when needed.** Default to URL state (search params) and server state (TanStack Query / RTK Query). Local component state for transient UI only.
- No barrel exports (`index.ts` that re-exports everything). They break tree-shaking and slow down builds.
- Co-locate component, styles, and test: `Button.tsx`, `Button.module.css`, `Button.test.tsx`.

### Anti-patterns to flag in review

- `as` casts without a type guard above them. Each `as` is a hole in the type system.
- `Function` or `Object` as types. Use `(...args: never[]) => unknown` or a specific shape.
- `try/catch` that swallows the error: `catch (e) { return null }`. Either handle the error or let it propagate.
- Using `Promise` without awaiting it (and without explicitly marking it fire-and-forget). Floating promises lose errors.
- `// @ts-ignore` without a comment explaining why. Prefer `// @ts-expect-error` with a reason.
- `useEffect` for everything. Most "effects" are derived state or event handlers in disguise.
- Mutating props or state directly. Always produce new objects.

---

## 2. Testing patterns

**Unit/component**: Vitest + Testing Library (`@testing-library/react` for React).
**E2E**: Playwright.
**Mocking HTTP**: `msw` (Mock Service Worker) — same in tests and dev.

### Test layout

```
src/
├── transfers/
│   ├── submit.ts
│   ├── submit.test.ts        # co-located, same name + .test.ts
│   ├── TransferForm.tsx
│   └── TransferForm.test.tsx
tests/
└── e2e/                      # Playwright specs
    └── submit-transfer.spec.ts
```

### Unit test shape

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { submitTransfer } from "./submit";

describe("submitTransfer", () => {
  it("returns idempotent response when key seen within window", async () => {
    const gateway = fakeGateway({ seen: ["key-1"] });
    const result = await submitTransfer({ ... }, { gateway, clock: fixedClock });
    expect(result).toEqual({ status: "idempotent", existingId: "..." });
  });

  it("rejects amount below minimum", async () => {
    await expect(submitTransfer({ amountCents: 0n, ... }, deps))
      .rejects.toThrow(/amount must be positive/);
  });
});
```

### Component testing (React)

Test behavior, not implementation. Query by role, label, or text — never by class name or test-id-as-first-resort.

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("disables submit until amount is entered", async () => {
  render(<TransferForm onSubmit={vi.fn()} />);
  expect(screen.getByRole("button", { name: /send transfer/i })).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/amount/i), "100");
  expect(screen.getByRole("button", { name: /send transfer/i })).toBeEnabled();
});
```

### Mocking HTTP with msw

Define handlers once; use in tests, dev, and Storybook.

```typescript
// test/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("/api/transfers", () => HttpResponse.json({ id: "tr_123", status: "pending" })),
];

// test setup
import { setupServer } from "msw/node";
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Determinism rules

- Inject the clock. Vitest's `vi.useFakeTimers()` is fine for short tests; for everything else, dependency-inject a `Clock` interface.
- No real network. msw handles HTTP; mock other clients at the interface boundary.
- No unseeded random/UUID. Inject the generator.

### Coverage

- Vitest with V8 coverage: `vitest run --coverage`.
- ≥ 80% on changed lines.
- Branch coverage on. The numerator that matters most.

---

## 3. Concurrency & error handling

### Concurrency = `Promise` + `async`/`await`

JavaScript is single-threaded; "concurrency" means I/O interleaving. No threads, no shared mutable state across true parallelism (until you reach for Web Workers or `worker_threads`).

### `await` everything, or explicitly fire-and-forget

```typescript
// Bad — error vanishes
sendEmail(user);   // returns a Promise, nothing awaits it

// Good — awaited
await sendEmail(user);

// Acceptable — explicit fire-and-forget at a boundary
void sendEmail(user).catch(err => logger.error({ err }, "background email failed"));
```

ESLint rule: `@typescript-eslint/no-floating-promises`. Enable it.

### Parallel work: `Promise.all` / `Promise.allSettled`

```typescript
// All-or-nothing — first rejection cancels the result
const [profile, balance, recent] = await Promise.all([
  getProfile(userId),
  getBalance(userId),
  getRecent(userId),
]);

// Want partial results — handle each outcome
const results = await Promise.allSettled([...]);
for (const r of results) {
  if (r.status === "fulfilled") use(r.value);
  else logger.warn({ reason: r.reason }, "subtask failed");
}
```

For bounded concurrency over a list (e.g., process 1000 items, 10 at a time), use a library like `p-limit` rather than rolling it by hand.

### Cancellation: `AbortController`

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch(url, { signal: controller.signal });
  return await res.json();
} finally {
  clearTimeout(timeout);
}
```

Every I/O call that can hang takes an `AbortSignal`. Default timeouts everywhere — no unbounded waits.

### Error handling

1. **Throw `Error` subclasses,** never strings, numbers, or plain objects.
2. **Wrap at the boundary.** External error → your domain error.
   ```typescript
   try {
     const res = await fetch(...);
     if (!res.ok) throw new PaymentGatewayError(`status ${res.status}`, res.status >= 500);
     return await res.json();
   } catch (err) {
     if (err instanceof PaymentGatewayError) throw err;
     throw new PaymentGatewayError("network error", true, err);
   }
   ```
3. **Don't catch what you can't handle.** Let it propagate to a top-level handler (Express error middleware, React error boundary, queue consumer wrapper).
4. **Log once, at the boundary.** Not every layer.
5. **Result types for expected failures** are fine when the function has multiple failure modes the caller needs to switch on:
   ```typescript
   type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
   ```
   But don't replace exceptions everywhere — they're idiomatic in JS for unexpected failures.

---

## 4. Project layout & tooling

### Frontend (Vite + React)

```
app/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
└── src/
    ├── main.tsx                  # entry
    ├── App.tsx
    ├── features/                 # feature folders
    │   └── transfers/
    │       ├── TransferForm.tsx
    │       ├── TransferForm.test.tsx
    │       ├── api.ts            # data fetching
    │       └── types.ts
    ├── components/               # shared UI primitives
    ├── lib/                      # utilities, http client
    └── routes/                   # route definitions
```

### Node service (Hono / Express)

```
service/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── src/
│   ├── index.ts                  # entry — wire deps, start server
│   ├── api/                      # routes, request/response models
│   ├── domain/                   # pure business logic
│   ├── adapters/                 # DB, external HTTP clients
│   ├── config.ts                 # env loading via Zod
│   └── logger.ts
└── tests/
    ├── unit/
    └── integration/
```

### `package.json` essentials

```jsonc
{
  "name": "service-name",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "format": "prettier --write ."
  },
  "packageManager": "pnpm@9.x.x"
}
```

### ESLint setup (flat config, ESLint 9+)

```javascript
// eslint.config.js
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: { parserOptions: { project: true } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
```

### Tooling commands

```bash
# Install
pnpm install --frozen-lockfile

# Lint
pnpm lint
pnpm lint --fix

# Typecheck
pnpm typecheck

# Test
pnpm test                      # run once
pnpm test:watch                # watch mode
pnpm test:coverage

# Build
pnpm build

# Dev
pnpm dev
```

### Dependency hygiene

- `pnpm-lock.yaml` committed; CI runs `pnpm install --frozen-lockfile`.
- Use exact versions for libraries that change behavior often (date-fns, zod).
- `pnpm audit` and Dependabot for vulnerabilities.
- Workspaces (`pnpm-workspace.yaml`) for monorepos with shared packages.
- Avoid `devDependencies` creep — review the diff when adding tools.
