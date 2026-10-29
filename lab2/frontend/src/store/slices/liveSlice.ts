import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { BookEvent } from '../../features/books/book.types';

interface LiveState {
    online: boolean; // device has network access (navigator.onLine)
    connected: boolean; // websocket to the server is open => the server is reachable
    notice?: string; // short message shown as a toast on the list page
}

const initialState: LiveState = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    connected: false,
};

const liveSlice = createSlice({
    name: 'live',
    initialState,
    reducers: {
        onlineChanged(state, action: PayloadAction<boolean>) {
            state.online = action.payload;
        },
        connectionChanged(state, action: PayloadAction<boolean>) {
            state.connected = action.payload;
        },
        eventReceived(state, action: PayloadAction<BookEvent>) {
            const { type, payload } = action.payload;
            state.notice = `Book "${payload.title}" was ${type}`;
        },
        notify(state, action: PayloadAction<string | undefined>) {
            state.notice = action.payload;
        },
    },
});

export const { onlineChanged, connectionChanged, eventReceived, notify } = liveSlice.actions;
export default liveSlice.reducer;
