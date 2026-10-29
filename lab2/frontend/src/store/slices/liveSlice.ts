import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BookEvent } from '../../features/books';

interface LiveState {
    connected: boolean;
    lastEvent?: BookEvent;
}

const initialState: LiveState = { connected: false };

const liveSlice = createSlice({
    name: 'live',
    initialState,
    reducers: {
        connectionChanged(state, action: PayloadAction<boolean>) {
            state.connected = action.payload;
        },
        eventReceived(state, action: PayloadAction<BookEvent>) {
            state.lastEvent = action.payload;
        },
    },
});

export const { connectionChanged, eventReceived } = liveSlice.actions;
export default liveSlice.reducer;