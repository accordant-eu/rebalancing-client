import { Command } from "commander";
import { getPrices } from "../client.js";
import { printOutput, printError, type OutputFormat } from "../output.js";

export function registerPricesCommands(program: Command): void {
  program
    .command("prices")
    .description("Get the current price snapshot")
    .option("--json", "Output as JSON (default)")
    .option("--pretty", "Human-readable output")
    .action(async (opts: { json?: boolean; pretty?: boolean }) => {
      const format: OutputFormat = opts.pretty ? "pretty" : "json";
      try {
        const data = await getPrices();
        if (format === "pretty") {
          console.log(`As of: ${data.asOf}`);
          console.log("");
          for (const [ticker, price] of Object.entries(data.prices).sort()) {
            console.log(`  ${ticker.padEnd(10)} $${price.toFixed(4)}`);
          }
        } else {
          printOutput(data, "json");
        }
      } catch (err) {
        printError(String(err));
        process.exit(1);
      }
    });
}
