import {Anthropic} from "@anthropic-ai/sdk";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {evaluate} from "mathjs";

const CLIENT = new Anthropic();

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;
const MAX_TURNS = 10;

type SubagentInput = {
    task: string,
    system_prompt: string,
    tools: string[]
};

const TOOL_REGISTRY: Record<string, (input: any) => string> = {
    calculator: handleExpression,
    web_search: search
}

export class Agent {
    readonly client: Anthropic;
    readonly maxTokens: number;
    readonly maxTurns: number;
    readonly tools: Anthropic.Tool[];
    protected systemPrompt?: string;
    private token_counter: number = 0;

    constructor(client: Anthropic, maxTokens: number, maxTurns: number, tools: Anthropic.Tool[], systemPrompt?: string) {
        this.client = client;
        this.maxTokens = maxTokens;
        this.maxTurns = maxTurns;
        this.tools = tools;
        this.systemPrompt = systemPrompt;
    }

    async executeAgentTurn(messages: Anthropic.MessageParam[]) {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
            const message = await CLIENT.messages.create(
                {
                    model: MODEL,
                    max_tokens: MAX_TOKENS,
                    system: this.systemPrompt,
                    tools: this.tools,
                    messages: messages
                }
            )
            this.incrementTokenCounter(message);

            messages.push({role: "assistant", content: message.content});

            console.log('stop reason', message.stop_reason);

            const turnResult = this.processEndTurn(message);
            if (turnResult !== undefined) {
                return turnResult;
            }
            const toolResults: Anthropic.ToolResultBlockParam[] = await this.processTools(message);

            if (toolResults.length > 0) {
                messages.push({role: 'user', content: toolResults});
            }
        }
        throw new Error(`Ran out of turns (${MAX_TURNS})`);
    }

    protected async processTools(message: Anthropic.Message) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of message.content) {
            switch (block.type) {
                case "text":
                    console.log(block.text);
                    break;
                case "tool_use":
                    try {
                        const toolResult = await this.executeTool(block);

                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: toolResult
                        });
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.error(errorMessage);
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: errorMessage,
                            is_error: true
                        });
                    }

                    break;
                default:
                    console.log(block.type);
            }
        }

        return toolResults;
    }

    protected async executeTool(toolUseBlock: Anthropic.ToolUseBlock): Promise<string> {
        const toolFunction = TOOL_REGISTRY[toolUseBlock.name];
        // call it
        return toolFunction(toolUseBlock.input);
    }

    protected incrementTokenCounter(message: Anthropic.Message) {
        this.token_counter += message.usage.input_tokens + message.usage.output_tokens;
        console.log('Input tokens: ', message.usage.input_tokens);
        console.log('Output tokens: ', message.usage.output_tokens);
        console.log('Total tokens for the session: ', this.token_counter);
    }

    protected processEndTurn(message: Anthropic.Message): string | undefined {
        if (message.stop_reason == 'end_turn') {
            const result = message.content
                .filter(block => block.type == 'text')
                .map(block => block.text)
                .join('\n');

            console.debug('End turn result: ', result)
            console.debug('end turn reached');
            return result;
        }
    }
}

export class Coordinator extends Agent {
    /*
    Coordinator tasks:

    Decomposition
    Delegation
    Aggregation
    Refinement
     */

    protected systemPrompt: string = `
    You are a coordinator in a multi agent system.
    
    Your role is to handle take user queries and then perform the following tasks:
    
    * Decomposition - Interpret the user request and decompose it into relevant tasks - for example if a user query
    asks to research about a topic (like renewable energy), you should decompose it into as many different types
    of renewable energy you can. You might need to search the web in order to get the full list. So for renewable 
    energy you might decompose into covers solar, wind, geothermal, tidal, biomass, and fusion.
    * Delegation
    After decomposition, create subagents to handle each tasks. To spawn a sub-agent, use the provided tool
    }
    * Aggregation
    Wait until all subagents have completed their tasks and combine the results
    * Refinement
    Check the aggregated result against the original request - does it response to the user query? Is it complete?
    Is it coherent? Does it cover the full range of the topic?
    If not revisit the 4 steps as necessary, iterate until the result satisfies these conditions.
    `;

    private messages: Anthropic.MessageParam[] = [];

    readonly ALL_TOOLS: Anthropic.Tool[];

    constructor(client: Anthropic, maxTokens: number, maxTurns: number, tools: Anthropic.Tool[]) {
        super(client, maxTokens, maxTurns, [{
            name: "delegate_to_subagent",
            description: "spawn a subagent to perform some task",
            input_schema: {
                type: "object",
                properties: {
                    task: {
                        type: "string",
                        description: "A self-contained description of the subtask, including any context the subagent needs, since it cannot see this conversation"
                    },
                    system_prompt: {
                        type: "string",
                        description: "System prompt defining the subagent's role and expertise, e.g. 'You are a researcher specialising in solar energy'"
                    },
                    tools: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: tools.map(t => t.name)
                        },
                        description: "Names of the tools the subagent may use. Only include tools relevant to the subtask"
                    }
                },
                required: ["task", "system_prompt", "tools"]
            }
        }]);
        this.ALL_TOOLS = tools;
    }

    protected async executeTool(toolUseBlock: Anthropic.ToolUseBlock): Promise<string> {
        if (toolUseBlock.name == 'delegate_to_subagent') {
            return this.spawnSubagent(toolUseBlock.input as SubagentInput);
        }
        return super.executeTool(toolUseBlock);
    }

    async spawnSubagent(input: SubagentInput): Promise<string> {

        console.debug('SPAWNING SUBAGENT');

        const tools: Anthropic.Tool[] = this.extractTools(input.tools);

        const subagent = new Agent(CLIENT, MAX_TOKENS, MAX_TURNS, tools, input.system_prompt);

        return subagent.executeAgentTurn([{role: "user", content: input.task}]);
    }

    private extractTools(tools: string[]) {
        return this.ALL_TOOLS.filter(t => tools.includes(t.name));
    }
}


const line_reader = readLine.createInterface({input, output})

const messages: Anthropic.MessageParam[] = [];
const client = new Anthropic();
let userInput: string;

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
];

const coordinator = new Coordinator(client, MAX_TOKENS, MAX_TURNS, tools);

while (true) {
    userInput = await line_reader.question('You: ');

    if (userInput.trim().toLowerCase() == 'exit') {
        break;
    }

    messages.push({role: 'user', content: userInput});

    const result = await coordinator.executeAgentTurn(messages);

    console.log(result);

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

    return `Search results for "${query}": test only - mock service`;
}

