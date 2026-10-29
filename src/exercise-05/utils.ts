// Converts a Unix timestamp (seconds) field to ISO 8601, in place
export function unixToIso(record: Record<string, unknown>, field: string) {
    const value = record[field];
    if (typeof value == 'number') {
        record[field] = new Date(value * 1000).toISOString();
    }
}

// Converts a DD/MM/YYYY string field to ISO 8601 (midnight UTC), in place. Leaves null and other values alone
export function ddMmYyyyToIso(record: Record<string, unknown>, field: string) {
    const value = record[field];
    if (typeof value == 'string') {
        const [dd, mm, yyyy] = value.split('/').map(Number);
        record[field] = new Date(Date.UTC(yyyy, mm - 1, dd)).toISOString();
    }
}

// Status codes from systems that don't use words: numeric from the CRM, single-character from logistics
const STATUS_CODES: Record<string, string> = {
    200: 'found',
    404: 'not found',
    500: 'error',
    P: 'pending',
    S: 'shipped',
    D: 'delivered',
    R: 'returned'
};

// Replaces a status code with its English word, then capitalizes it ("active" -> "Active"), in place
export function normalizeStatus(record: Record<string, unknown>, field = 'status') {
    const value = record[field];
    if (typeof value != 'string' && typeof value != 'number') return;
    const word = STATUS_CODES[value] ?? String(value);
    record[field] = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
