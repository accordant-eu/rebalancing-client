---
type: Architecture
title: Client Architecture
description: Architecture of the rebalancing-client — structure, design decisions, and production gaps
tags: [architecture, integration]
timestamp: 2026-06-20T00:00:00Z
---

# rebalancing-client — Architecture

Date: 2026-06-20

## 1. Purpose and Position in the System

The rebalancing-client is the **CLI interface to the rebalancing engine REST API**. It sits at the boundary between the engine's HTTP layer and its two consumer types: Týr (an autonomous AI agent pipeline) and human operators.

```text
┌──────────────────────────────────────────────────────────┐
│                   CONSUMERS                              │
│                                                          │
│   ┌──────────────────────┐   ┌──────────────────────┐   │
│   │         Týr          │   │   Human operator     │   │
│   │  (AI agent pipeline) │   │  (terminal session)  │   │
│   └────────┬─────────────┘   └───────────┬──────────┘   │
│            │  JSON stdout / exit codes   │ --pretty      │
└────────────┼────────────────────────────┼───────────────┘
             │                            │
             ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│                  rebalancing-client CLI                  │
│                                                          │
│   auth  ·  portfolios  ·  logs  ·  prices                │
│   ─────────────────────────────────────────────          │
│   src/cli.ts (Commander entrypoint)                      │
│   src/client.ts (HTTP client + config)                   │
│   src/types.ts (OpenAPI-derived types)                   │
│   src/output.ts (stdout / stderr / format helpers)       │
│   src/commands/ (one file per command group)             │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS (Bearer token)
                       ▼
┌──────────────────────────────────────────────────────────┐
│              rebalancing engine REST API                 │
│         https://app.rebalancing.accordant.eu             │
│                                                          │
│   /api/auth/login                                        │
│   /api/portfolios                                        │
│   /api/portfolios/:id                                    │
│   /api/portfolios/:id/drift                              │
│   /api/portfolios/:id/proposals                          │
│   /api/logs                                              │
│   /api/prices                                            │
│   /api/docs/openapi.json                                 │
└──────────────────────────────────────────────────────────┘
```

## 2. Repository Structure

```text
rebalancing-client/
├── src/
│   ├── cli.ts                  # Commander program; registers all command groups
│   ├── client.ts               # HTTP client, config load/save, API functions
│   ├── types.ts                # TypeScript types matching engine OpenAPI spec v0.9.0
│   ├── output.ts               # printOutput / printError / printSuccess helpers
│   └── commands/
│       ├── auth.ts             # auth login / whoami / logout
│       ├── portfolios.ts       # portfolios list / get / drift / proposals
│       ├── logs.ts             # logs (paginated, filtered)
│       └── prices.ts           # prices
├── docs/
│   ├── ARCHITECTURE.md         # this file
│   ├── INTEGRATION.md          # integration guide for Týr and agent pipelines
│   └── decisions/
│       └── 0001-cli-design-and-scope.md
├── AGENTS.md                   # AI agent development rules
├── BUILD_JOURNEY.md            # running decision log
├── CHANGELOG.md                # version history
├── DEPLOYMENT.md               # deployment notes (Rufus / Accordant infra)
└── README.md                   # quickstart
```

## 3. Component Responsibilities

### `src/cli.ts` — Entrypoint

Registers all command groups against the Commander program. Reads `package.json` for version metadata. No business logic.

### `src/client.ts` — HTTP Client and Configuration

- Config resolution: `REBALANCING_API_URL` / `REBALANCING_API_TOKEN` env vars take priority over `~/.rebalancing-client/config.json`.
- `loadConfig()` / `saveConfig()` / `clearConfig()` manage the local credential store (chmod 600).
- `request<T>()` is the single generic HTTP transport: sets `Authorization: Bearer`, handles non-OK responses, maps API error bodies to `ApiClientError`.
- One named export function per API endpoint: `login`, `listPortfolios`, `getPortfolio`, `getPortfolioDrift`, `getPortfolioProposals`, `getLogs`, `getPrices`.

### `src/types.ts` — Type Definitions

Mirrors the engine's OpenAPI spec (`/api/docs/openapi.json`). Source of truth for response shapes consumed by commands. Kept in sync with engine API versions via CHANGELOG discipline (see AGENTS.md §2).

### `src/output.ts` — Output Contract

Enforces the invariant: **stdout = data, stderr = errors, exit 0 = success, exit 1 = error**.

- `printOutput(data, "json")` — JSON to stdout (default, agent-friendly)
- `printOutput(data, "pretty")` — human-formatted to stdout (`--pretty` opt-in)
- `printError(message)` — error message to stderr
- Commands call `process.exit(1)` on any caught error

### `src/commands/` — Command Implementations

Each file registers a command group and delegates to `client.ts` for data and `output.ts` for rendering. No HTTP logic in commands; no business logic in client.

## 4. Auth Model

```text
Priority  Source                                     Use case
────────  ─────────────────────────────────────────  ──────────────────────────────
1 (high)  REBALANCING_API_TOKEN env var              Agents, CI, scripts
2         ~/.rebalancing-client/config.json          Interactive terminal sessions
```

