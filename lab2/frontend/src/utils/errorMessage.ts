export function errorMessage(err: unknown): string {
    if (!err) return '';
    const e = err as { status?: unknown; data?: { error?: string; fields?: Record<string, string> } };
    if (e.data?.error) {
        const fields = e.data.fields ? ': ' + Object.values(e.data.fields).join(', ') : '';
        return e.data.error + fields;
    }
    if (e.status === 'FETCH_ERROR') return 'Cannot reach the server';
    return 'Something went wrong';
}