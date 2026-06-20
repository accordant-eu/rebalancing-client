---
type: Architecture
title: Integration Guide
description: How Týr and agent pipelines integrate with the rebalancing-client
tags: [integration, agent, tyr]
timestamp: 2026-06-20T00:00:00Z
---

# Integration Guide — rebalancing-client

Date: 2026-06-20

This document describes how to integrate the rebalancing-client into agent pipelines (primarily Týr) and what must be built for it to be production-useful.

## 1. Integration Patterns

### Pattern A: Drift Monitoring

Týr polls for portfolios with active drift breaches, no orchestrator required.

```bash
# Get all portfolios with threshold breaches
rebalancing portfolios list \
  | jq '[.[] | select(.driftStatus == "threshold_breach")]'

# Drift detail for a specific portfolio
rebalancing portfolios drift my-portfolio \
  | jq '{due: .rebalanceDue, reason: .reason, breaches: [.driftByInstrument[] | select(.thresholdBreach)]}'
```

**When to use:** Periodic health checks, drift alerting, portfolio summaries on request.

### Pattern B: Audit Log Monitoring

Týr filters audit events for anomalies and operational events.

```bash
# Check for circuit breaker halts in the last 24h
rebalancing logs \
  --type CIRCUIT_BREAKER_HALT \
  --since $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  | jq '.total, .data[].type'

# All events for a specific portfolio, last 7 days
rebalancing logs \
  --portfolio my-portfolio \
  --since 2026-06-13T00:00:00Z \
  --limit 100
```

**When to use:** Anomaly detection, trade reconciliation verification, end-of-day audit summaries.

### Pattern C: Portfolio Status Report

Combines multiple queries for a comprehensive view.

```bash
# Full portfolio state
PORTFOLIO="my-portfolio"
rebalancing portfolios get $PORTFOLIO > /tmp/portfolio.json
rebalancing portfolios drift $PORTFOLIO > /tmp/drift.json
rebalancing portfolios proposals $PORTFOLIO --limit 5 > /tmp/proposals.json
rebalancing prices > /tmp/prices.json

# Combine and summarize (example jq pipeline)
jq -n \
  --slurpfile p /tmp/portfolio.json \
  --slurpfile d /tmp/drift.json \
  --slurpfile pr /tmp/proposals.json \
  '{
    accountId: $p[0].accountId,
    totalValue: $p[0].totalValue,
    driftStatus: $p[0].driftStatus,
    rebalanceDue: $d[0].rebalanceDue,
    lastEvaluatedAt: $p[0].lastEvaluatedAt,
    recentProposals: ($pr[0].proposals | length)
  }'
```

**When to use:** On-demand portfolio briefings, scheduled status reports.

### Pattern D: Agent Environment Setup

For Týr running in a controlled environment, no interactive auth needed.

```bash
# Environment variables — set once in agent config or secrets manager
export REBALANCING_API_URL=https://app.rebalancing.accordant.eu
export REBALANCING_API_TOKEN=<token>

# Verify auth state
rebalancing auth whoami --json
```

**Note:** Tokens expire. See §4 (Auth Token Lifecycle) for the production gap.

## 2. Current Capabilities

| Capability | Command | Agent-ready? |
|------------|---------|:---:|
| List portfolios with drift status | `portfolios list` | ✅ |
| Full portfolio detail | `portfolios get <id>` | ✅ |
| Drift breakdown per instrument | `portfolios drift <id>` | ✅ |
| Recent trade proposals | `portfolios proposals <id>` | ✅ |
| Paginated audit log (filtered) | `logs` | ✅ |
| Current price snapshot | `prices` | ✅ |
| Auth login (interactive) | `auth login` | ✅ |
| Auth via env var | `REBALANCING_API_TOKEN` | ✅ |
| Trigger rebalance | — | ❌ not in API v0.9.0 |
| Submit cash flow | — | ❌ not in API v0.9.0 |
| Force reconciliation pause | — | ❌ not in API v0.9.0 |
| Stream live audit events | — | ❌ not yet |

## 3. What Needs to Be Built

This section is the production gap assessment. Items are ordered by priority for Týr integration.

### 3.1 Write Commands (Blocked on Engine API)

