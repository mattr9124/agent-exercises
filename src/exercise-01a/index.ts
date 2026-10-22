import {query} from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
    prompt: "can you check the weather in Sydney, Australia?",
    options: {
        maxTurns: 3,
        allowedTools: ["WebSearch", "WebFetch", "Bash(curl:*)"]
    }
})) {
    if (message.type == "result" && message.subtype == "success") {
        console.log(message.result);
        console.log('cost', message.total_cost_usd);
    }
}