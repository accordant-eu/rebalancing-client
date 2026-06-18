# AI Agent Rules: rebalancing-client

These rules govern AI-assisted development in this repository.

## 1. Repository Stewardship

- Inspect before changing.
- Prefer small, reviewable changes.
- Preserve existing conventions unless there is a clear reason to change them.
- Keep generated files out of source control (`dist/`, `node_modules/`).

## 2. API Compatibility

- The client tracks the rebalancing engine OpenAPI spec in `src/types.ts`.
- When the engine releases a breaking change, update `types.ts` and increment the
  package minor version. Document the change in CHANGELOG.md.
- Do not add undocumented endpoints or parameters — match the spec exactly.

## 3. Output Contract

- **JSON is the default output for all commands.** This is the agent-friendly contract.
  Do not change default output to human-readable without explicit instruction.
- `--pretty` is the opt-in for human-readable terminal output.
- stdout = data. stderr = errors. Exit code 0 = success, 1 = error.
- Never mix error text into stdout — tools that parse stdout will break.

## 4. Auth & Credentials

- Tokens are stored in `~/.rebalancing-client/config.json` (chmod 600).
- `REBALANCING_API_TOKEN` env var always overrides stored config.
- Never log or print full tokens. Always truncate in output (first 12 chars + ellipsis).
- Never hardcode credentials or base URLs in source.

## 5. Decision Discipline

- Record meaningful decisions as ADR files in `docs/decisions/`.
- Mark uncertain decisions as provisional.
- Prefer reversible choices.
