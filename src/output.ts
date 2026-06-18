/**
 * Output helpers.
 *
 * Default: JSON (machine-readable, agent-friendly).
 * --pretty: human-formatted tables/text for terminal use.
 */

export type OutputFormat = "json" | "pretty";

export function printOutput(data: unknown, format: OutputFormat): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else {
    printPretty(data);
  }
}

function printPretty(data: unknown): void {
  // Fallback: pretty-print JSON. Individual commands can override this
  // by calling their own formatted output before reaching here.
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printError(message: string): void {
  process.stderr.write(`Error: ${message}\n`);
}

export function printSuccess(message: string): void {
  process.stdout.write(`${message}\n`);
}
