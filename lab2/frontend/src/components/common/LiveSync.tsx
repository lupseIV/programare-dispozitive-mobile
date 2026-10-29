import { useEffect } from 'react';
import { WS_URL } from '../../config/env';
import { syncPending } from '../../features/books/booksSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { connectionChanged, eventReceived, notify } from '../../store/slices/liveSlice';
import type { BookEvent } from '../../features/books/book.types';

/**
 * Mounted only while a user is logged in. Tracks the device's network status, keeps the
 * authenticated websocket open and flushes the offline queue whenever connectivity returns.
 */
const LiveSync: React.FC = () => {
    const dispatch = useAppDispatch();
    const token = useAppSelector(s => s.auth.token);

    useEffect(() => {
        const flush = () =>
            dispatch(syncPending()).unwrap().then(({ sent, dropped }) => {
                if (sent) dispatch(notify(`${sent} offline change${sent > 1 ? 's' : ''} sent to the server`));
                else if (dropped) dispatch(notify(`${dropped} offline change${dropped > 1 ? 's were' : ' was'} rejected by the server`));
            });

        const goOnline = () => void flush();
        window.addEventListener('online', goOnline);

        return () => {
            window.removeEventListener('online', goOnline);
        };
    }, [dispatch]);

    useEffect(() => {
        if (!token) return;
        let ws: WebSocket | undefined;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;

        const connect = () => {
            ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
            ws.onopen = () => {
                dispatch(connectionChanged(true));
                // the server is reachable again: send what was stored while we were away
                dispatch(syncPending()).unwrap().then(({ sent }) => {
                    if (sent) dispatch(notify(`${sent} offline change${sent > 1 ? 's' : ''} sent to the server`));
                });
            };
            ws.onclose = () => {
                dispatch(connectionChanged(false));
                if (!stopped) retry = setTimeout(connect, 3000);
            };
            ws.onerror = () => ws?.close();
            ws.onmessage = msg => dispatch(eventReceived(JSON.parse(msg.data) as BookEvent));
        };
        connect();

        return () => {
            stopped = true;
            clearTimeout(retry);
            ws?.close();
            dispatch(connectionChanged(false));
        };
    }, [token, dispatch]);

    return null;
};

export default LiveSync;
