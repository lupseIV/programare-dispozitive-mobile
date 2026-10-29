import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../store';
import { ApiError, http } from '../../services/http';
import { loadCache, loadPending } from '../../services/offlineStorage';
import { loadSession } from '../../services/session';
import { authenticate, logout, sessionExpired } from '../auth';
import { eventReceived } from '../../store/slices/liveSlice';
import { Book, BookFilters, BookPage, isLocalId, matchesFilters } from './book.types';

export const PAGE_SIZE = 10;

// artificial latency for list requests, so loading states are visible in demos (0 = off)
const FETCH_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** a change made locally that the server has not acknowledged yet */
export interface PendingOp {
    key: string; // create:<tempId> | update:<id> | delete:<id>
    type: 'create' | 'update' | 'delete';
    book: Book; // for creates, book.id is the temporary (negative) id
}

interface BooksState {
    items: Book[]; // server copies of the books loaded so far (pages appended in order)
    cache: Book[]; // last unfiltered first page, shown when the server cannot be reached
    page: number;
    total: number;
    hasMore: boolean;
    loading: boolean;
    error?: string;
    fromCache: boolean;
    filters: BookFilters;
    genres: string[];
    pending: PendingOp[];
    syncing: boolean;
}

const blankState = (): BooksState => ({
    items: [],
    cache: [],
    page: 0,
    total: 0,
    hasMore: false,
    loading: false,
    fromCache: false,
    filters: { q: '', read: 'all', genre: '' },
    genres: [],
    pending: [],
    syncing: false,
});

const stateFor = (userId?: number): BooksState => ({
    ...blankState(),
    cache: userId ? loadCache(userId) : [],
    pending: userId ? loadPending(userId) : [],
});

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

// server-owned fields (and client-only ones) are not part of the request body
const toPayload = (b: Book) => ({
    title: b.title, author: b.author, genre: b.genre, year: b.year, pages: b.pages,
    read: b.read, rating: b.rating, notes: b.notes, version: b.version,
});

function listQuery(filters: BookFilters, page: number) {
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (filters.q.trim()) p.set('q', filters.q.trim());
    if (filters.read !== 'all') p.set('read', String(filters.read === 'read'));
    if (filters.genre) p.set('genre', filters.genre);
    return p.toString();
}

const upsert = (items: Book[], book: Book) => {
    const i = items.findIndex(b => b.id === book.id);
    if (i === -1) items.unshift(book);
    else items[i] = book;
};

const isUnfiltered = (f: BookFilters) => !f.q.trim() && f.read === 'all' && !f.genre;

// ---------- loading ----------

/** page 1 for the current filters (reset) or the next page (append) */
export const fetchBooks = createAsyncThunk<BookPage | null, { reset: boolean }, { state: RootState }>(
    'books/fetch',
    async ({ reset }, { getState }) => {
        const { filters, page } = getState().books;
        await sleep(FETCH_DELAY_MS);
        try {
            return await http<BookPage>(`/books?${listQuery(filters, reset ? 1 : page + 1)}`);
        } catch (e) {
            if (e instanceof ApiError && e.retryable) return null; // fall back to the local copy
            throw e;
        }
    },
);

export const fetchGenres = createAsyncThunk('books/genres', () => http<string[]>('/genres'));

// ---------- writes: REST first, local queue as a fallback ----------

/** resolves to true when the change was only stored locally */
export const saveBook = createAsyncThunk<boolean, Book>('books/save', async (book, { dispatch }) => {
    const enqueue = (op: PendingOp) => {
        dispatch(booksSlice.actions.enqueue(op));
        return true;
    };
    const queueCreate = () => {
        const id = -Date.now();
        return enqueue({ key: `create:${id}`, type: 'create', book: { ...book, id } });
    };

    if (isLocalId(book.id)) {
        // the book only exists on this device so far: edit the queued create
        return enqueue({ key: `create:${book.id}`, type: 'create', book });
    }
    const isNew = book.id === undefined;
    const queue = () => (isNew ? queueCreate() : enqueue({ key: `update:${book.id}`, type: 'update', book }));

    if (isOffline()) return queue();
    try {
        const saved = isNew
            ? await http<Book>('/books', { method: 'POST', body: toPayload(book) })
            : await http<Book>(`/books/${book.id}`, { method: 'PUT', body: toPayload(book) });
        dispatch(booksSlice.actions.serverSaved(saved));
        return false;
    } catch (e) {
        if (e instanceof ApiError && e.retryable) return queue();
        throw e;
    }
});

