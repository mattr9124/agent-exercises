import {type HookCallback, type PostToolUseHookInput, query} from "@anthropic-ai/claude-agent-sdk";
import {logMessage} from "../shared/log.ts";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {shopServer, TOOL_NAMES} from "./tools.ts";
import {unixToIso, ddMmYyyyToIso, normalizeStatus} from "./utils.ts";
import {re} from "mathjs";

const MODEL = 'claude-sonnet-5';
const MAX_TURNS = 10;// Exercise 5

const line_reader = readLine.createInterface({input, output})
let userInput: string;

let sessionId: string | undefined;

const normalizeResult: HookCallback = async (input) => {

    const {tool_name, tool_response} = input as PostToolUseHookInput;

    const content = tool_response as {type: string, text: string}[];
    const record = JSON.parse(content[0].text)

    // let formatted; // TODO for the formatting - this is temporary until I can actually see the format
    switch (tool_name) {
        case 'mcp__shop__get_customer':
            unixToIso(record, 'created_at');
            unixToIso(record, 'last_login');
            normalizeStatus(record);
            break;
        case 'mcp__shop__lookup_order':
            normalizeStatus(record);
            break;
        case 'mcp__shop__check_shipping':
            ddMmYyyyToIso(record, 'shipped_on');
            ddMmYyyyToIso(record, 'estimated_delivery');
            normalizeStatus(record);
            break;
        default:
            // unknown tool TODO
    }

    console.log('Formatted record', JSON.stringify(record, null, 2));

    return {
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            updatedToolOutput: [{type: 'text', text: JSON.stringify(record)}]
        }
    }
}

while (true) {
    userInput = await line_reader.question('You: ');

    if (userInput.trim().toLowerCase() == 'exit') {
        break;
    }

    for await (const message of query({
        prompt: userInput,
        options: {
            settings: {autoMemoryEnabled: false},
            settingSources: [],
            model: MODEL,
            resume: sessionId,
            maxTurns: MAX_TURNS,
            systemPrompt: ` You are a customer service agent. You can look up customer orders. Use provided tools for that`,
            allowedTools: TOOL_NAMES,
            mcpServers: {
                [shopServer.name]: shopServer
            },
            hooks: {
               PostToolUse: [
                   { matcher: 'mcp__shop__.*', hooks: [normalizeResult]}
               ]
            }
        }
    })) {
        logMessage(message);
        sessionId = message.session_id;
    }
}

line_reader.close();