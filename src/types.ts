// Types matching the rebalancing engine OpenAPI spec (v0.9.0)
// Source: https://app.rebalancing.accordant.eu/api/docs/openapi.json

export interface AuthResponse {
  token: string;
  tenantId: string;
  role: string;
}

export interface Holding {
  instrumentId: string;
  quantity: number;
  currentWeight: number;
  targetWeight: number;
  driftPct: number;
}

export type DriftStatus = "in_band" | "threshold_breach" | "not_evaluated";

export interface Portfolio {
  accountId: string;
  tenantId: string;
  modelId: string | null;
  totalValue: number;
  cash: number;
  lastEvaluatedAt: string;
  driftStatus: DriftStatus;
  holdings: Holding[];
  // Detail endpoint only:
  pendingCashFlows?: CashFlow[];
  circuitBreakerStatus?: CircuitBreakerState;
  lastProposal?: TradeProposal | null;
}

export interface DriftInstrument {
  instrumentId: string;
  currentWeight: number;
  targetWeight: number;
  absoluteDrift: number;
  relativeDrift: number;
  thresholdBreach: boolean;
}

export interface DriftBreakdown {
  accountId: string;
  evaluatedAt: string;
  strategyType: "threshold" | "calendar" | "manual";
  rebalanceDue: boolean;
  reason: string | null;
  driftByInstrument: DriftInstrument[];
}

export interface Trade {
  instrumentId: string;
  direction: "BUY" | "SELL";
  quantity: number;
  estimatedPrice: number;
  estimatedValue: number;
}

export interface TradeProposal {
  proposedAt: string;
  executionMode: "full_reset" | "boundary_band" | "dry_run";
  executed: boolean;
  trades: Trade[];
  warnings: string[];
}

export interface ProposalsResponse {
  accountId: string;
  proposals: TradeProposal[];
}

export type AuditEventType =
  | "DRY_RUN_EXECUTION"
  | "LIVE_EXECUTION"
  | "CIRCUIT_BREAKER_HALT"
  | "RECONCILIATION_PAUSE"
  | "THRESHOLD_BREACH"
  | "REBALANCE_NOT_DUE";

export interface AuditRecord {
  eventId: string;
  createdAt: string;
  accountId: string;
  type: AuditEventType | string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface LogsResponse {
  total: number;
  data: AuditRecord[];
}

export interface PricesResponse {
  prices: Record<string, number>;
  asOf: string;
}

export interface CashFlow {
  cashFlowId: string;
  direction: "DEPOSIT" | "WITHDRAWAL";
  status: "PENDING" | "SETTLED";
  amount: number;
  effectiveDate: string;
}

export interface CircuitBreakerState {
  status: "OPEN" | "CLOSED" | "HALF_OPEN";
  reason: string | null;
  lastTrippedAt: string | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
