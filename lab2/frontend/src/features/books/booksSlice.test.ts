import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../store';
import { emptyBook } from './book.types';
import { removeBook, saveBook, selectPendingCount, selectVisibleBooks, syncPending } from './booksSlice';

const setOnline = (v: boolean) =>
    Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });

const json = (status: number, body?: unknown) =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

describe('offline queue', () => {
    beforeEach(() => setOnline(true));
    afterEach(() => vi.restoreAllMocks());

    it('stores a new book locally when the server is unreachable and sends it later', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        const queued = await store.dispatch(saveBook({ ...emptyBook(), title: 'Offline', author: 'Me' })).unwrap();
        expect(queued).toBe(true);
        expect(selectPendingCount(store.getState())).toBe(1);
        expect(selectVisibleBooks(store.getState())[0]).toMatchObject({ title: 'Offline', pendingSync: true });

        // still failing: the change stays in the queue
        await store.dispatch(syncPending());
        expect(selectPendingCount(store.getState())).toBe(1);

        fetchMock.mockImplementation(() => json(201, { ...emptyBook(), id: 7, title: 'Offline', author: 'Me' }));
        const result = await store.dispatch(syncPending()).unwrap();
        expect(result.sent).toBe(1);
        expect(selectPendingCount(store.getState())).toBe(0);
        expect(selectVisibleBooks(store.getState())[0]).toMatchObject({ id: 7 });
        expect(selectVisibleBooks(store.getState())[0].pendingSync).toBeUndefined();
    });

    it('does not touch the network while the device is offline', async () => {
        setOnline(false);
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        const book = selectVisibleBooks(store.getState())[0];
        expect(await store.dispatch(removeBook(book)).unwrap()).toBe(true); // delete is queued
        expect(await store.dispatch(saveBook({ ...emptyBook(), title: 'x', author: 'y' })).unwrap()).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces validation errors instead of queueing them', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
            json(400, { error: 'validation failed', fields: { title: 'title is required' } }));
        const before = selectPendingCount(store.getState());
        await expect(store.dispatch(saveBook(emptyBook())).unwrap()).rejects.toBeDefined();
        expect(selectPendingCount(store.getState())).toBe(before);
    });
});
