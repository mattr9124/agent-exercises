import type {SDKMessage} from "@anthropic-ai/claude-agent-sdk";

// Maps the coordinator's Agent/Task tool_use id to the subagent it started, so messages
// coming from inside that subagent (parent_tool_use_id) can be labelled with its name
const subagentNames = new Map<string, string>();

export function logMessage(message: SDKMessage) {
    const parentId = 'parent_tool_use_id' in message ? message.parent_tool_use_id : null;
    const who = parentId ? `  [${subagentNames.get(parentId) ?? 'sub'}]` : '[coord]';

    switch (message.type) {
        case 'system':
            switch (message.subtype) {
                case 'init':
                    console.log(`[init] model=${message.model} agents=${message.agents?.join(', ')} tools=${message.tools.length}`);
                    break;
                case 'task_started':
                    if (message.tool_use_id && message.subagent_type) {
                        subagentNames.set(message.tool_use_id, message.subagent_type);
                    }
                    console.log(`-> ${message.subagent_type} started: ${message.description}`);
                    break;
                case 'task_notification':
                    console.log(`<- ${message.status}: ${message.summary} (${message.usage?.total_tokens} tokens)`);
                    break;
                case 'permission_denied':
                    console.log(`!! denied ${message.tool_name}: ${message.message}`);
                    break;
            }
            break;
        case 'assistant':
            for (const block of message.message.content) {
                if (block.type == 'text') console.log(`${who} (${message.message.model}) ${block.text}`);
                if (block.type == 'tool_use') {
                    const input = block.input as {subagent_type?: string};
                    if ((block.name == 'Agent' || block.name == 'Task') && input.subagent_type) {
                        subagentNames.set(block.id, input.subagent_type);
                    }
                    console.log(`${who} (${message.message.model}) calls ${block.name}`, JSON.stringify(block.input));
                }
            }
            break;
        case 'result':
            console.log(`[done] turns=${message.num_turns} ${message.duration_ms}ms $${message.total_cost_usd.toFixed(4)} models=${Object.keys(message.modelUsage).join(', ')}`);
            break;
    }
}
