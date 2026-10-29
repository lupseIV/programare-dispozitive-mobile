import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionExpired } from '../features/auth/authSlice';
import booksReducer from '../features/books/booksSlice';
import { setUnauthorizedHandler } from '../services/http';
import { saveCache, savePending } from '../services/offlineStorage';
import liveReducer from './slices/liveSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        books: booksReducer,
        live: liveReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));

// keep the offline queue and the list cache on disk (only when they actually changed)
let lastPending = store.getState().books.pending;
let lastCache = store.getState().books.cache;
store.subscribe(() => {
    const { auth, books } = store.getState();
    const userId = auth.user?.id;
    if (!userId) {
        lastPending = books.pending;
        lastCache = books.cache;
        return;
    }
    if (books.pending !== lastPending) {
        lastPending = books.pending;
        savePending(userId, books.pending);
    }
    if (books.cache !== lastCache) {
        lastCache = books.cache;
        saveCache(userId, books.cache);
    }
});
