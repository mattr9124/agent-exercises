
export type Customer = {
    id: string,
    name: string,
    email: string,
    verified: boolean
};

export type Order = {
    id: string,
    customer_id: string,
    items: {product: string, quantity: number, price: number}[],
    total: number,
    status: 'processing' | 'shipped' | 'delivered' | 'returned',
    order_date: string
};

export const CUSTOMERS: Customer[] = [
    {id: "C1001", name: "Alice Johnson", email: "alice.johnson@example.com", verified: true},
    {id: "C1002", name: "Bob Smith", email: "bob.smith@example.com", verified: false},
    {id: "C1003", name: "Carla Mendes", email: "carla.mendes@example.com", verified: true},
    {id: "C1004", name: "David Chen", email: "david.chen@example.com", verified: false},
    {id: "C1005", name: "Emma Wilson", email: "emma.wilson@example.com", verified: true},
    {id: "C1006", name: "Farid Haddad", email: "farid.haddad@example.com", verified: false},
    {id: "C1007", name: "Grace Kim", email: "grace.kim@example.com", verified: true},
    {id: "C1008", name: "Hugo Martin", email: "hugo.martin@example.com", verified: false},
    {id: "C1009", name: "Isla Brown", email: "isla.brown@example.com", verified: true},
    {id: "C1010", name: "Jonas Weber", email: "jonas.weber@example.com", verified: false}
];

export const ORDERS: Order[] = [
    {id: "O5001", customer_id: "C1001", items: [{product: "Wireless Headphones", quantity: 1, price: 129.99}], total: 129.99, status: "delivered", order_date: "2026-09-02"},
    {id: "O5002", customer_id: "C1002", items: [{product: "USB-C Cable", quantity: 3, price: 12.50}], total: 37.50, status: "shipped", order_date: "2026-09-28"},
    {id: "O5003", customer_id: "C1003", items: [{product: "Espresso Machine", quantity: 1, price: 649.00}, {product: "Filters", quantity: 2, price: 6.00}], total: 661.00, status: "delivered", order_date: "2026-08-15"},
    {id: "O5004", customer_id: "C1004", items: [{product: "Office Chair", quantity: 1, price: 349.00}], total: 349.00, status: "processing", order_date: "2026-10-18"},
    {id: "O5005", customer_id: "C1005", items: [{product: "Running Shoes", quantity: 1, price: 119.95}], total: 119.95, status: "returned", order_date: "2026-07-30"},
    {id: "O5006", customer_id: "C1006", items: [{product: "Smart Watch", quantity: 1, price: 249.00}], total: 249.00, status: "delivered", order_date: "2026-09-21"},
    {id: "O5007", customer_id: "C1007", items: [{product: "Standing Desk", quantity: 1, price: 899.00}], total: 899.00, status: "delivered", order_date: "2026-10-05"},
    {id: "O5008", customer_id: "C1008", items: [{product: "Mechanical Keyboard", quantity: 1, price: 159.00}], total: 159.00, status: "shipped", order_date: "2026-10-12"},
    {id: "O5009", customer_id: "C1009", items: [{product: "Yoga Mat", quantity: 1, price: 45.00}], total: 45.00, status: "delivered", order_date: "2026-09-10"},
    {id: "O5010", customer_id: "C1010", items: [{product: "Blender", quantity: 1, price: 79.99}], total: 79.99, status: "delivered", order_date: "2026-08-27"},
    {id: "O5011", customer_id: "C1001", items: [{product: "Phone Case", quantity: 1, price: 24.99}], total: 24.99, status: "delivered", order_date: "2026-10-01"},
    {id: "O5012", customer_id: "C1004", items: [{product: "Monitor Arm", quantity: 1, price: 99.00}], total: 99.00, status: "delivered", order_date: "2026-09-14"}
];
