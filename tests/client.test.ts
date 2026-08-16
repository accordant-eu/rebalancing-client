import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getPortfolioSummary, getPortfolio } from "../src/client.js";

// Mock the global fetch
global.fetch = jest.fn();

describe("ApiClient", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("fetches portfolio summary correctly", async () => {
    const mockResponse = {
      asOf: "2026-08-16T10:00:00Z",
      meta: { total: 10, lastEvaluatedAt: null },
      driftSummary: { inBand: 8, thresholdBreach: 2, notEvaluated: 0 },
      totalAum: 1500000,
      openCircuitBreakers: 0,
      recentExecutions: { last24h: 3, last7d: 15 }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const summary = await getPortfolioSummary();
    expect(summary).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://app.rebalancing.accordant.eu/api/portfolios/summary",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" })
      })
    );
  });

  it("fetches a single portfolio correctly", async () => {
    const mockResponse = { accountId: "test-id", tenantId: "tenant-1", totalValue: 1000, cash: 100, lastEvaluatedAt: "2026-08-16T10:00:00Z", driftStatus: "in_band", holdings: [] };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const portfolio = await getPortfolio("test-id");
    expect(portfolio).toEqual(mockResponse);
  });
});