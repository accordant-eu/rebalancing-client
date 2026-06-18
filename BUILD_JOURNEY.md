# Build Journey — rebalancing-client

A running record of decisions made during the build of this tool.
Informed by the same discipline as the rebalancing engine: record why, not just what.

---

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Public repo | The source code of the engine is public and the API spec has no secrets. A public client is a natural complement; it makes the project useful to anyone running a self-hosted engine instance. |
| 2 | TypeScript CLI with Commander | Matches the engine's stack. Commander is minimal, well-maintained, and produces clean help output. Avoids framework lock-in — the command tree is just functions. |
| 3 | No Docker | A CLI is locally installed, not a service. Docker would add complexity with no benefit. Dev uses `tsx src/cli.ts`; distribution uses compiled `node dist/cli.js`. |
| 4 | JSON output by default | Agent pipelines (Týr) consume this tool programmatically. JSON is the lowest-friction output for machines. `--pretty` is the opt-in for humans. stdout = data, stderr = errors — always. |
| 5 | Credentials via env + local config file | `REBALANCING_API_TOKEN` / `REBALANCING_API_URL` for non-interactive use (CI, agents). `~/.rebalancing-client/config.json` (chmod 600) for interactive use after `auth login`. Env always wins. |
| 6 | No write/mutation commands in v0.1 | The engine's current API is read-only (auth + reads). Write commands will be added as the API adds mutation endpoints. Keeping scope narrow avoids premature design. |
| 7 | Tracks API spec, not engine source | The client depends on the published OpenAPI spec, not on internal engine types. This keeps the repos independently releasable and avoids tight coupling. |
| 8 | `--passWithNoTests` at scaffold | Repo ships with no tests on day one. The CI gate is typecheck + build; Jest is wired up so tests can be added incrementally without any structural change. |
| 9 | ESLint 9 + `@typescript-eslint` v8 | ESLint 9 is the current major; v7 of the TS-eslint packages requires ESLint ^8 (peer conflict). v8 supports ESLint 9 cleanly. |

---

## Open questions

- Should `auth login` support OAuth / device flow in addition to email+password once the engine supports it?
- Is `rebalancing` the right binary name long-term, or should it be namespaced (e.g. `acc-rebalancing`)?
- When the engine adds write endpoints (trigger rebalance, submit cash flow), should they go in this client or a separate operator tool?
