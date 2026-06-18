# rebalancing-client

CLI client for the [rebalancing engine](https://github.com/accordant-eu/rebalancing-engine) API.

Covers all read endpoints needed to query portfolio state, drift, proposals, audit logs, and prices. Output is JSON by default — making it directly usable in agent pipelines (Týr) and shell scripts.

## Install

```bash
npm install -g @accordant/rebalancing-client
```

Or run locally without installing:

```bash
git clone https://github.com/accordant-eu/rebalancing-client
cd rebalancing-client
npm install
npm run dev -- --help
```

## Quick start

```bash
# Authenticate (token stored at ~/.rebalancing-client/config.json)
rebalancing auth login -e you@example.com -p yourpassword

# List portfolios (JSON, machine-readable)
rebalancing portfolios list

# Drift breakdown, human-readable
rebalancing portfolios drift my-portfolio --pretty

# Filter audit log: last 7 days of live executions
rebalancing logs \
  --portfolio my-portfolio \
  --since 2026-06-11T00:00:00Z \
  --type LIVE_EXECUTION \
  --pretty

# Prices as JSON, pipe to jq
rebalancing prices | jq '.prices.AAPL'
```

## Configuration

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `REBALANCING_API_URL` | API base URL | `https://app.rebalancing.accordant.eu` |
| `REBALANCING_API_TOKEN` | Bearer token (overrides stored config) | — |

Env vars take priority over stored config. Useful for CI, scripts, and agent integrations.

### Stored config

After `auth login`, credentials are stored at `~/.rebalancing-client/config.json` (chmod 600). Use `auth logout` to clear.

## Commands

```
rebalancing auth login        Authenticate and store token
rebalancing auth whoami       Show current credentials
rebalancing auth logout       Clear stored credentials

rebalancing portfolios list                  List all portfolios with drift status
rebalancing portfolios get <id>              Full portfolio detail
rebalancing portfolios drift <id>            Drift breakdown per instrument
rebalancing portfolios proposals <id>        Recent trade proposals [--limit N]

rebalancing logs                             Query audit log
  --portfolio <id>                           Filter by portfolio
  --since <ISO-8601>                         Lower timestamp bound
  --type <event-type>                        Filter by event type (see below)
  --limit <n>                                Max records (default: 50)
  --offset <n>                               Pagination offset

rebalancing prices                           Current price snapshot
```

### Audit event types

`DRY_RUN_EXECUTION` · `LIVE_EXECUTION` · `CIRCUIT_BREAKER_HALT` · `RECONCILIATION_PAUSE` · `THRESHOLD_BREACH` · `REBALANCE_NOT_DUE`

## Output

All commands output JSON by default. Pass `--pretty` for human-readable terminal output.

```bash
# Default: JSON (machine-readable)
rebalancing portfolios list

# Human-readable
rebalancing portfolios drift my-portfolio --pretty
```

stdout carries data. stderr carries errors. Exit code 0 = success, 1 = error.

## Development

```bash
npm install
npm run dev -- portfolios list --pretty   # Run without building
npm run typecheck                          # Type-check
npm run build                             # Compile to dist/
npm test                                  # Run tests
```

## API compatibility

Tracks rebalancing engine API **v0.9.0**. See [CHANGELOG.md](CHANGELOG.md) for version history.

The engine's OpenAPI spec is at `GET /api/docs/openapi.json`.

## Related

- [rebalancing-engine](https://github.com/accordant-eu/rebalancing-engine) — the engine this client talks to
- [API docs](https://app.rebalancing.accordant.eu/api/docs) — hosted Swagger UI
