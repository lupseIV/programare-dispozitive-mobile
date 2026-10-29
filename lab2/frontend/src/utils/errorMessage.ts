import { ApiError } from '../services/http';

export function errorMessage(err: unknown): string {
    if (!err) return '';
    if (err instanceof ApiError) {
        if (err.status === 0) return 'Cannot reach the server';
        const fields = err.data?.fields ? ': ' + Object.values(err.data.fields).join(', ') : '';
        return (err.data?.error ?? 'Something went wrong') + fields;
    }
    return typeof err === 'string' ? err : 'Something went wrong';
}
