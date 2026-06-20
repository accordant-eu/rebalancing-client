# Changelog

## 0.1.1 — 2026-06-20

### Fixed

- **Structured exit codes** — commands now exit with differentiated codes for agent consumers:
  - `0` success
  - `1` general / network error
  - `2` auth failure (401/403)
  - `3` not found (404)
  - `4` validation error (400/422)
  - `5` server error (5xx)
- `auth whoami` without credentials now exits `2` (auth failure) instead of `1`

### Added

- `docs/exit-codes.md` — canonical reference for exit code scheme
- `docs/ARCHITECTURE.md`, `docs/INTEGRATION.md`, `docs/TYR-USAGE.md`, `docs/TYR-PRODUCTION-READINESS.md` — full Týr integration documentation suite
- `handleCommandError()` helper in `src/output.ts` for consistent error mapping across all commands

### GitHub Issues Filed (rebalancing-engine)

- [#29](https://github.com/accordant-eu/rebalancing-engine/issues/29) — SSE event stream for real-time portfolio state changes
- [#30](https://github.com/accordant-eu/rebalancing-engine/issues/30) — `GET /api/portfolios/summary` aggregate endpoint
- [#31](https://github.com/accordant-eu/rebalancing-engine/issues/31) — Write endpoints: trigger rebalance, circuit-breaker reset, cash-flow submission
- [#32](https://github.com/accordant-eu/rebalancing-engine/issues/32) — Token TTL documentation and refresh token support

---

## 0.1.0 — 2026-06-18

Initial scaffold.

### Commands

- `auth login` — authenticate and store token
- `auth whoami` — show current credentials
- `auth logout` — clear stored credentials
- `portfolios list` — list all portfolios with drift status
- `portfolios get <id>` — full portfolio detail
- `portfolios drift <id>` — drift breakdown per instrument
- `portfolios proposals <id>` — recent trade proposals
- `logs` — paginated, filtered audit log
- `prices` — current price snapshot

### Notes

- JSON output by default; `--pretty` for human-readable terminal output.
- Credentials via `~/.rebalancing-client/config.json` or `REBALANCING_API_TOKEN` env.
- Tracks rebalancing engine API v0.9.0.
