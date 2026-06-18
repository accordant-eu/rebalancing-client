# Deployment — rebalancing-client

This is a CLI tool, not a service. "Deployment" means installation and configuration.

---

## Install

### Global install (production use)

```bash
npm install -g @accordant/rebalancing-client
rebalancing --version
```

> Not yet published to npm. Until it is, use the local install path below.

### Local install from source

```bash
git clone https://github.com/accordant-eu/rebalancing-client
cd rebalancing-client
npm install
npm run build
npm install -g .
rebalancing --version
```

### Dev (no install, no build)

```bash
npm run dev -- --help
npm run dev -- portfolios list --pretty
```

---

## Configuration

### 1. Interactive (human use)

```bash
rebalancing auth login -e you@example.com -p yourpassword
```

Stores token, tenant ID, and role at `~/.rebalancing-client/config.json` (chmod 600).

To inspect: `rebalancing auth whoami`
To clear: `rebalancing auth logout`

### 2. Non-interactive (agents, CI, scripts)

Set environment variables. Env always overrides stored config.

```bash
export REBALANCING_API_URL=https://app.rebalancing.accordant.eu
export REBALANCING_API_TOKEN=your-token-here
rebalancing portfolios list
```

For Týr or other agents, inject these via the agent's environment config — do not store tokens in the agent's working directory.

---

## Verify installation

```bash
# Should return JSON (or use --pretty for human-readable)
rebalancing auth whoami
rebalancing portfolios list
rebalancing prices
```

---

## Update

```bash
# From source
cd rebalancing-client
git pull origin main
npm install
npm run build
npm install -g .
```

---

## Uninstall

```bash
npm uninstall -g @accordant/rebalancing-client
rm -rf ~/.rebalancing-client   # removes stored token/config
```

---

## Target environments

| Consumer | Install method | Auth method |
|---|---|---|
| Johan (interactive) | Global install | `auth login` → stored config |
| Týr (agent) | Global install or source | `REBALANCING_API_TOKEN` env var |
| CI | Source + `npm ci` + `npm run build` | `REBALANCING_API_TOKEN` secret |

---

## API compatibility

The client tracks the rebalancing engine API. Check the version in the engine's OpenAPI spec:

```bash
curl https://app.rebalancing.accordant.eu/api/docs/openapi.json | jq '.info.version'
```

Client version → API version compatibility is recorded in [CHANGELOG.md](CHANGELOG.md).
