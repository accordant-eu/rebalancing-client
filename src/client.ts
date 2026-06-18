/**
 * HTTP client for the rebalancing engine API.
 *
 * Configuration (env vars):
 *   REBALANCING_API_URL    Base URL (default: https://app.rebalancing.accordant.eu)
 *   REBALANCING_API_TOKEN  Bearer token — set after `auth login`, or supply directly
 *
 * Tokens are also persisted to ~/.rebalancing-client/config.json by the auth command.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  AuthResponse,
  Portfolio,
  DriftBreakdown,
  ProposalsResponse,
  LogsResponse,
  PricesResponse,
  ApiError,
} from "./types.js";

const DEFAULT_BASE_URL = "https://app.rebalancing.accordant.eu";
const CONFIG_DIR = join(homedir(), ".rebalancing-client");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface StoredConfig {
  baseUrl?: string;
  token?: string;
  tenantId?: string;
  role?: string;
}

export function loadConfig(): StoredConfig {
  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as StoredConfig;
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config: StoredConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) writeFileSync(CONFIG_FILE, "{}", { mode: 0o600 });
}

function resolveBaseUrl(): string {
  return (
    process.env.REBALANCING_API_URL ??
    loadConfig().baseUrl ??
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
}

function resolveToken(): string | undefined {
  return process.env.REBALANCING_API_TOKEN ?? loadConfig().token;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const baseUrl = resolveBaseUrl();
  const resolvedToken = token ?? resolveToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (resolvedToken) headers["Authorization"] = `Bearer ${resolvedToken}`;

  const url = `${baseUrl}${path}`;
  let res: Response;

  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(`Network error reaching ${baseUrl}: ${String(err)}`);
  }

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    const code = body?.error?.code ?? String(res.status);
    const msg = body?.error?.message ?? res.statusText;
    throw new ApiClientError(`${code}: ${msg}`, res.status, body);
  }

  return res.json() as Promise<T>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiError
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ── Portfolios ────────────────────────────────────────────────────────────────

export async function listPortfolios(): Promise<Portfolio[]> {
  return request<Portfolio[]>("/api/portfolios");
}

export async function getPortfolio(id: string): Promise<Portfolio> {
  return request<Portfolio>(`/api/portfolios/${encodeURIComponent(id)}`);
}

export async function getPortfolioDrift(id: string): Promise<DriftBreakdown> {
  return request<DriftBreakdown>(
    `/api/portfolios/${encodeURIComponent(id)}/drift`
  );
}

export async function getPortfolioProposals(
  id: string,
  limit = 20
): Promise<ProposalsResponse> {
  return request<ProposalsResponse>(
    `/api/portfolios/${encodeURIComponent(id)}/proposals?limit=${limit}`
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export interface LogsParams {
  portfolioId?: string;
  since?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export async function getLogs(params: LogsParams = {}): Promise<LogsResponse> {
  const qs = new URLSearchParams();
  if (params.portfolioId) qs.set("portfolioId", params.portfolioId);
  if (params.since) qs.set("since", params.since);
  if (params.type) qs.set("type", params.type);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<LogsResponse>(`/api/logs${query}`);
}

// ── Prices ────────────────────────────────────────────────────────────────────

export async function getPrices(): Promise<PricesResponse> {
  return request<PricesResponse>("/api/prices");
}
