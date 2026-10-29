# Agent exercises

Hands-on exercises for the Claude certification's agentic architecture topics, in TypeScript. Each pattern is built twice where useful: once by hand on the Messages API, to see how it works underneath, and once with the Claude Agent SDK.

## Exercises

| Script | Folder | What it covers |
|---|---|---|
| `npm run ex1` | `src/exercise-01` | Agent loop on the Messages API with two tools (calculator, mock web search) |
| `npm run ex1a` | `src/exercise-01a` | Hello world with the Agent SDK: `query()`, `allowedTools` |
| `npm run ex2` | `src/exercise-02` | Hub-and-spoke by hand: a coordinator spawns subagents through a `delegate_to_subagent` tool, run in parallel with `Promise.all` |
| `npm run ex2a` | `src/exercise-02a` | The same with the Agent SDK: planner, researcher, synthesizer and reviewer subagents, session `resume` |
| `npm run ex3` | `src/exercise-03` | Subagent context passing: findings carry source metadata (URL, document, page, confidence) through to synthesis |
| `npm run ex4` | `src/exercise-04` | Customer support agent with in-process MCP tools (`createSdkMcpServer`): a code-enforced gate on `process_refund` vs rules only the prompt enforces. Sample prompts in `sample-prompts.txt` |
| `npm run ex5` | `src/exercise-05` | PostToolUse hook normalizing mixed date and status formats from three mock tools to ISO 8601 and English words |
| `npm run ex5a` | `src/exercise-05a` | PreToolUse hook on the exercise 4 refund agent: denies refunds above $500 before `process_refund` runs and tells the model to escalate to a human |

`src/shared/log.ts` prints Agent SDK message streams in a readable form: which subagent is talking, which model it uses, and the cost and models used per run.

## Setup

Requires Node 26+, which runs TypeScript directly with no build step.

```sh
npm install
```

Create a `.env` file (gitignored) with your credentials, for example:

```sh
ANTHROPIC_API_KEY=...
```

or, when going through a gateway:

```sh
ANTHROPIC_BASE_URL=...
ANTHROPIC_AUTH_TOKEN=...
```

Then run an exercise, e.g. `npm run ex2a`. Run `npm run typecheck` to typecheck everything.

## Notes

- Agent SDK sessions run Claude Code under the hood. They load your Claude Code settings and memory unless isolated with `settingSources: []` and `settings: {autoMemoryEnabled: false}`.
- Running an exercise makes real API calls and costs money. The multi-agent exercises cost roughly $1–4 per question, depending on how many subagents they start.
