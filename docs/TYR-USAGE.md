---
type: Integration Guide
title: Týr Integration Guide — rebalancing-client
description: How Týr (the AI portfolio analyst agent) uses rebalancing-client, what makes it genuinely useful, and what gaps still need to be filled.
tags: [tyr, agent, integration, roadmap]
timestamp: 2026-06-20T00:00:00Z
---

# Týr Integration Guide

**Audience:** Developers building on rebalancing-client and anyone extending the engine's API with Týr in mind.

---

## 1. Who Is Týr?

Týr is the AI-powered investment analyst and executive assistant running on the same infrastructure as the rebalancing engine. Týr's role is to:

- Monitor portfolio health across all accounts
- Surface actionable insights proactively (drift warnings, circuit breaker events, unusual execution patterns)
- Answer natural-language questions about portfolio state, drift, and trade history
- Act as a second pair of eyes on the engine's autonomous decisions

Týr is **not** an execution agent — it does not trade. The engine trades. Týr observes, interprets, and advises.

The design intent is captured in the engine's first ADR: the CLI defaults to JSON on stdout so that Týr can parse it without fragile screen-scraping. That contract is foundational.

---

## 2. What Already Works

Týr can call every current command as a subprocess and parse stdout as JSON. The existing surface covers the key read-only questions:

| Question Týr can answer today | Command |
|---|---|
| Which portfolios are in drift breach right now? | `rebalancing portfolios list` → filter `driftStatus === "threshold_breach"` |
| What's the current weight vs target for each holding? | `rebalancing portfolios drift <id>` |
| What trades has the engine proposed and have they been executed? | `rebalancing portfolios proposals <id>` |
| Has the circuit breaker tripped recently? | `rebalancing portfolios get <id>` → `circuitBreakerStatus` |
| What did the engine do in the last N days? | `rebalancing logs --since <iso> --portfolio <id>` |
| What are current prices? | `rebalancing prices` |

For a simple daily briefing, the minimal pipeline is:

```bash
# Identify all portfolios with active drift breaches
rebalancing portfolios list \
  | jq '[.[] | select(.driftStatus == "threshold_breach")]'

# For each breaching portfolio, get the full drift breakdown
rebalancing portfolios drift <id>

# Check recent live executions (last 24h)
rebalancing logs \
  --type LIVE_EXECUTION \
  --since $(date -u -d '24 hours ago' +%FT%TZ)
```

Týr wraps these into natural-language summaries, flags anomalies, and surfaces them via Telegram.

---

## 3. What Makes This Genuinely Useful

The current CLI is a solid foundation. Here's what makes it genuinely valuable for Týr vs. being just a thin HTTP wrapper:

### 3.1 Stable JSON Contract

The `stdout = data / stderr = errors / exit 0|1` contract is the most important invariant. Týr can run any command, check exit code, and parse stdout directly. No fragile string matching, no format negotiation. This already works and must be preserved as new commands are added.

### 3.2 Composable with `jq`

Commands produce clean, flat JSON that can be piped into `jq` for filtering and transformation without any custom client logic on Týr's side. This keeps Týr's tooling simple.

### 3.3 Environment-Based Auth

`REBALANCING_API_TOKEN` allows Týr to operate in a sandboxed environment without touching the filesystem config. This is the right model for an agent.

---

## 4. Gaps — What's Missing Today

