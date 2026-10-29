export interface Book {
    id?: number;
    title: string;
    author: string;
    genre: string;
    year: number;
    pages: number;
    read: boolean;
    rating: number; // 0..5
    notes: string;
    createdAt?: string;
    updatedAt?: string;
    version?: number;
    /** client-only: this book has changes that were not sent to the server yet */
    pendingSync?: boolean;
}

export interface BookEvent {
    type: 'created' | 'updated' | 'deleted';
    payload: Book;
}

export interface BookPage {
    items: Book[];
    total: number;
    page: number;
    size: number;
}

export type ReadFilter = 'all' | 'read' | 'unread';

export interface BookFilters {
    q: string;
    read: ReadFilter;
    genre: string; // '' = any
}

export const emptyBook = (): Book => ({
    title: '',
    author: '',
    genre: '',
    year: new Date().getFullYear(),
    pages: 0,
    read: false,
    rating: 0,
    notes: '',
});

/** books created while offline get a negative temporary id until the server assigns a real one */
export const isLocalId = (id?: number) => id !== undefined && id < 0;

export function matchesFilters(b: Book, f: BookFilters): boolean {
    const q = f.q.trim().toLowerCase();
    if (q && !(b.title + ' ' + b.author).toLowerCase().includes(q)) return false;
    if (f.read !== 'all' && b.read !== (f.read === 'read')) return false;
    return !f.genre || b.genre === f.genre;
}
