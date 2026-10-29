import type { User } from '../features/auth';

const KEY = 'auth';

export interface Session {
    token: string;
    user: User;
}

export function loadSession(): Session | null {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
        return null;
    }
}

export function saveSession(session: Session) {
    try {
        localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
        // storage unavailable: the user will simply have to log in again next time
    }
}

export function clearSession() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // ignore
    }
}

export const getToken = () => loadSession()?.token;
