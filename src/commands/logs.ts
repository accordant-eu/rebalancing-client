import { Command } from "commander";
import { getLogs } from "../client.js";
import { printOutput, printError, type OutputFormat } from "../output.js";
import type { AuditEventType } from "../types.js";

const VALID_TYPES: AuditEventType[] = [
  "DRY_RUN_EXECUTION",
  "LIVE_EXECUTION",
  "CIRCUIT_BREAKER_HALT",
  "RECONCILIATION_PAUSE",
  "THRESHOLD_BREACH",
  "REBALANCE_NOT_DUE",
];

export function registerLogsCommands(program: Command): void {
  program
    .command("logs")
    .description("Query the audit log")
    .option("--portfolio <id>", "Filter by portfolio/account ID")
    .option("--since <iso>", "Filter events after this ISO-8601 timestamp (e.g. 2026-06-11T00:00:00Z)")
    .option(
      "--type <type>",
      `Filter by event type. Valid: ${VALID_TYPES.join(", ")}`
    )
    .option("--limit <n>", "Max records to return", "50")
    .option("--offset <n>", "Pagination offset", "0")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(
      async (opts: {
        portfolio?: string;
        since?: string;
        type?: string;
        limit: string;
        offset: string;
        json?: boolean;
        pretty?: boolean;
      }) => {
        const format: OutputFormat = opts.pretty ? "pretty" : "json";
        try {
          const data = await getLogs({
            portfolioId: opts.portfolio,
            since: opts.since,
            type: opts.type,
            limit: parseInt(opts.limit, 10),
            offset: parseInt(opts.offset, 10),
          });
          if (format === "pretty") {
            console.log(`Total: ${data.total}  Showing: ${data.data.length}`);
            console.log("");
            for (const r of data.data) {
              console.log(`${r.createdAt}  ${r.type.padEnd(28)}  ${r.accountId}`);
            }
          } else {
            printOutput(data, "json");
          }
        } catch (err) {
          printError(String(err));
          process.exit(1);
        }
      }
    );
}
