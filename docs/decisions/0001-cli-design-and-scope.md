---
type: Decision Record
title: CLI design, scope, and output contract
description: Core architectural choices for the rebalancing-client CLI tool
tags: [architecture, cli, output, auth]
timestamp: 2026-06-18T00:00:00Z
status: Accepted
---

# CLI design, scope, and output contract

## Context

The rebalancing engine exposes a REST API. Týr (the portfolio analyst agent) and human operators both need to consume it. Options ranged from a raw HTTP client wrapper to a full SDK, with or without a CLI surface.

The client needs to work for two distinct consumers:
1. **Týr** — an autonomous agent that parses stdout and must be able to pipe output into further processing. Needs predictable, machine-readable output with no surprises.
2. **Johan** — a human operator who occasionally wants a readable summary at the terminal.

## Options Considered

1. **Raw fetch wrapper as a library only** — no CLI, just import the client.
   - Benefits: Maximum flexibility for callers.
   - Costs: No standalone usability; agents need scripting glue.
   - Reversibility: High.

2. **CLI-first with JSON output by default, `--pretty` opt-in** *(chosen)*.
   - Benefits: Works for both consumers. Agent pipelines get stable JSON on stdout. Humans pass `--pretty` for readable output. The binary is also a library (named exports from `client.ts`).
   - Costs: Two output modes to maintain.
   - Reversibility: High — output format can evolve without changing command structure.

3. **Human-readable by default, `--json` opt-in**.
   - Benefits: Lower friction for interactive use.
   - Costs: Breaks agent pipelines silently if default changes. Agents must always pass `--json`. Precedent is against this (standard CLIs like `gh`, `kubectl` all default to human-readable, which causes friction in automation).
   - Risks: Agent consumers parsing human-formatted output is brittle.
   - Reversibility: Low — hard to change once agents depend on it.

## Decision

Option 2. JSON is the default. `--pretty` is the opt-in for humans.

The stdout/stderr/exit-code contract is:
- **stdout** — structured data only (JSON or pretty-formatted data)
- **stderr** — errors only (`Error: <message>`)
- **Exit 0** — success
- **Exit 1** — any error

This contract is documented in `AGENTS.md` and is the most important invariant in the codebase. Do not break it.

## Auth design

Two-layer auth:
1. `~/.rebalancing-client/config.json` (chmod 600) — populated by `auth login`, used for interactive sessions.
2. `REBALANCING_API_TOKEN` env var — overrides stored config; used for agents, CI, scripts.

Env always wins. This means Týr can be configured purely through environment without touching the filesystem, which is the right model for an agent operating in a controlled environment.

## Scope in v0.1

Read-only. The engine's API in v0.9.0 is read-oriented (auth, portfolios, drift, proposals, logs, prices). Write commands will be added when the engine exposes mutation endpoints, following the same decision discipline.

## Consequences

- All new commands must default to JSON output and accept `--pretty`.
- stdout must never contain error messages — always stderr.
- Auth via env is the supported path for agents; the config file is a convenience for humans.
- The client version must be updated in CHANGELOG.md when the tracked API version changes.