The most significant missing capability is **mutation support**. The engine roadmap (Live Agent v2.0, Tranche 3+) implies the following write endpoints will eventually exist:

| Planned command | Likely endpoint | Purpose |
|-----------------|-----------------|---------|
| `rebalance trigger <id>` | `POST /api/portfolios/:id/rebalance` | Force a rebalance cycle |
| `cashflows submit <id>` | `POST /api/portfolios/:id/cashflows` | Register a pending deposit/withdrawal |
| `agent pause <id>` | `POST /api/portfolios/:id/pause` | Trigger a reconciliation pause |
| `agent resume <id>` | `POST /api/portfolios/:id/resume` | Resume after pause |

**Dependency:** Engine must expose these endpoints first. The client should not implement them speculatively — see AGENTS.md §2.

**Owner action required:** Confirm which write endpoints are planned for the next engine release so the client can be scoped accordingly.

### 3.2 Token Refresh / Re-auth

**Problem:** Bearer tokens expire. Agents running continuously will receive `401 Unauthorized` and produce `Error: UNAUTHORIZED: ...` on stderr with exit 1. There is no automatic retry or re-auth.

**Current workaround:** Restart the agent or re-run `auth login` manually before token expiry.

**What needs to be built:**
- `auth refresh` command (if the engine supports refresh tokens — check OpenAPI spec)
- Or: document token TTL and inject a fresh `REBALANCING_API_TOKEN` via secrets rotation in the agent environment
- Or: `auth login --non-interactive` for use in cron/agent startup scripts

**Severity for Týr:** High — a long-running agent will fail silently unless token lifecycle is handled.

### 3.3 Test Coverage

**Problem:** No test files exist. The output contract (stdout = data, stderr = errors, exit codes) is undocumented as runnable assertions. Regressions will be silent.

**What needs to be built:**
- Mock HTTP server (e.g. `msw` or `nock`) for unit testing command output
- Contract tests for the `--pretty` and `--json` output paths
- Error path tests (401, 404, network failure, malformed response)
- At minimum, a smoke test that the CLI builds and `--help` exits 0

**Scope estimate:** 2–3 days for meaningful coverage across all commands.

### 3.4 Structured Error Handling

**Problem:** `catch (err) { printError(String(err)); process.exit(1) }` converts all errors to strings. Callers cannot distinguish `401 Unauthorized` from a network failure from a `404 Not Found`.

**What needs to be built:**
- Structured exit codes (e.g., exit 2 for auth failure, exit 3 for not-found) — **or** emit structured JSON error objects to stderr for agent parsing
- At minimum, map `ApiClientError.status` to documented exit codes

**Agent impact:** Týr needs to distinguish "portfolio not found" from "token expired" to respond correctly. Currently both look the same on exit code 1.

**Suggested exit code scheme:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (network, unexpected) |
| 2 | Auth failure (401) |
| 3 | Not found (404) |
| 4 | Validation / bad request (400) |
| 5 | Server error (5xx) |

### 3.5 Pagination Helper

**Problem:** `logs` returns max `--limit` records (default 50). Callers must implement `--offset` iteration to exhaust a result set. There is no convenience for "get all records matching a filter."

**What needs to be built:**
- `--all` flag on `logs` that auto-paginates and streams JSON array to stdout
- Or: a `--stream` mode that outputs newline-delimited JSON records for pipeline processing

**Agent impact:** Medium — for audit log analysis, Týr may need more than 50 records.

### 3.6 OpenAPI Schema Validation

**Problem:** `src/types.ts` is hand-maintained. If the engine adds fields or changes types, the client types silently diverge until something breaks at runtime.

**What needs to be built:**
- A CI step that fetches the live OpenAPI spec from `/api/docs/openapi.json` and validates `src/types.ts` against it (e.g., using `openapi-typescript` to auto-generate a comparison)
- Or: generate `types.ts` from the spec automatically and check for diff

**Agent impact:** Low-severity but latent. Important for long-term maintainability.

### 3.7 `--pretty` Output Polish

**Problem:** `src/output.ts#printPretty` falls back to `JSON.stringify` for most data paths. Commands that lack custom formatting (`portfolios get`, `portfolios proposals`, `prices` as a table) produce un-pretty pretty output.

