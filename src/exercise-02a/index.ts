import {query, type AgentDefinition} from "@anthropic-ai/claude-agent-sdk";
import {logMessage} from "../shared/log.ts";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";

const MODEL = 'claude-sonnet-5';
const MAX_TURNS = 10;

const AGENTS: Record<string, AgentDefinition> = {
    planner: {
        description: "Breaks a broad request into a complete list of independent subtopics. Use first, before any research.",
        prompt: `You are a research planner. Given a topic, list every distinct subtopic needed to cover it fully
        (e.g. renewable energy -> solar, wind, geothermal, tidal, biomass, fusion). Search the web if you are unsure
        the list is complete. Return only the list, one subtopic per line, each with a one-sentence scope.`,
        tools: ["WebFetch"]
    },
    researcher: {
        description: "Researches exactly one subtopic in depth. Spawn one per subtopic; several can run in parallel.",
        prompt: `You are a researcher. Research only the subtopic you are given. Answer only from search results,
        and say so if the results are insufficient. Return concise key facts, each with its source URL.`,
        tools: ["WebFetch"],
        model: "claude-haiku-5-5"
    },
    synthesizer: {
        description: "Combines several research results into one coherent answer. Use after all researchers finish.",
        prompt: `You are a synthesizer. Combine the research findings you are given into one well-structured answer
        to the original request. Remove duplication, keep the sources, and do not add facts that are not in the findings.`,
        tools: []
    },
    reviewer: {
        description: "Checks a draft answer against the original request and reports gaps. Use on the synthesized answer.",
        prompt: `You are a reviewer. Given the original request and a draft answer, check: does it answer the request,
        is it complete, is it coherent, does it cover the full range of the topic? Reply APPROVED if so, otherwise
        list the specific gaps or problems to fix.`,
        tools: ["WebFetch"]
    }
};

const SYSTEM_PROMPT: string = `
You are a coordinator. You never answer from your own knowledge; you delegate to subagents.

For each request:
1. Call \`planner\` with the request to get the list of subtopics.
2. Call \`researcher\` once per subtopic, all in the same turn so they run in parallel.
3. Call \`synthesizer\` with the original request and all research findings.
4. Call \`reviewer\` with the original request and the synthesized answer.
   If it lists gaps, research or re-synthesize only what is needed, then review again.
   Stop after 2 review rounds.

Subagents cannot see this conversation: include everything they need in each task.
For simple requests that need no research, skip straight to answering.
`;

const line_reader = readLine.createInterface({input, output})
let userInput: string;
let sessionId: string | undefined;

while (true) {
    userInput = await line_reader.question('You: ');

    if (userInput.trim().toLowerCase() == 'exit') {
        break;
    }

    for await (const message of query({
        prompt: userInput,
        options: {
            allowedTools: ["Agent", "WebFetch", "Bash(curl:*)"],
            settingSources: [],
            settings: {autoMemoryEnabled: false},
            systemPrompt: SYSTEM_PROMPT,
            model: MODEL,
            maxTurns: MAX_TURNS,
            resume: sessionId,
            agents: AGENTS
        }
    })) {
        logMessage(message);
        sessionId = message.session_id;
    }

    console.log('Current session ID: ', sessionId)
}

line_reader.close();