The current client covers read-only query. This is correct for v0.1 (the engine's API was read-oriented at that stage). But to be genuinely useful as an analyst assistant and to track the engine roadmap, the following gaps need to be filled.

### 4.1 No Alerting / Watch Mode (Most Critical Gap)

**The problem:** Týr currently has to poll to detect changes. To know that a circuit breaker just tripped, Týr must run `rebalancing portfolios list` repeatedly, diff the results, and notice the status change.

**What's needed:** A watch command (or structured event stream) that emits a JSON event to stdout when portfolio state changes. Týr subscribes and reacts.

```bash
# Proposed: stream events from all portfolios until Ctrl+C
rebalancing watch --portfolios all --events threshold_breach,circuit_breaker_halt

# Output: one JSON object per line as events arrive
{"event":"THRESHOLD_BREACH","accountId":"acc-001","at":"2026-06-20T14:22:00Z",...}
{"event":"CIRCUIT_BREAKER_HALT","accountId":"acc-002","at":"2026-06-20T14:22:15Z",...}
```

This requires the engine to expose a WebSocket or SSE endpoint. The client wraps it and emits NDJSON. Týr reads line-by-line.

Without this, Týr is always lagging behind reality by a polling interval.

### 4.2 No Aggregate / Cross-Portfolio Summary

**The problem:** `portfolios list` returns an array, but there's no aggregate view. To answer "what's the overall health of the book?" Týr has to do per-portfolio reads and synthesize manually.

**What's needed:** A `portfolios summary` command that returns cross-portfolio aggregates:

```json
{
  "asOf": "2026-06-20T14:30:00Z",
  "total": 12,
  "inBand": 9,
  "thresholdBreach": 2,
  "notEvaluated": 1,
  "totalAum": 2400000.00,
  "openCircuitBreakers": 1,
  "recentExecutions": { "last24h": 5, "last7d": 23 }
}
```

This is the fastest daily status check. One call, one number. If `thresholdBreach > 0` or `openCircuitBreakers > 0`, Týr escalates. Otherwise, one-liner summary to the owner.

### 4.3 No Write Commands (Pending Engine Mutation API)

**The problem:** Týr can observe but not act. As the engine adds write endpoints (roadmap v3), the client needs corresponding commands so Týr can:

- **Trigger a manual rebalance:** `rebalancing portfolios trigger-rebalance <id> --mode dry-run`
- **Reset a circuit breaker:** `rebalancing portfolios reset-circuit-breaker <id> --reason "reviewed manually"`
- **Submit a cash flow:** `rebalancing portfolios add-cashflow <id> --amount 10000 --direction DEPOSIT`
- **Update a model mandate:** `rebalancing models update <model-id> --file mandate.json`

These are write operations and must be added with appropriate `--dry-run` flags and audit trail confirmation output so Týr can narrate what it did.

**Priority order (matches engine API roadmap):**
1. Manual rebalance trigger (dry-run mode for safety)
2. Circuit breaker reset (with mandatory reason)
3. Cash flow submission
4. Model mandate updates (high-risk; require explicit confirmation)

### 4.4 No Price History / Stale Price Detection

**The problem:** `prices` returns the current snapshot, but Týr can't tell if the prices are stale. A price snapshot that's 3 hours old is dangerous for drift evaluation.

**What's needed:**
- `prices --instrument AAPL` for per-instrument filtering (avoid huge payloads)
- `prices --max-age-minutes 60` — exit 1 if `asOf` is older than the threshold (lets Týr detect stale feeds in scripts)
- Eventually: `prices history <instrument> --since <iso>` for trend context

### 4.5 No Execution Quality / Slippage Analysis

**The problem:** When the engine executes a LIVE_EXECUTION, the audit log records the estimated trade prices. The broker fills at actual prices. Currently there's no way to compare estimated vs actual, so Týr can't assess whether the engine's execution quality is good.

**What's needed (long-term):** A `proposals compare <id> --proposal-id <uuid>` command that, given a proposal ID, fetches the filled prices from the broker and produces a slippage breakdown. This depends on the engine's broker reconciliation features being built first (roadmap Tranche 4).

### 4.6 No Log Enrichment

**The problem:** The audit log returns `inputs` and `outputs` as opaque `Record<string, unknown>`. For LIVE_EXECUTION events, Týr must interpret raw JSON blobs to understand what happened.

**What's needed:** A `logs explain <event-id>` command that fetches a single audit record and renders a structured narrative of what the engine decided and why:

```json
{
  "eventId": "evt-abc123",
  "type": "LIVE_EXECUTION",
  "summary": "Rebalanced acc-001: sold 15 shares of AAPL (-3.2% → 25% target), bought 42 shares of BND",
  "triggerReason": "AAPL absolute drift exceeded 5% threshold",
  "tradesCount": 2,
  "estimatedNotional": 4250.00,
  "warnings": []
}
```

This can be built client-side if the log payload is well-structured — no engine changes needed.

---

## 5. Integration Architecture

### 5.1 How Týr Calls the CLI Today

Týr runs the CLI as a subprocess using the shell execution tool:

```bash
REBALANCING_API_TOKEN=<token> rebalancing portfolios list
```

stdout is parsed as JSON. Errors on stderr are surfaced as-is. Exit code 1 means something broke; Týr reports it.

Týr caches the token in its environment. It does not use the config file (`~/.rebalancing-client/config.json`) — env-based auth is the correct pattern for agents.

### 5.2 Heartbeat Monitoring Pattern

Týr runs a periodic check (2–4× per day) that:

1. Calls `portfolios list` → checks for `threshold_breach` or `not_evaluated` drift status
2. Calls `portfolios get <id>` for any breaching portfolio → checks `circuitBreakerStatus`
3. Calls `logs --type CIRCUIT_BREAKER_HALT --since <last-check-time>` → checks for new safety events
4. Calls `prices` → checks `asOf` timestamp for staleness

If anything notable is found, Týr sends a summary to the owner via Telegram. The format is a short bullet list — not a wall of JSON.

### 5.3 Natural Language Query Pattern

When the owner asks a question like "how is the portfolio doing?", Týr:

1. Calls `portfolios list` to get the high-level view
2. Calls `portfolios drift <id>` for each portfolio with meaningful drift
3. Calls `logs --since 7d --type LIVE_EXECUTION` to summarise recent activity
4. Synthesises into a narrative answer

The CLI's JSON output feeds directly into this synthesis. No transformation layer is needed.

### 5.4 Future: Watch Mode Integration

When the engine ships an event stream, Týr will maintain a long-running watch process in a tmux pane and react to events as they arrive:

```bash
rebalancing watch --portfolios all | while read -r event; do
  # Parse and route to Týr's event handler
  echo "$event" | tyr-handle-engine-event
done
```

---

## 6. Feature Roadmap (Prioritised)

The following additions are ordered by value to Týr's daily work.

### Phase 1 — High Value, Low Complexity (Now)

These can be added to the client against the current API with minimal engine changes.

| Feature | Command | Benefit |
|---|---|---|
| Cross-portfolio aggregate | `portfolios summary` | Single-call health check; enables concise daily briefings |
| Log enrichment | `logs explain <event-id>` | Human-readable audit entries; faster incident response |
| Stale price detection | `prices --max-age-minutes N` | Safety check in Týr's monitoring scripts |
| Per-instrument price filter | `prices --instrument <ticker>` | Reduces payload when checking specific holdings |
| Log `--since N days` shorthand | `--since 7d` | Convenience; avoids ISO-8601 date math in scripts |

### Phase 2 — High Value, Requires Engine API Work

| Feature | Command | Depends On |
|---|---|---|
| Manual rebalance trigger | `portfolios trigger-rebalance <id>` | Engine mutation endpoint |
| Circuit breaker reset | `portfolios reset-circuit-breaker <id>` | Engine mutation endpoint |
| Cash flow submission | `portfolios add-cashflow <id>` | Engine mutation endpoint |
| Event stream / watch mode | `watch` | Engine WebSocket or SSE endpoint |

### Phase 3 — Deeper Analytics

| Feature | Command | Depends On |
|---|---|---|
| Execution quality report | `proposals compare <id>` | Engine broker reconciliation (Tranche 4) |
| Price history | `prices history <instrument>` | Engine price history store |
| Mandate version diff | `models diff <id> --from <v> --to <v>` | Engine versioned mandates (roadmap v3) |

---

## 7. Conventions for New Commands

When adding commands that Týr will consume:

1. **Default to JSON.** Never change this. `--pretty` is opt-in.
2. **Include a `meta` field** in aggregate responses for timestamp and count context.
3. **Add `--since N[d|h|m]` shorthand** alongside `--since <iso>` — shell date arithmetic is fragile.
4. **Use `--dry-run` on all write commands.** Dry-run must output the same JSON shape as the live run, with an added `"dryRun": true` field. Týr uses dry-run output to narrate the intended action before asking for confirmation.
5. **Exit codes:** 0 = success, 1 = error, 2 = usage error, 3 = stale/degraded data (useful for monitoring scripts that distinguish between "broken" and "no data yet").

---

## 8. Security Notes for Agent Integration

- Týr uses `REBALANCING_API_TOKEN` only — never the config file.
- The token should be scoped to read-only access when write endpoints exist (until Týr is explicitly given write permissions).
- When write commands are added, they must require explicit `--confirm` flags so Týr cannot trigger mutations without an affirmative step in its reasoning.
- Týr should log every CLI call it makes (command, args, exit code, timestamp) to its daily memory file so there is a human-readable audit trail of agent actions independent of the engine's own audit log.

---

## Related

- [rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) — the engine this client observes
- [API docs](https://app.rebalancing.accordant.eu/api/docs) — live Swagger UI
- [Engine roadmap](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/roadmap/rebalancing-engine-roadmap.md)
- [Engine v3 exploration](https://github.com/accordant-eu/rebalancing-engine/blob/main/docs/roadmap/v3-exploration.md)
- [CLI design ADR](docs/decisions/0001-cli-design-and-scope.md)