The env-var path is designed for Týr and other agents: token is injected at runtime, no filesystem operations needed. The config file path is for interactive human sessions after `auth login`.

Tokens are never printed in full; output always shows first 12 characters + ellipsis.

## 5. Output Contract (Invariants)

These are the stability guarantees that agent consumers depend on. They must not be violated.

| Channel | Content |
|---------|---------|
| stdout  | Structured data only — JSON (default) or pretty-formatted data |
| stderr  | Error messages only (`Error: <message>`) |
| exit 0  | Success |
| exit 1  | Any error |

JSON output is deterministic and machine-parseable. `--pretty` output is for human readability and is not a parsing target.

## 6. Environment Variables

| Variable              | Effect                                  | Default                              |
|-----------------------|-----------------------------------------|--------------------------------------|
| `REBALANCING_API_URL` | Overrides the API base URL              | `https://app.rebalancing.accordant.eu` |
| `REBALANCING_API_TOKEN` | Uses this token directly, skips config | — |

## 7. Current State Assessment (v0.1.0)

### What exists

- Authentication: `auth login`, `auth whoami`, `auth logout`
- All read endpoints from engine API v0.9.0:
  - Portfolio list, detail, drift breakdown, trade proposals
  - Paginated + filtered audit log
  - Price snapshot
- JSON-by-default output with `--pretty` flag
- Config persistence + env override
- TypeScript types matching OpenAPI spec
- ESLint + typecheck + Jest infrastructure (no tests yet)

### What is missing for production use

See [docs/INTEGRATION.md](./INTEGRATION.md) for the integration-focused gap assessment and checklist, and [docs/TYR-USAGE.md](./TYR-USAGE.md) for Týr's usage patterns and feature roadmap. From a pure architecture perspective, the main gaps are:

1. **No write/mutation commands** — the engine has mutation endpoints (trigger rebalance, submit cash flow); the client does not expose them yet. Tracked as an open question in BUILD_JOURNEY.md.
2. **No test coverage** — `--passWithNoTests` scaffolded; no actual tests exist. The output contract invariants are undocumented as runnable assertions.
3. **No token refresh** — tokens expire; there is no refresh logic. Agents that run continuously will silently fail with 401 and must restart the auth flow.
4. **`--pretty` output is stub-level** — `printPretty` in `output.ts` falls back to pretty-printed JSON for most commands; only `portfolios drift`, `portfolios list`, and a few others have real formatting.
5. **No OpenAPI schema validation** — types are hand-maintained. Schema drift between engine and client is a latent bug risk.
6. **No pagination helper** — `logs` supports `--limit` / `--offset` but callers must manage iteration manually.
7. **No structured error codes** — `ApiClientError` carries `status` and `body`, but commands only surface `String(err)` to stderr.

## 8. Design Principles

Captured from AGENTS.md and BUILD_JOURNEY.md:

1. **JSON is the agent contract.** Default output is machine-readable. Never change the default without explicit decision.
2. **Track the spec, not the engine source.** Client depends on the published OpenAPI spec (`types.ts`); internal engine changes that don't touch the spec don't affect the client.
3. **No write commands before the API has write endpoints.** Scope is narrow by design.
4. **Commander is the CLI framework.** No complex CLI framework; command tree is just functions.
5. **Env over config file.** Agents operate in controlled environments; env injection is the correct model. Config file is a human convenience.

## 9. Relation to the Broader Agent Architecture

The engine's live-agent vision (see `rebalancing-engine/docs/architecture/live-agent-vision.md`) places the engine inside an orchestration loop: price feeds → Live State Manager → rebalancing engine → execution layer. The client is not part of that loop — it is the **observation and diagnostic interface** to that loop.

Týr's integration pattern is:

- **Monitoring:** Periodically call `portfolios list` or `portfolios drift` to surface drift state without requiring full orchestrator integration.
- **Alerting:** Query `logs` filtered by `CIRCUIT_BREAKER_HALT`, `THRESHOLD_BREACH` for anomaly detection.
- **Reporting:** Combine `portfolios get`, `portfolios proposals`, and `prices` into portfolio status summaries.
- **Operational triggers:** When write endpoints exist, trigger rebalances or submit cash flows on behalf of the operator.

The client intentionally does not contain orchestration logic. It is a thin, stable I/O surface.

## Related

- [docs/INTEGRATION.md](./INTEGRATION.md) — production gap assessment and Týr integration checklist
- [docs/TYR-USAGE.md](./TYR-USAGE.md) — Týr usage patterns, feature roadmap, and agent conventions
- [docs/decisions/0001-cli-design-and-scope.md](./decisions/0001-cli-design-and-scope.md) — CLI design ADR
- [rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) — the engine this client talks to
- [API docs](https://app.rebalancing.accordant.eu/api/docs) — live Swagger UI
- [Engine architecture overview](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/architecture/overview.md)
- [Engine live-agent vision](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/architecture/live-agent-vision.md)

---

© 2026 Johan Hellman. All rights reserved.
