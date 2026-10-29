# CLAUDE.md

Learning project: hands-on exercises for the Claude certification (agentic architecture), in TypeScript.

## Working with the user

- The user writes the exercise code themselves to learn how it works. Review, explain and give hints; don't write full implementations unless asked.
- Keep answers short: lead with the key point, bugs first.
- Helper/boilerplate code (e.g. `src/shared/`) is fine to write when asked.

## Layout

- `src/exercise-NN/` — exercises on the raw Messages API (`@anthropic-ai/sdk`), with a hand-written agent loop.
- `src/exercise-NNa/` and later exercises — the same ideas on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, `query()`).
- `src/shared/log.ts` — `logMessage(message)` for readable Agent SDK output (subagent names, model per message, cost).

## Commands

- `npm run ex1` / `ex1a` / `ex2` / `ex2a` / `ex3` / `ex4` / `ex5` / `ex5a` — run an exercise (loads `.env` via `--env-file`).
- `npm run typecheck` — `tsc` with `noEmit`. There is no build step and no test suite.

## Conventions

- Node runs the `.ts` files directly (type stripping), so `erasableSyntaxOnly` is on: no enums, namespaces or parameter properties.
- Relative imports use the `.ts` extension, e.g. `import {logMessage} from "../shared/log.ts"`.
- Use SDK types (`Anthropic.MessageParam`, `AgentDefinition`, `SDKMessage`) rather than redefining them.

## Environment gotchas

- `.env` holds `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` for a company gateway. Never commit it (it is gitignored).
- Through the gateway, the server-side `WebSearch` tool is unavailable; `WebFetch` works.
- Agent SDK runs load the user's Claude Code settings, memory and this file unless isolated. Exercises use `settingSources: []` and `settings: {autoMemoryEnabled: false}`.
- `allowedTools` pre-approves tools but doesn't restrict them; use `disallowedTools` (e.g. `ScheduleWakeup`, `Bash`) to keep the coordinator delegating.
