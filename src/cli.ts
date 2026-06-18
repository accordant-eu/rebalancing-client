#!/usr/bin/env node
/**
 * rebalancing-client — CLI for the rebalancing engine API
 *
 * Dev:  npm run dev -- <command> [options]
 * Prod: rebalancing <command> [options]
 *
 * Auth config: ~/.rebalancing-client/config.json (chmod 600)
 * Env overrides: REBALANCING_API_URL, REBALANCING_API_TOKEN
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPortfolioCommands } from "./commands/portfolios.js";
import { registerLogsCommands } from "./commands/logs.js";
import { registerPricesCommands } from "./commands/prices.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8")
) as { version: string; description: string };

const program = new Command();

program
  .name("rebalancing")
  .description(pkg.description)
  .version(pkg.version)
  .addHelpText(
    "after",
    `
Environment variables:
  REBALANCING_API_URL    Override API base URL
  REBALANCING_API_TOKEN  Use token directly (skips stored config)

Examples:
  rebalancing auth login -e admin@example.com -p secret
  rebalancing portfolios list --pretty
  rebalancing portfolios drift baseline-portfolio --pretty
  rebalancing logs --portfolio baseline-portfolio --since 2026-06-11T00:00:00Z --type LIVE_EXECUTION
  rebalancing prices --json | jq '.prices.AAPL'
`
  );

registerAuthCommands(program);
registerPortfolioCommands(program);
registerLogsCommands(program);
registerPricesCommands(program);

program.parse(process.argv);
