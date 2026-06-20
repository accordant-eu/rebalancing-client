---
type: Reference
title: Exit Codes
description: Documented exit code scheme for rebalancing-client — enables agent consumers (Týr) to branch on error type
tags: [cli, exit-codes, agent-integration, reference]
timestamp: 2026-06-20T00:00:00Z
---

# Exit Codes — rebalancing-client

All rebalancing-client commands exit with a numeric code that encodes the outcome. Agent consumers (Týr, CI scripts) should branch on exit code rather than parsing stderr.

---

## Code Table

| Code | Meaning | HTTP equivalent | Agent action |
|------|---------|-----------------|-------------|
| `0` | Success | 2xx | Parse stdout as JSON; proceed |
| `1` | General / network error | — | Surface as unexpected failure; retry with backoff |
| `2` | Auth failure | 401 | Token expired or invalid; re-authenticate before retrying |
| `3` | Not found | 404 | Portfolio / resource does not exist; check ID |
| `4` | Validation / bad request | 400 | Client sent bad input; do not retry without fixing params |
| `5` | Server error | 5xx | Engine-side fault; surface to operator, retry later |

---

## Implementation Status

> **⚠ Current state (v0.1.0):** All errors exit `1`. The structured scheme above is the _target_ — it is not yet implemented. This is gap **G2** in `docs/TYR-PRODUCTION-READINESS.md` and is classified **Critical**.
>
> Tracking issue: [accordant-eu/rebalancing-client #TBD — Implement structured exit codes](https://github.com/accordant-eu/rebalancing-client/issues) — to be raised.

Once implemented, `ApiClientError.status` will be mapped to the appropriate exit code in a central error handler rather than uniformly calling `process.exit(1)`.

---

## Usage Examples

### Týr agent branching

```bash
rebalancing portfolios drift "$PORTFOLIO_ID"
STATUS=$?

case $STATUS in
  0) echo "OK — parsing drift data" ;;
  2) echo "AUTH_FAILURE — need token refresh"; rebalancing auth login -e "$EMAIL" -p "$PASS" ;;
  3) echo "NOT_FOUND — portfolio $PORTFOLIO_ID does not exist" ;;
  5) echo "SERVER_ERROR — engine is unhealthy; alerting operator" ;;
  *) echo "UNEXPECTED — exit code $STATUS; escalating" ;;
esac
```

### CI health check script

```bash
set -e

rebalancing portfolios list > /dev/null
if [ $? -ne 0 ]; then
  echo "::error::rebalancing-client health check failed"
  exit 1
fi
```

### Token expiry detection

```bash
rebalancing prices
if [ $? -eq 2 ]; then
  # Token expired — refresh before continuing
  export REBALANCING_API_TOKEN=$(
    rebalancing auth login -e "$REBALANCING_EMAIL" -p "$REBALANCING_PASSWORD" --json \
      | jq -r '.token'
  )
fi
```

---

## Stderr Error Format

On any non-zero exit, a human-readable error message is written to **stderr**:

```
Error: <message>
```

When `--json` is active (future enhancement), structured JSON will be written to stderr instead:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token expired or invalid",
    "exitCode": 2
  }
}
```

This allows agent parsers to extract both the exit code and the structured reason without string-matching stderr.

---

## Design Notes

- **stdout is never used for errors.** Errors go to stderr. Exit code + stderr is the full error surface.
- **Exit code 1 is the fallback** for anything not classified by the scheme (network errors, unexpected responses, internal bugs).
- **Exit code 2 is the most actionable** for long-running agents — it unambiguously signals "get a new token" without requiring stderr parsing.
- **Exit code 5** signals an engine-side fault that the client cannot resolve. Agents should alert the operator and back off.

---

## Related

- [`docs/INTEGRATION.md`](./INTEGRATION.md) §3.4 — original exit code scheme proposal
- [`docs/TYR-PRODUCTION-READINESS.md`](./TYR-PRODUCTION-READINESS.md) §4 — G2 gap classification
- [`src/client.ts`](../src/client.ts) — `ApiClientError` class (carries `status`)
- [`src/output.ts`](../src/output.ts) — `printError` helper

---

*© 2026 Johan Hellman. All rights reserved.*
