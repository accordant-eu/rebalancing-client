import { Command } from "commander";
import {
  listPortfolios,
  getPortfolio,
  getPortfolioDrift,
  getPortfolioProposals,
} from "../client.js";
import { printOutput, handleCommandError, type OutputFormat } from "../output.js";

export function registerPortfolioCommands(program: Command): void {
  const portfolios = program
    .command("portfolios")
    .description("Portfolio operations");

  portfolios
    .command("list")
    .description("List all portfolios with drift status")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(async (opts: { json?: boolean; pretty?: boolean }) => {
      const format: OutputFormat = opts.pretty ? "pretty" : "json";
      try {
        const data = await listPortfolios();
        if (format === "pretty") {
          for (const p of data) {
            console.log(
              `${p.accountId.padEnd(24)} ${p.driftStatus.padEnd(20)} $${p.totalValue.toFixed(2).padStart(14)}  model: ${p.modelId ?? "none"}`
            );
          }
        } else {
          printOutput(data, "json");
        }
      } catch (err) {
        handleCommandError(err);
      }
    });

  portfolios
    .command("get <id>")
    .description("Get full detail for a single portfolio")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(async (id: string, opts: { json?: boolean; pretty?: boolean }) => {
      const format: OutputFormat = opts.pretty ? "pretty" : "json";
      try {
        const data = await getPortfolio(id);
        printOutput(data, format);
      } catch (err) {
        handleCommandError(err);
      }
    });

  portfolios
    .command("drift <id>")
    .description("Show drift breakdown for a portfolio")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(async (id: string, opts: { json?: boolean; pretty?: boolean }) => {
      const format: OutputFormat = opts.pretty ? "pretty" : "json";
      try {
        const data = await getPortfolioDrift(id);
        if (format === "pretty") {
          console.log(`Portfolio: ${data.accountId}`);
          console.log(`Evaluated: ${data.evaluatedAt}  Strategy: ${data.strategyType}`);
          console.log(`Rebalance due: ${data.rebalanceDue}${data.reason ? `  Reason: ${data.reason}` : ""}`);
          console.log("");
          console.log(
            "Instrument".padEnd(16) +
            "Current".padStart(10) +
            "Target".padStart(10) +
            "AbsDrift".padStart(12) +
            "RelDrift".padStart(12) +
            "  Breach"
          );
          for (const d of data.driftByInstrument) {
            console.log(
              d.instrumentId.padEnd(16) +
              `${(d.currentWeight * 100).toFixed(2)}%`.padStart(10) +
              `${(d.targetWeight * 100).toFixed(2)}%`.padStart(10) +
              `${(d.absoluteDrift * 100).toFixed(2)}%`.padStart(12) +
              `${(d.relativeDrift * 100).toFixed(2)}%`.padStart(12) +
              `  ${d.thresholdBreach ? "⚠" : "✓"}`
            );
          }
        } else {
          printOutput(data, "json");
        }
      } catch (err) {
        handleCommandError(err);
      }
    });

  portfolios
    .command("proposals <id>")
    .description("Show recent trade proposals for a portfolio")
    .option("--limit <n>", "Number of proposals to return", "20")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(async (id: string, opts: { limit: string; json?: boolean; pretty?: boolean }) => {
      const format: OutputFormat = opts.pretty ? "pretty" : "json";
      try {
        const data = await getPortfolioProposals(id, parseInt(opts.limit, 10));
        printOutput(data, format);
      } catch (err) {
        handleCommandError(err);
      }
    });
}
