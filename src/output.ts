/**
 * Output helpers.
 *
 * Default: JSON (machine-readable, agent-friendly).
 * --pretty: human-formatted tables/text for terminal use.
 *
 * Exit code scheme (see docs/exit-codes.md):
 *   0 = success
 *   1 = general / network error
 *   2 = auth failure (401)
 *   3 = not found (404)
 *   4 = validation / bad request (400)
 *   5 = server error (5xx)
 */

import { ApiClientError } from "./client.js";

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

/**
 * Map an error to a structured exit code and print to stderr.
 * Commands should call this instead of `printError(String(err))` + `process.exit(1)`.
 *
 * Exit codes:
 *   0 = success
 *   1 = general / network error
 *   2 = auth failure (401)
 *   3 = not found (404)
 *   4 = validation / bad request (400)
 *   5 = server error (5xx)
 */
export function handleCommandError(err: unknown): never {
  if (err instanceof ApiClientError) {
    const { status } = err;
    process.stderr.write(`Error: ${err.message}\n`);
    if (status === 401 || status === 403) process.exit(2);
    if (status === 404) process.exit(3);
    if (status === 400 || status === 422) process.exit(4);
    if (status >= 500) process.exit(5);
    process.exit(1);
  }
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(1);
}