**What needs to be built:**
- Proper table rendering for `portfolios get` (holdings table)
- Trade proposal formatting for `portfolios proposals`
- Sorted ticker table for `prices --pretty`
- Audit log record expansion for `logs --pretty`

**Agent impact:** None — agents use JSON. This is operator UX only.

## 4. Auth Token Lifecycle

The current auth model does not address token TTL. For Týr in production:

```text
Recommended setup:
─────────────────
1. Store credentials in a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager,
   or a local encrypted .env file with restricted permissions).

2. At agent startup:
   rebalancing auth login -e $REBALANCING_EMAIL -p $REBALANCING_PASSWORD
   export REBALANCING_API_TOKEN=$(rebalancing auth whoami --json | jq -r '.tokenPreview')
   # Note: whoami only shows a truncated token; login response has the full token.
   # Better: capture the token directly from login output:
   export REBALANCING_API_TOKEN=$(rebalancing auth login -e $EMAIL -p $PASS --json | jq -r '.token')

3. Rotate by re-running auth login before estimated token expiry.
   Add a health-check that calls `auth whoami` and re-auths on 401.
```

**Open question for engine team:** What is the token TTL? Does the engine support refresh tokens? This determines how much token lifecycle logic the client needs to implement.

## 5. Dependency on Engine Roadmap

The client's completeness as a Týr integration is partially gated by engine API evolution. The relevant engine milestones are:

| Engine Tranche | Client impact |
|----------------|---------------|
| Tranche 1 (core readiness) | `asOf` on prices exposed; audit timestamps accurate — both already surfaced via existing endpoints |
| Tranche 2 (orchestrator dry-run) | New event types in audit log; dry-run execution mode queryable |
| Tranche 3 (broker integration) | Write endpoints (trigger, pause, resume) needed by client |
| Tranche 4 (production hardening) | Persistent audit trail; richer log queries expected |

The client should track the engine's OpenAPI spec version (`src/types.ts` header comment) and update on each engine release.

## 6. Týr Integration Checklist

Before Týr can reliably use this client in production, the following must be true:

- [ ] **Token lifecycle** — either a documented TTL with rotation procedure, or a `refresh` command
- [ ] **Structured exit codes** — so Týr can branch on auth failure vs. not-found vs. network error
- [ ] **At least smoke tests** — so the output contract is not accidentally broken during maintenance
- [ ] **Write commands** — once the engine exposes mutation endpoints (trigger rebalance, cash flow submission)
- [ ] **Pagination for logs** — `--all` flag or equivalent for exhaustive audit queries
- [ ] **Published to npm** — `npm install -g @accordant/rebalancing-client` confirmed working, or a stable binary distribution path

Items that are nice-to-have but not blockers:
- `--pretty` output polish
- OpenAPI schema validation in CI
- Structured JSON error output to stderr

## 7. Open Questions

1. **Token TTL:** What is the token expiry? Does the engine support refresh tokens?
2. **Write endpoints:** Which mutation endpoints are planned in the next engine release, and what are their shapes?
3. **Binary name:** Is `rebalancing` the right long-term binary name, or should it be namespaced (e.g., `acc-rebalancing`)? (See BUILD_JOURNEY.md open questions.)
4. **Multi-portfolio:** Týr may need to monitor all portfolios simultaneously. Does the engine support a bulk drift check, or must the client iterate `portfolios list` + `portfolios drift` per entry?
5. **Webhook / event push:** Long-term, a push model (webhooks or SSE from the engine) would be more efficient than polling. Is that on the engine roadmap?
6. **Separate operator tool:** When write commands exist, should they live in this client or a separate higher-privilege tool with stricter audit requirements?

## Related

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — component architecture, structure, and output contract
- [docs/TYR-USAGE.md](./TYR-USAGE.md) — Týr usage patterns, heartbeat monitoring, and feature roadmap
- [docs/decisions/0001-cli-design-and-scope.md](./decisions/0001-cli-design-and-scope.md) — CLI design ADR
- [rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) — the engine this client talks to
- [Engine live-agent vision](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/architecture/live-agent-vision.md)
- [Engine roadmap](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/roadmap/rebalancing-engine-roadmap.md)

---

© 2026 Johan Hellman. All rights reserved.
