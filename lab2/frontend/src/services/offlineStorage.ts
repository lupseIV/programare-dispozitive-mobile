import type { Book } from '../features/books/book.types';
import type { PendingOp } from '../features/books/booksSlice';

// Everything is namespaced by user id so two accounts on one device never see each other's data.
const key = (kind: string, userId: number) => `books.${kind}.${userId}`;

function read<T>(k: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(k);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function write(k: string, value: unknown) {
    try {
        localStorage.setItem(k, JSON.stringify(value));
    } catch {
        // quota exceeded / storage disabled: offline support degrades, the app keeps working
    }
}

export const loadPending = (userId: number) => read<PendingOp[]>(key('pending', userId), []);
export const savePending = (userId: number, ops: PendingOp[]) => write(key('pending', userId), ops);
export const loadCache = (userId: number) => read<Book[]>(key('cache', userId), []);
export const saveCache = (userId: number, books: Book[]) => write(key('cache', userId), books);
