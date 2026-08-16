# Implementation Plan for `rebalancing-client`

## Objective
Bring the `rebalancing-client` into full parity with the `rebalancing-engine` API and resolve outstanding technical debt (Issue #25).

## Priority 1: Address Open Tech Debt (Issue #25)
**Scope**: Refactor `DriftBreakdown` and `CircuitBreakerState` to discriminated unions.
- **Commit 1**: Update `src/types.ts` to implement discriminated unions for `DriftBreakdown` (rebalanceDue/reason) and `CircuitBreakerState` (status/reason/lastTrippedAt).
- **Commit 2**: Update `src/commands/portfolios.ts` rendering logic to satisfy the new strict type constraints.

## Priority 2: Type Parity with Engine
**Scope**: Sync `src/types.ts` with engine OpenAPI additions.
- **Commit 3**: Add `taxJurisdiction` to `Portfolio` interface.
- **Commit 4**: Add `tax_aware_us` to `strategyType` union.

## Priority 3: New API Client Methods
**Scope**: Extend `src/client.ts` to support missing operations.
- **Commit 5**: Implement `getPortfolioSummary()`, `triggerRebalance(id, dryRun)`, `resetCircuitBreaker(id)`, and `submitCashflow(id, amount, direction)`.
- **Commit 6**: Add unit tests for the new client methods (using the mocked fetch).

## Priority 4: CLI Commands
**Scope**: Expose new operations in the CLI.
- **Commit 7**: Add `rebalancing portfolios summary`.
- **Commit 8**: Add `rebalancing portfolios trigger <id> [--dry-run]`.
- **Commit 9**: Add `rebalancing portfolios reset-breaker <id>`.
- **Commit 10**: Add `rebalancing portfolios add-cashflow <id> <amount> <direction>`.

## Priority 5: Documentation
**Scope**: Ensure CLI usage is documented.
- **Commit 11**: Update `README.md` adding documentation for `summary`, `trigger`, `reset-breaker`, and `add-cashflow` commands.

*Note: Administrative and queue endpoints are intentionally deferred for a later dedicated Admin CLI tranche, keeping this client focused on portfolio operations.*