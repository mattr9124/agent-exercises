import {Anthropic} from "@anthropic-ai/sdk";
import * as readLine from "node:readline/promises";
import { stdin as input, stdout as output} from "node:process";
import {evaluate, to} from "mathjs";

const client = new Anthropic();

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;
const MAX_TURNS = 4;

const line_reader = readLine.createInterface({input, output})

const TOOL_REGISTRY: Record<string, (input: any) => string> = {
    calculator: handleExpression,
    web_search: search
}

let token_counter = 0;

/*
Set up a Claude API client with two tools: a calculator tool (accepts expression, returns result) and a web search stub (accepts query, returns mock results)
 */
const tools: Anthropic.Tool[] = [
    {
        name: "calculator",
        description: "A basic calculator that will accept normal mathematical expressions and return the result",
        input_schema: {
            type: "object",
            properties: {
                expression: {
                    type: "string",
                    description: "A standard mathematical expression such as 2+2"
                },
            },
            required: [
                "expression"
            ]
        }
    },
    {
        name: "web_search",
        description: "Takes a search query and will search the web for it",
        input_schema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query"
                },
            },
            required: [
                "query"
            ]
        }
    }
]

console.log('Welcome to my agent - what can I do for you?');

// initial prompt

const messages: Anthropic.MessageParam[] = [];

let userInput: string;

while(true) {
    userInput = await line_reader.question('You: ');

    if (userInput.trim().toLowerCase() == 'exit') {
        break;
    }

    messages.push({role: 'user', content: userInput});

    for (let turn = 0; turn < MAX_TURNS; turn++) {
        const message = await client.messages.create(
            {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                tools: tools,
                messages: messages
            }
        )

        token_counter += message.usage.input_tokens + message.usage.output_tokens;


        console.log('Input tokens: ', message.usage.input_tokens);
        console.log('Output tokens: ', message.usage.output_tokens);
        console.log('Total tokens for the session: ', token_counter);

        messages.push({role: "assistant", content: message.content});

        console.log('stop reason', message.stop_reason);

        if (message.stop_reason == 'end_turn') {
            message.content
                .filter(block => block.type == 'text')
                .forEach(block => console.log(block.text));
            console.debug('end turn reached');
            break;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // process result
        message.content.forEach(block => {
            switch (block.type) {
                case "text":
                    console.log(block.text);
                    break;
                case "tool_use":
                    const toolResult = TOOL_REGISTRY[block.name](block.input);

                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: toolResult
                    })

                    break;
                default:
                    console.log(block.type);
            }
        })

        if (toolResults.length > 0) {
            messages.push({role: 'user', content: toolResults});
        }
    }
}

line_reader.close();

function handleExpression(input: {expression: string}) {
    const expr = input.expression;
    try {
        console.log(`Evaluating ${expr} using tool`);
        const evalResult = evaluate(expr);
        console.log('Eval result', evalResult)
        return String(evalResult);
    } catch (e) {
        console.error(`Unable to evaluate expression ${expr}`, e);
        return 'An error occurred ' + e;
    }
}

function search(input: {query: string}) {
    const query = input.query;

    return "It's cloudy and about 20 degrees Celsius";
}