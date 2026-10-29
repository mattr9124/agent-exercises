import {
    query,
    tool,
    createSdkMcpServer,
    type HookCallback,
    type PreToolUseHookInput
} from "@anthropic-ai/claude-agent-sdk";
import {logMessage} from "../shared/log.ts";
import * as readLine from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {z} from 'zod';
import {type Customer, type Order, CUSTOMERS, ORDERS} from './data.ts';

const MODEL = 'claude-sonnet-5';
// const LIGHT_MODEL = 'claude-haiku-5-5';
const MAX_TURNS = 10;


// Case-insensitive exact match on email first, then name
function findCustomer(name?: string, email?: string): Customer | undefined {
    if (email) {
        const byEmail = CUSTOMERS.find(c => c.email.toLowerCase() == email.toLowerCase());
        if (byEmail) return byEmail;
    }
    if (name) {
        return CUSTOMERS.find(c => c.name.toLowerCase() == name.trim().toLowerCase());
    }
    return undefined;
}

function lookupOrder(orderId: string): Order | undefined {
    // lookup in mock data
    return ORDERS.find(o => o.id.toLowerCase() == orderId.trim().toLowerCase());
}

type RefundResult =
    | { success: true, refund_id: string, customer_id: string, amount: number, message: string }
    | { success: false, reason: 'customer_not_found' | 'customer_not_verified' | 'invalid_amount', message: string };

function processRefund(customerId: string, amount: number): RefundResult {
    const cust = CUSTOMERS.find(c => c.id == customerId);

    if (!cust) {
        console.log(`Customer ${customerId} not found`);
        return {
            success: false,
            reason: 'customer_not_found',
            message: `No customer with ID ${customerId}. Look the customer up with get_customer first.`
        };
    }
    if (!cust.verified) {
        console.log(`Customer ${cust.name}/${cust.id} not verified. Cannot process refund`);
        return {
            success: false,
            reason: 'customer_not_verified',
            message: `Customer ${cust.id} is not verified, so no refund was issued. The customer must complete identity verification first.`
        };
    }
    if (amount <= 0) {
        return {success: false, reason: 'invalid_amount', message: 'Refund amount must be greater than 0.'};
    }

    // it's a mock so no actual refund is happening
    console.log(`Proceeding with refund to customer ${cust.name}/${cust.id} of ${amount}`);
    return {
        success: true,
        refund_id: `R${Date.now()}`,
        customer_id: cust.id,
        amount,
        message: `Refund of $${amount.toFixed(2)} issued to customer ${cust.id}.`
    };
}

const validateRefund: HookCallback = async (input) => {
    const {tool_name, tool_input} = input as PreToolUseHookInput;

    console.log('PreHook tool name', tool_name);
    console.log('input', tool_input);

    const amount = (tool_input as {amount: number}).amount;

    if (amount > 500) {
        return {
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: 'deny',
                permissionDecisionReason: 'Refunds over $500 require human in the loop approval. Escalate'
            }
        }
    }

    return {};
}

const line_reader = readLine.createInterface({input, output})
let userInput: string;
/*
"mcp__myTools__get_customer",
"mcp__myTools__lookup_order",
"mcp__myTools__process_refund"
 */

const get_customer = tool(
    "get_customer", "Returns customer ID and verification status",
    {
        name: z.string().optional().describe('Customer name'),
        email: z.email().optional().describe('Customer email address')
    }, async (args) => {
        if (!(args.name || args.email)) {
            return {content: [{type: "text", text: "Provide name or email"}], isError: true}
        }
        const customer = findCustomer(args.name, args.email);
        if (!customer) {
            return {content: [{type: "text", text: "No customer found with that name or email"}], isError: true}
        }

        if (customer.verified) {
            currentSession.verified_customer_id = customer.id;
        }

        return {content: [{type: "text", text: JSON.stringify(customer)}]}
    });

const lookup_order = tool(
    "lookup_order", "Returns order details: customer ID, items, total, status and order date",
    {
        order_id: z.string().describe('Order ID, e.g. O5001')
    }, async (args) => {
        const order = lookupOrder(args.order_id);
        if (!order) {
            return {content: [{type: "text", text: `No order found with ID ${args.order_id}`}], isError: true}
        }

        return {content: [{type: "text", text: JSON.stringify(order)}]}
    });

const process_refund = tool(
    "process_refund", "Processes a refund of the given amount to a customer",
    {
        customer_id: z.string().describe('Customer ID, e.g. C1001'),
        amount: z.number().describe('Refund amount in USD')
    }, async (args) => {
        if (currentSession && currentSession.verified_customer_id == args.customer_id) {
            const result = processRefund(args.customer_id, args.amount);
            return {content: [{type: "text", text: JSON.stringify(result)}], isError: !result.success}
        }
        return {content: [{type: "text", text: "Customer ID is not verified"}], isError: true}
    });

const server = createSdkMcpServer({
    name: 'myTools',
    tools: [get_customer, lookup_order, process_refund]
});

// let currentCustomer : Customer | undefined;

const currentSession = {
    verified_customer_id: null as string | null
}
let sessionId: string | undefined;
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
            systemPrompt: `
        You are a customer service agent. You can provide refunds to verified customers.
        
        Lookup a customer first, and only if the customer is verified, you can process the refund.
        
        The refund must be tied to an existing order. You can only refund the order amount. 
        
        If a customer asks for an arbitrary refund or and amount that is greater than the order
        you should refuse the request
        `,
            maxTurns: MAX_TURNS,
            mcpServers: {
                myTools: server
            },
            allowedTools: ["Agent", "WebFetch", "mcp__myTools__get_customer",
                "mcp__myTools__lookup_order",
                "mcp__myTools__process_refund"],
            hooks: {
                PreToolUse: [
                    { matcher: 'mcp__myTools__process_refund', hooks: [validateRefund]}
                ]
            }
        }
    })) {
        logMessage(message);
        sessionId = message.session_id;
    }

    // reset:
    currentSession.verified_customer_id = null;
}

line_reader.close();