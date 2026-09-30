import {Anthropic} from "@anthropic-ai/sdk";

const client = new Anthropic();

const msg = await client.messages.create(
    {
        model: "claude-sonnet-5",
        max_tokens: 4096,
        messages: [{
            role: "user",
            content: "Hello this is a tester"
        }]
    }
)

console.log(msg.content)