/** resolves to true when the delete was only stored locally */
export const removeBook = createAsyncThunk<boolean, Book>('books/remove', async (book, { dispatch }) => {
    if (isLocalId(book.id)) {
        dispatch(booksSlice.actions.dropOp(`create:${book.id}`));
        return false;
    }
    const queue = () => {
        dispatch(booksSlice.actions.enqueue({ key: `delete:${book.id}`, type: 'delete', book }));
        return true;
    };
    if (isOffline()) return queue();
    try {
        await http<void>(`/books/${book.id}`, { method: 'DELETE' });
    } catch (e) {
        if (e instanceof ApiError && e.retryable) return queue();
        if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
    dispatch(booksSlice.actions.serverDeleted(book.id!));
    return false;
});

export interface SyncResult {
    sent: number;
    dropped: number; // rejected by the server (e.g. invalid data)
}

type Dispatch = (action: ReturnType<typeof booksSlice.actions.created | typeof booksSlice.actions.deleted>) => unknown;

async function sendOp(op: PendingOp, dispatch: Dispatch) {
    const { book } = op;
    if (op.type === 'create') {
        const saved = await http<Book>('/books', { method: 'POST', body: toPayload(book) });
        dispatch(booksSlice.actions.created({ key: op.key, book: saved }));
    } else if (op.type === 'update') {
        let saved: Book;
        try {
            saved = await http<Book>(`/books/${book.id}`, { method: 'PUT', body: toPayload(book) });
        } catch (e) {
            if (!(e instanceof ApiError && e.status === 409)) throw e;
            // changed elsewhere meanwhile: the local edit wins (version 0 = unconditional update)
            saved = await http<Book>(`/books/${book.id}`, { method: 'PUT', body: { ...toPayload(book), version: 0 } });
        }
        dispatch(booksSlice.actions.created({ key: op.key, book: saved }));
    } else {
        try {
            await http<void>(`/books/${book.id}`, { method: 'DELETE' });
        } catch (e) {
            if (!(e instanceof ApiError && e.status === 404)) throw e;
        }
        dispatch(booksSlice.actions.deleted({ key: op.key, id: book.id! }));
    }
}

let syncInFlight: Promise<SyncResult> | undefined;

/** sends the queued changes in order; stops at the first connectivity problem and keeps the rest */
export const syncPending = createAsyncThunk<SyncResult, void, { state: RootState }>(
    'books/sync',
    (_arg, { dispatch, getState }) => {
        if (syncInFlight) return syncInFlight;
        syncInFlight = (async () => {
            const result: SyncResult = { sent: 0, dropped: 0 };
            if (isOffline()) return result;
            dispatch(booksSlice.actions.syncStarted());
            try {
                for (const op of [...getState().books.pending]) {
                    try {
                        await sendOp(op, dispatch);
                        result.sent++;
                    } catch (e) {
                        if (!(e instanceof ApiError) || e.retryable || e.status === 401) break; // try again later
                        dispatch(booksSlice.actions.dropOp(op.key));
                        result.dropped++;
                    }
                }
            } finally {
                dispatch(booksSlice.actions.syncFinished());
            }
            return result;
        })().finally(() => { syncInFlight = undefined; });
        return syncInFlight;
    },
);

// ---------- slice ----------

const booksSlice = createSlice({
    name: 'books',
    initialState: stateFor(loadSession()?.user.id),
    reducers: {
        setFilters(state, action: PayloadAction<Partial<BookFilters>>) {
            state.filters = { ...state.filters, ...action.payload };
        },
        enqueue(state, { payload: op }: PayloadAction<PendingOp>) {
            const existing = state.pending.find(p => p.key === op.key);
            if (existing) {
                existing.book = op.book;
                return;
            }
            // deleting makes any queued edit of the same book pointless
            state.pending = state.pending.filter(p => !(op.type === 'delete' && p.key === `update:${op.book.id}`));
            state.pending.push(op);
        },
        dropOp(state, { payload: key }: PayloadAction<string>) {
            state.pending = state.pending.filter(p => p.key !== key);
        },
        serverSaved(state, { payload }: PayloadAction<Book>) {
            upsert(state.items, payload);
        },
        serverDeleted(state, { payload: id }: PayloadAction<number>) {
            state.items = state.items.filter(b => b.id !== id);
            state.pending = state.pending.filter(p => p.book.id !== id);
        },
        /** a queued create/update was accepted by the server */
        created(state, { payload }: PayloadAction<{ key: string; book: Book }>) {
            state.pending = state.pending.filter(p => p.key !== payload.key);
            upsert(state.items, payload.book);
        },
        deleted(state, { payload }: PayloadAction<{ key: string; id: number }>) {
            state.pending = state.pending.filter(p => p.key !== payload.key);
            state.items = state.items.filter(b => b.id !== payload.id);
        },
        syncStarted(state) {
            state.syncing = true;
        },
        syncFinished(state) {
            state.syncing = false;
        },
    },
    extraReducers: builder => {
        builder
            .addCase(fetchBooks.pending, state => {
                state.loading = true;
                state.error = undefined;
            })
            .addCase(fetchBooks.fulfilled, (state, { payload, meta }) => {
                state.loading = false;
                if (!payload) {
                    // server unreachable: show what we last saw, filtered locally
                    state.fromCache = true;
                    state.hasMore = false;
                    state.items = state.cache.filter(b => matchesFilters(b, state.filters));
                    state.total = state.items.length;
                    return;
                }
                state.fromCache = false;
                state.items = meta.arg.reset
                    ? payload.items
                    : [...state.items, ...payload.items.filter(n => !state.items.some(b => b.id === n.id))];
                state.page = payload.page;
                state.total = payload.total;
                state.hasMore = payload.page * payload.size < payload.total;
                if (meta.arg.reset && isUnfiltered(state.filters)) state.cache = payload.items;
            })
            .addCase(fetchBooks.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            .addCase(fetchGenres.fulfilled, (state, { payload }) => {
                state.genres = payload;
            })
            .addCase(eventReceived, (state, { payload: event }) => {
                const book = event.payload;
                const known = state.items.some(b => b.id === book.id);
                if (event.type === 'deleted') {
                    if (known) state.total = Math.max(0, state.total - 1);
                    state.items = state.items.filter(b => b.id !== book.id);
                } else if (known) {
                    if (matchesFilters(book, state.filters)) upsert(state.items, book);
                    else state.items = state.items.filter(b => b.id !== book.id);
                } else if (event.type === 'created' && !state.fromCache && matchesFilters(book, state.filters)) {
                    state.items.unshift(book);
                    state.total += 1;
                }
            })
            // a different account may log in on this device: start from that account's local data
            .addCase(authenticate.fulfilled, (_state, { payload }) => stateFor(payload.user.id))
            .addCase(logout.pending, () => blankState())
            .addCase(sessionExpired, () => blankState());
    },
});

export const { setFilters } = booksSlice.actions;
export default booksSlice.reducer;

// ---------- selectors ----------

/** server copies + local changes, in display order */
export const selectVisibleBooks = createSelector(
    [(s: RootState) => s.books.items, (s: RootState) => s.books.pending, (s: RootState) => s.books.filters],
    (items, pending, filters) => {
        const deleted = new Set(pending.filter(p => p.type === 'delete').map(p => p.book.id));
        const edited = new Map(pending.filter(p => p.type === 'update').map(p => [p.book.id, p.book]));
        const created = pending
            .filter(p => p.type === 'create' && matchesFilters(p.book, filters))
            .map(p => ({ ...p.book, pendingSync: true }))
            .reverse();
        const server = items
            .filter(b => !deleted.has(b.id))
            .map(b => (edited.has(b.id) ? { ...edited.get(b.id)!, pendingSync: true } : b));
        return [...created, ...server];
    },
);

export const selectBookById = (id: number) => (s: RootState): Book | undefined => {
    const op = s.books.pending.find(p => p.book.id === id && p.type !== 'delete');
    if (op) return { ...op.book, pendingSync: true };
    return s.books.items.find(b => b.id === id);
};

export const selectPendingCount = (s: RootState) => s.books.pending.length;

export const selectGenres = createSelector(
    [(s: RootState) => s.books.genres, (s: RootState) => s.books.items],
    (genres, items) => [...new Set([...genres, ...items.map(b => b.genre).filter(Boolean)])].sort(),
);
