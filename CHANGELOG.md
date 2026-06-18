# Changelog

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
