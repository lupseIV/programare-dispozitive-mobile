import { API_URL } from '../config/env';
import { clearSession, getToken } from './session';

export class ApiError extends Error {
    constructor(
        public status: number, // 0 = the server could not be reached
        public data?: { error?: string; fields?: Record<string, string>; current?: unknown },
    ) {
        super(data?.error ?? (status === 0 ? 'Cannot reach the server' : `HTTP ${status}`));
    }

    /** request never got an answer, or the server failed: worth keeping the data locally and retrying later */
    get retryable() {
        return this.status === 0 || this.status >= 500;
    }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

interface Options {
    method?: string;
    body?: unknown;
    auth?: boolean;
}

export async function http<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
        res = await fetch(API_URL + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(0);
    }

    const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    if (!res.ok) {
        if (res.status === 401 && auth) {
            clearSession();
            onUnauthorized();
        }
        throw new ApiError(res.status, data);
    }
    return data as T;
}
