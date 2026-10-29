// Mock furniture-shop backends for exercise 5. Each tool fronts a different "system" with its own formats:
//   get_customer   (CRM):       Unix timestamps (seconds), numeric status codes 200 / 404 / 500
//   lookup_order   (orders):    ISO 8601 dates, English statuses "active" / "completed" / "cancelled"
//   check_shipping (logistics): DD/MM/YYYY dates, single-char statuses "P" pending / "S" shipped / "D" delivered / "R" returned
// Tools return the raw record as JSON text; the PostToolUse hook is what should normalize it.
import {tool, createSdkMcpServer} from "@anthropic-ai/claude-agent-sdk";
import {z} from 'zod';

export const SERVER_NAME = 'shop';
export const TOOL_NAMES = [
    `mcp__${SERVER_NAME}__get_customer`,
    `mcp__${SERVER_NAME}__lookup_order`,
    `mcp__${SERVER_NAME}__check_shipping`
];

const CUSTOMERS = [
    {customer_id: "C2001", name: "Alice Johnson", email: "alice.johnson@example.com", created_at: 1707642900, last_login: 1793126400, status: 200},
    {customer_id: "C2002", name: "Bob Smith", email: "bob.smith@example.com", created_at: 1748959500, last_login: 1792483920, status: 200},
    // simulates a CRM backend error for this record
    {customer_id: "C2003", name: "Carla Mendes", email: "carla.mendes@example.com", created_at: 1699443000, last_login: 1790805300, status: 500}
];

const ORDERS = [
    {order_id: "O7001", customer_id: "C2001", items: [{product: "Oak Dining Table", quantity: 1, price: 899.00}], total: 899.00, order_date: "2026-10-02T10:24:00Z", status: "active"},
    {order_id: "O7002", customer_id: "C2001", items: [{product: "Linen Armchair", quantity: 2, price: 349.50}], total: 699.00, order_date: "2026-09-05T16:02:00Z", status: "completed"},
    {order_id: "O7003", customer_id: "C2002", items: [{product: "Bookshelf", quantity: 1, price: 189.00}], total: 189.00, order_date: "2026-10-11T08:45:00Z", status: "active"},
    {order_id: "O7004", customer_id: "C2002", items: [{product: "Bar Stool", quantity: 4, price: 79.00}], total: 316.00, order_date: "2026-08-03T12:10:00Z", status: "cancelled"},
    {order_id: "O7005", customer_id: "C2003", items: [{product: "Velvet Sofa", quantity: 1, price: 1450.00}], total: 1450.00, order_date: "2026-10-07T19:30:00Z", status: "active"}
];

// Days kept <= 12 on purpose, so DD/MM vs MM/DD is ambiguous without normalization
const SHIPMENTS = [
    {order_id: "O7001", carrier: "FurniFreight", shipped_on: "06/10/2026", estimated_delivery: "11/11/2026", status: "S"},
    {order_id: "O7002", carrier: "FurniFreight", shipped_on: "08/09/2026", estimated_delivery: "12/09/2026", status: "D"},
    {order_id: "O7003", carrier: "QuickHaul", shipped_on: null, estimated_delivery: "03/11/2026", status: "P"},
    {order_id: "O7004", carrier: "QuickHaul", shipped_on: "05/08/2026", estimated_delivery: "09/08/2026", status: "R"},
    {order_id: "O7005", carrier: "FurniFreight", shipped_on: null, estimated_delivery: "10/12/2026", status: "P"}
];

function json(value: unknown) {
    return {content: [{type: "text" as const, text: JSON.stringify(value)}]};
}

const get_customer = tool(
    "get_customer", "Looks up a customer in the CRM by email or customer ID",
    {
        email: z.email().optional().describe('Customer email address'),
        customer_id: z.string().optional().describe('Customer ID, e.g. C2001')
    }, async (args) => {
        const customer = CUSTOMERS.find(c =>
            (args.email && c.email.toLowerCase() == args.email.toLowerCase()) ||
            (args.customer_id && c.customer_id.toLowerCase() == args.customer_id.trim().toLowerCase()));
        // the CRM reports "not found" as a status code rather than an error
        return json(customer ?? {status: 404});
    });

const lookup_order = tool(
    "lookup_order", "Returns order details: customer ID, items, total, order date and status",
    {
        order_id: z.string().describe('Order ID, e.g. O7001')
    }, async (args) => {
        const order = ORDERS.find(o => o.order_id.toLowerCase() == args.order_id.trim().toLowerCase());
        if (!order) {
            return {content: [{type: "text", text: `No order found with ID ${args.order_id}`}], isError: true};
        }
        return json(order);
    });

const check_shipping = tool(
    "check_shipping", "Returns shipping details for an order: carrier, ship date, estimated delivery and status",
    {
        order_id: z.string().describe('Order ID, e.g. O7001')
    }, async (args) => {
        const shipment = SHIPMENTS.find(s => s.order_id.toLowerCase() == args.order_id.trim().toLowerCase());
        if (!shipment) {
            return {content: [{type: "text", text: `No shipment found for order ${args.order_id}`}], isError: true};
        }
        return json(shipment);
    });

export const shopServer = createSdkMcpServer({
    name: SERVER_NAME,
    tools: [get_customer, lookup_order, check_shipping]
});
