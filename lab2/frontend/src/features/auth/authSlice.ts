import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { http } from '../../services/http';
import { clearSession, loadSession, saveSession } from '../../services/session';
import { AuthResponse, Credentials, User } from './auth.types';

interface AuthState {
    token?: string;
    user?: User;
}

const stored = loadSession();
const initialState: AuthState = { token: stored?.token, user: stored?.user };

export const authenticate = createAsyncThunk(
    'auth/authenticate',
    async (credentials: Credentials) => {
        const res = await http<AuthResponse>('/auth/login', { method: 'POST', body: credentials, auth: false });
        saveSession(res);
        return res;
    },
);

export const logout = createAsyncThunk('auth/logout', async () => {
    // best effort: invalidate the token on the server, but always log out locally
    await http<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearSession();
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        /** the server rejected our token (see setUnauthorizedHandler) */
        sessionExpired(state) {
            state.token = undefined;
            state.user = undefined;
        },
    },
    extraReducers: builder => {
        builder
            .addCase(authenticate.fulfilled, (state, { payload }) => {
                state.token = payload.token;
                state.user = payload.user;
            })
            .addCase(logout.pending, state => {
                state.token = undefined;
                state.user = undefined;
            });
    },
});

export const { sessionExpired } = authSlice.actions;
export default authSlice.reducer;
