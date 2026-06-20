---
type: Consolidated Analysis
title: Týr Production Readiness — Consolidated View
description: Single consolidated view of what is needed for Týr to use rebalancing-client in production, synthesising TYR-USAGE.md, ARCHITECTURE.md, and INTEGRATION.md. Identifies all gaps and API changes required.
tags: [tyr, production, readiness, gaps, roadmap]
timestamp: 2026-06-20T00:00:00Z
---

# Týr Production Readiness — Consolidated View

**Date:** 2026-06-20
**Synthesises:** `docs/TYR-USAGE.md`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION.md`
**Audience:** Developers working on rebalancing-client and the rebalancing-engine; anyone extending either system with Týr in mind.

---

## 1. What Týr Needs from This Stack

Týr is the AI portfolio analyst and executive assistant. It does **not** trade; the engine does. Týr's job is to:

1. **Monitor** — detect drift breaches and circuit-breaker events without constant human attention
2. **Inform** — answer natural-language questions about portfolio health, drift, and recent activity
3. **Act (future)** — trigger manual rebalances and submit cash flows once the engine exposes write endpoints

The rebalancing-client is Týr's only interface to the engine. Everything Týr knows about portfolio state comes from the CLI commands in this repo.

---

## 2. Current Capability Map

### 2.1 What Works Today

All read-oriented queries are functional and agent-ready:

| Týr question | Command | Status |
|---|---|:---:|
| Which portfolios are in drift breach? | `portfolios list` → filter `driftStatus` | ✅ |
| Drift breakdown for a portfolio | `portfolios drift <id>` | ✅ |
| Proposed and executed trades | `portfolios proposals <id>` | ✅ |
| Circuit breaker status | `portfolios get <id>` → `circuitBreakerStatus` | ✅ |
| Recent audit log (filtered) | `logs --type X --since <iso>` | ✅ |
| Current price snapshot | `prices` | ✅ |
| Auth via environment variable | `REBALANCING_API_TOKEN` | ✅ |
| JSON-on-stdout, errors-on-stderr | Output contract | ✅ |

The daily briefing pipeline and heartbeat monitoring pattern (§5.2 of TYR-USAGE.md) work today against these commands.

### 2.2 Gaps — Consolidated and Prioritised

Gaps are classified by **severity for Týr** and **whether they require engine API changes**.

| # | Gap | Severity | Engine API change needed? |
|---|---|:---:|:---:|
| G1 | Token expiry / no refresh | 🔴 Critical | Confirm TTL; possibly `POST /api/auth/refresh` |
| G2 | Undifferentiated exit codes | 🔴 Critical | No |
| G3 | No event stream / watch mode | 🟠 High | Yes — SSE or WebSocket endpoint |
| G4 | No cross-portfolio aggregate | 🟠 High | Yes — `GET /api/portfolios/summary` |
| G5 | No write/mutation commands | 🟠 High | Yes — POST endpoints (trigger, reset, cashflow) |
| G6 | Stale price detection | 🟡 Medium | Minor — `asOf` already on `/api/prices` response |
| G7 | No `--since Nd` shorthand | 🟡 Medium | No |
| G8 | No `--all` pagination for logs | 🟡 Medium | No |
| G9 | No test coverage | 🟡 Medium | No |
| G10 | Hand-maintained types / no schema validation | 🟢 Low | No |
| G11 | `--pretty` output stub-level | 🟢 Low (operator UX only) | No |

---

## 3. Gaps That Require Engine API Changes

These gaps cannot be resolved by client-side work alone. Each has a corresponding GitHub issue on the engine repo (links below).

### G3 — Event Stream / Watch Mode

**Problem:** Týr must poll to detect state changes. A circuit breaker trip is only visible at the next poll cycle. For time-sensitive events this is unacceptable latency.

**Required engine change:** A streaming event endpoint — SSE (`text/event-stream`) is preferred over WebSocket for simplicity in agent pipelines.

```
GET /api/events/stream?portfolios=all&types=THRESHOLD_BREACH,CIRCUIT_BREAKER_HALT
```

Each event is a JSON object on a newline:
```json
{"event":"THRESHOLD_BREACH","accountId":"acc-001","at":"2026-06-20T14:22:00Z","drift":0.073}
{"event":"CIRCUIT_BREAKER_HALT","accountId":"acc-002","at":"2026-06-20T14:22:15Z","reason":"consecutive_losses"}
```

The client wraps this as `rebalancing watch --portfolios all --events THRESHOLD_BREACH,CIRCUIT_BREAKER_HALT` and emits NDJSON to stdout.

→ **Engine issue:** [#29 — Add SSE event stream for real-time portfolio state changes](https://github.com/accordant-eu/rebalancing-engine/issues/29) *(see §6)*

### G4 — Cross-Portfolio Aggregate Summary

**Problem:** There is no single-call health check for the whole book. Týr must call `portfolios list` and synthesise manually. For a daily briefing this is tolerable; for a heartbeat this adds latency and complexity.

**Required engine change:**

```
GET /api/portfolios/summary
```

Response shape:
```json
{
  "asOf": "2026-06-20T14:30:00Z",
  "meta": { "total": 12, "evaluatedAt": "2026-06-20T14:00:00Z" },
  "driftSummary": {
    "inBand": 9,
    "thresholdBreach": 2,
    "notEvaluated": 1
  },
  "totalAum": 2400000.00,
  "openCircuitBreakers": 1,
  "recentExecutions": { "last24h": 5, "last7d": 23 }
}
```

→ **Engine issue:** [#30 — Add GET /api/portfolios/summary aggregate endpoint](https://github.com/accordant-eu/rebalancing-engine/issues/30) *(see §6)*

### G5 — Write / Mutation Commands

**Problem:** Týr can observe but not act. The engine roadmap (Tranches 3+) plans write endpoints; the client must track them.

**Required engine changes (by priority):**

| Operation | Endpoint | Client command |
|---|---|---|
| Trigger rebalance | `POST /api/portfolios/:id/rebalance` | `portfolios trigger-rebalance <id> [--dry-run]` |
| Reset circuit breaker | `POST /api/portfolios/:id/circuit-breaker/reset` | `portfolios reset-circuit-breaker <id> --reason <text>` |
| Submit cash flow | `POST /api/portfolios/:id/cashflows` | `portfolios add-cashflow <id> --amount N --direction DEPOSIT\|WITHDRAWAL` |
| Update model mandate | `PUT /api/models/:id` (extend) | `models update <id> --file mandate.json` |

All write commands must:
- Support `--dry-run` (same JSON output shape, plus `"dryRun": true`)
- Require explicit `--confirm` for destructive operations (Týr cannot mutate without affirmative step)
- Return a structured response Týr can narrate ("I sold X shares…")

→ **Engine issue:** [#31 — Write endpoints: trigger rebalance, circuit-breaker reset, cash-flow submission](https://github.com/accordant-eu/rebalancing-engine/issues/31) *(see §6)*

### G1 (partial) — Token Refresh

**Problem:** Token TTL is undocumented. If the engine supports refresh tokens, `POST /api/auth/refresh` should be confirmed and the client should expose `auth refresh`.

**Confirmation needed from engine team:** Does the engine issue refresh tokens? What is the access token TTL?

→ **Engine issue:** [#32 — Document token TTL and confirm/implement refresh token support](https://github.com/accordant-eu/rebalancing-engine/issues/32) *(see §6)*

---

## 4. Gaps Resolvable in the Client (No Engine Changes)

### G2 — Structured Exit Codes (Critical)

Týr must distinguish auth failure from not-found from network error. Today all failures exit 1 with a string on stderr.

**Fix:** Map `ApiClientError.status` to documented exit codes:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General / network error |
| 2 | Auth failure (401) |
| 3 | Not found (404) |
| 4 | Validation / bad request (400) |
| 5 | Server error (5xx) |

Also: optionally emit structured JSON error to stderr when `--json` is active, so Týr can parse the error reason programmatically.

### G6 — Stale Price Detection

The `prices` response already includes `asOf`. The fix is a client-side flag:

```bash
rebalancing prices --max-age-minutes 60
# Exit 3 if asOf is older than 60 minutes
```

Exit code 3 = stale/degraded data (see exit code scheme above — code 3 repurposed from "not found" for this semantic; TYR-USAGE.md suggests exit 3 as "stale data"). **Decision needed:** adopt the exit code scheme from INTEGRATION.md §3.4, reserving code 3 for stale/degraded rather than not-found.

Also add:
- `prices --instrument <ticker>` for per-instrument filtering (avoid large payloads when checking one holding)

### G7 — `--since Nd` Shorthand

Shell date arithmetic (`date -u -d '24 hours ago' +%FT%TZ`) is fragile and OS-dependent. Add a `--since 24h` / `--since 7d` shorthand to `logs`.

### G8 — Pagination (`--all`) for Logs

Add `--all` to `logs` that auto-paginates and streams a complete JSON array to stdout. Without this, Týr silently misses audit events beyond the first 50 records.

### G9 — Test Coverage

No tests exist. The output contract is entirely untested. Priority order:
1. Smoke test: CLI builds and `--help` exits 0
2. Contract tests for exit codes (exit 2 on 401 mock, exit 3 on 404 mock)
3. Unit tests for `printOutput` invariants (stdout vs stderr separation)
4. Command-level tests with mocked HTTP (one per command group)

### G10 — OpenAPI Schema Validation in CI

Add a CI step: fetch `/api/docs/openapi.json`, generate types with `openapi-typescript`, diff against `src/types.ts`. Breaks the build on silent drift.

---

## 5. Production Readiness Checklist

For Týr to reliably use this client in production, **all 🔴 and 🟠 items** must be resolved. The 🟡 items are recommended before calling the integration stable.

### 🔴 Critical (blockers)

- [ ] **G1 — Token lifecycle documented and handled** — either a `refresh` command or a documented rotation procedure with TTL
- [ ] **G2 — Structured exit codes** — exit 2 for 401, exit 3 for 404, etc.

### 🟠 High (pre-stable integration)

- [ ] **G3 — Event stream / watch mode** *(blocked on engine API)*
- [ ] **G4 — Cross-portfolio summary endpoint** *(blocked on engine API)*
- [ ] **G5 — Write/mutation commands** *(blocked on engine API, Tranche 3+)*

### 🟡 Recommended (production quality)

- [ ] **G6 — `prices --max-age-minutes N`** for stale feed detection
- [ ] **G7 — `--since Nd` shorthand on `logs`**
- [ ] **G8 — `logs --all` pagination helper**
- [ ] **G9 — Test coverage** (at minimum: smoke tests + contract tests)
- [ ] **G10 — OpenAPI schema validation in CI**
- [ ] **Published to npm** — `npm install -g @accordant/rebalancing-client` confirmed or stable binary path

### 🟢 Nice-to-have

- [ ] **G11 — `--pretty` output polish** for operator UX
- [ ] **`logs explain <event-id>`** — structured log narrative (can be built client-side if log payloads are well-structured)
- [ ] **Execution quality / slippage** — `proposals compare` *(blocked on engine Tranche 4)*

---

## 6. GitHub Issues Created on rebalancing-engine

The following issues were created on [accordant-eu/rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) as a result of this analysis. Each represents an API change the engine must implement before the corresponding client feature can be built.

| Issue | Title | Labels | Gap |
|---|---|---|---|
| [#29](https://github.com/accordant-eu/rebalancing-engine/issues/29) | Add SSE event stream for real-time portfolio state changes (Týr watch mode) | `enhancement`, `agent-integration` | G3 |
| [#30](https://github.com/accordant-eu/rebalancing-engine/issues/30) | Add GET /api/portfolios/summary aggregate endpoint for cross-portfolio health check | `enhancement`, `agent-integration` | G4 |
| [#31](https://github.com/accordant-eu/rebalancing-engine/issues/31) | Write endpoints for Týr agent actions: trigger rebalance, circuit-breaker reset, cash-flow submission | `enhancement`, `agent-integration` | G5 |
| [#32](https://github.com/accordant-eu/rebalancing-engine/issues/32) | Document token TTL and confirm/implement refresh token support for agent auth lifecycle | `api-docs`, `agent-integration` | G1 |

---

## 7. Integration Architecture (Canonical Reference)

```text
                    ┌──────────────────────────────────────┐
                    │               Týr                    │
                    │  (AI analyst — observe, don't trade) │
                    └─────────────────┬────────────────────┘
                                      │
                    ┌─────────────────▼────────────────────┐
                    │        rebalancing-client CLI         │
                    │                                      │
                    │  stdout = JSON data                  │
                    │  stderr = error messages             │
                    │  exit 0 = success                    │
                    │  exit 2 = auth failure               │
                    │  exit 3 = not found                  │
                    │  exit 1 = general error              │
                    └─────────────────┬────────────────────┘
                                      │ HTTPS Bearer
                    ┌─────────────────▼────────────────────┐
                    │      rebalancing engine REST API      │
                    │  /api/portfolios (+ /summary future) │
                    │  /api/portfolios/:id/drift           │
                    │  /api/portfolios/:id/proposals       │
                    │  /api/logs                           │
                    │  /api/prices                         │
                    │  /api/events/stream (future)         │
                    │  /api/portfolios/:id/rebalance (fut) │
                    └──────────────────────────────────────┘
```

**Auth:** `REBALANCING_API_TOKEN` env var always. Never the config file in agent contexts.

**Monitoring pattern (today):** Týr polls 2–4× per day:
1. `portfolios list` → check for `threshold_breach` or `not_evaluated`
2. `portfolios get <id>` for any breaching portfolio → check `circuitBreakerStatus`
3. `logs --type CIRCUIT_BREAKER_HALT --since <last-check>` → new safety events
4. `prices` → check `asOf` staleness

**Monitoring pattern (future, with G3 resolved):** Týr maintains a long-running `rebalancing watch` subprocess and reacts to NDJSON events as they arrive.

---

## 8. Open Questions

These must be resolved with the engine team before the corresponding features can be designed:

1. **Token TTL** — What is the access token expiry? Does the engine issue refresh tokens?
2. **Write endpoint shapes** — Exact request/response shapes for trigger, circuit-breaker reset, and cash-flow submission (needed to design client commands correctly)
3. **Event stream transport** — SSE or WebSocket? SSE is simpler for agent pipelines (plain HTTP, line-by-line text); WebSocket allows bidirectional flow.
4. **Summary endpoint scope** — Should `/api/portfolios/summary` be a dedicated endpoint or a query parameter on `/api/portfolios`?
5. **Multi-portfolio bulk drift** — Does the engine support a single call to get drift for all portfolios, or must the client iterate per portfolio?
6. **Separate operator tool** — When write commands exist, do they stay in this client or move to a higher-privilege operator CLI with stricter audit requirements?

---

## Related

- [`docs/TYR-USAGE.md`](./TYR-USAGE.md) — Týr usage patterns, heartbeat monitoring, feature roadmap
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — client architecture, output contract, component responsibilities
- [`docs/INTEGRATION.md`](./INTEGRATION.md) — integration patterns, production gap checklist
- [`docs/decisions/0001-cli-design-and-scope.md`](./decisions/0001-cli-design-and-scope.md) — CLI design ADR
- [rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) — the engine this client observes
- [Engine roadmap](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/roadmap/rebalancing-engine-roadmap.md)

---

*© 2026 Johan Hellman. All rights reserved.*
