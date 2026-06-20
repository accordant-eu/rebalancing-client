import { Command } from "commander";
import { login, loadConfig, saveConfig, clearConfig } from "../client.js";
import { printOutput, handleCommandError, printSuccess, type OutputFormat } from "../output.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authenticate with the rebalancing engine API");

  auth
    .command("login")
    .description("Log in and store token locally (~/.rebalancing-client/config.json)")
    .requiredOption("-e, --email <email>", "Email address")
    .requiredOption("-p, --password <password>", "Password")
    .option("--url <url>", "API base URL (overrides REBALANCING_API_URL)")
    .option("--json", "Output as JSON")
    .action(async (opts: { email: string; password: string; url?: string; json?: boolean }) => {
      const format: OutputFormat = opts.json ? "json" : "pretty";
      try {
        if (opts.url) {
          const cfg = loadConfig();
          saveConfig({ ...cfg, baseUrl: opts.url });
        }
        const result = await login(opts.email, opts.password);
        const cfg = loadConfig();
        saveConfig({ ...cfg, token: result.token, tenantId: result.tenantId, role: result.role });
        if (format === "json") {
          printOutput({ token: result.token, tenantId: result.tenantId, role: result.role }, "json");
        } else {
          printSuccess(`Logged in. Tenant: ${result.tenantId}  Role: ${result.role}`);
          printSuccess(`Token stored at ~/.rebalancing-client/config.json`);
        }
      } catch (err) {
        handleCommandError(err);
      }
    });

  auth
    .command("whoami")
    .description("Show currently stored credentials")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const format: OutputFormat = opts.json ? "json" : "pretty";
      const cfg = loadConfig();
      const token = process.env.REBALANCING_API_TOKEN ?? cfg.token;
      if (!token) {
        process.stderr.write("Error: Not logged in. Run `rebalancing auth login` or set REBALANCING_API_TOKEN.\n");
        process.exit(2);  // treat as auth failure
      }
      const data = {
        tenantId: cfg.tenantId ?? "(from env)",
        role: cfg.role ?? "(from env)",
        tokenPreview: token.slice(0, 12) + "…",
        baseUrl: process.env.REBALANCING_API_URL ?? cfg.baseUrl ?? "https://app.rebalancing.accordant.eu",
      };
      if (format === "json") {
        printOutput(data, "json");
      } else {
        printSuccess(`Tenant:  ${data.tenantId}`);
        printSuccess(`Role:    ${data.role}`);
        printSuccess(`Token:   ${data.tokenPreview}`);
        printSuccess(`API URL: ${data.baseUrl}`);
      }
    });

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(() => {
      clearConfig();
      printSuccess("Credentials cleared.");
    });
}
