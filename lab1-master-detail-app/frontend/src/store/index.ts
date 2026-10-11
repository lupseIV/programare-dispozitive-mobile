import { configureStore } from '@reduxjs/toolkit';
import { api } from '../services/api';
import liveReducer from './slices/liveSlice';

export const store = configureStore({
    reducer: {
        [api.reducerPath]: api.reducer,
        live: liveReducer,
    },
    middleware: getDefault => getDefault().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;