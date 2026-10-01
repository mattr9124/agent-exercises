import {Anthropic} from "@anthropic-ai/sdk";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";

const CLIENT = new Anthropic();

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;
const MAX_TURNS = 4;

type SubagentInput = {
    task: string,
    system_prompt: string,
    tools: string[]
};

const TOOL_REGISTRY: Record<string, (input: any) => string> = {
    // delegate_to_subagent: spawnSubagent
}


export class Agent {
    readonly client: Anthropic;
    readonly maxTokens: number;
    readonly maxTurns: number;
    readonly tools: Anthropic.Tool[];
    private token_counter: number = 0;

    constructor(client: Anthropic, maxTokens: number, maxTurns: number, tools: Anthropic.Tool[]) {
        this.client = client;
        this.maxTokens = maxTokens;
        this.maxTurns = maxTurns;
        this.tools = tools;
    }

    async executeAgentTurn(messages: Anthropic.MessageParam[]) {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
            const message = await CLIENT.messages.create(
                {
                    model: MODEL,
                    max_tokens: MAX_TOKENS,
                    tools: this.tools,
                    messages: messages
                }
            )
            this.incrementTokenCounter(message);

            messages.push({role: "assistant", content: message.content});

            console.log('stop reason', message.stop_reason);
            if (this.processEndTurn(message)) {
                break;
            }
            this.processTools(message, messages);
        }
    }

    protected processTools(message: Anthropic.Message , messages: Anthropic.MessageParam[]) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // process result
        message.content.forEach(block => {
            switch (block.type) {
                case "text":
                    console.log(block.text);
                    break;
                case "tool_use":
                    const toolResult = TOOL_REGISTRY[block.name](block.input);

                    break;
                default:
                    console.log(block.type);
            }
        })

        if (toolResults.length > 0) {
            messages.push({role: 'user', content: toolResults});
        }
    }

    protected incrementTokenCounter(message: Anthropic.Message) {
        this.token_counter += message.usage.input_tokens + message.usage.output_tokens;
        console.log('Input tokens: ', message.usage.input_tokens);
        console.log('Output tokens: ', message.usage.output_tokens);
        console.log('Total tokens for the session: ', this.token_counter);
    }

    protected  processEndTurn(message: Anthropic.Message) {
        if (message.stop_reason == 'end_turn') {
            message.content
                .filter(block => block.type == 'text')
                .forEach(block => console.log(block.text));
            console.debug('end turn reached');
            return true;
        }
        return false;
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

    private systemPrompt: string = `
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

    private SPAWN_SUBAGENT_TOOL: Anthropic.Tool[];

    constructor(client: Anthropic, maxTokens: number, maxTurns: number, tools: Anthropic.Tool[]) {
        super(client, maxTokens, maxTurns, tools);
        this.SPAWN_SUBAGENT_TOOL =  [{
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
        }];
    }

    async runCoordinator(query: string) {

        this.messages.push({
            role: "user", content: query
        });

        for (let turn = 0; turn < MAX_TURNS; turn++) {
            // let model = this.model;
            const message: Anthropic.Message = await CLIENT.messages.create(
                {
                    model: MODEL,
                    max_tokens: this.maxTokens,
                    system: this.systemPrompt,
                    messages: this.messages,
                    tools: this.SPAWN_SUBAGENT_TOOL
                }
            );

            this.incrementTokenCounter(message);

            this.messages.push({role: "assistant", content: message.content});

            console.log('stop reason', message.stop_reason);
            if (this.processEndTurn(message)) {
                break;
            }

            // delegate_to_subagent/
        }
    }

    protected processTools(message: Anthropic.Message , messages: Anthropic.MessageParam[]) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // process result
        message.content.forEach(block => {
            switch (block.type) {
                case "text":
                    console.log(block.text);
                    break;
                case "tool_use":
                    // const toolResult = TOOL_REGISTRY[block.name](block.input);
                    if (block.name == 'delegate_to_subagent') {
                        this.spawnSubagent(block.input as SubagentInput)
                    }
                    break;
                default:
                    console.log(block.type);
            }
        })

        if (toolResults.length > 0) {
            messages.push({role: 'user', content: toolResults});
        }
    }

    async spawnSubagent(input: SubagentInput) {

        const tools: Anthropic.Tool[] = this.extractTools(input.tools);

        const subagent = new Agent(CLIENT, MAX_TOKENS, MAX_TURNS, tools);

    }

    private extractTools(tools: string[]) {
        return this.tools.filter(t => tools.includes(t.name) && t.name != 'delegate_to_subagent');
    }
}


const line_reader = readLine.createInterface({input, output})

const messages: Anthropic.MessageParam[] = [];

let userInput: string;

while (true) {
    userInput = await line_reader.question('You: ');

    if (userInput.trim().toLowerCase() == 'exit') {
        break;
    }

    messages.push({role: 'user', content: userInput});


}

line_reader.close();



