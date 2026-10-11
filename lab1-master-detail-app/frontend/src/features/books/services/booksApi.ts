import { api } from '../../../services/api';
import { WS_URL } from '../../../config/env';
import { connectionChanged, eventReceived } from '../../../store/slices/liveSlice';
import { Book, BookEvent } from '../book.types';

export const booksApi = api
    .enhanceEndpoints({ addTagTypes: ['Book'] })
    .injectEndpoints({
        endpoints: build => ({
            getBooks: build.query<Book[], void>({
                query: () => '/books?size=200',
                transformResponse: (res: { items: Book[] }) => res.items,
                providesTags: result => [
                    { type: 'Book', id: 'LIST' },
                    ...(result ?? []).map(b => ({ type: 'Book' as const, id: b.id })),
                ],

                async onCacheEntryAdded(_arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch }) {
                    let ws: WebSocket | undefined;
                    let retry: ReturnType<typeof setTimeout> | undefined;
                    let stopped = false;

                    const connect = () => {
                        ws = new WebSocket(WS_URL);
                        ws.onopen = () => dispatch(connectionChanged(true));
                        ws.onclose = () => {
                            dispatch(connectionChanged(false));
                            if (!stopped) retry = setTimeout(connect, 3000);
                        };
                        ws.onerror = () => ws?.close();
                        ws.onmessage = msg => {
                            const event: BookEvent = JSON.parse(msg.data);
                            updateCachedData(books => {
                                const i = books.findIndex(b => b.id === event.payload.id);
                                if (event.type === 'deleted') {
                                    if (i !== -1) books.splice(i, 1);
                                } else if (i !== -1) {
                                    books[i] = event.payload;
                                } else {
                                    books.unshift(event.payload);
                                }
                            });
                            dispatch(eventReceived(event));
                        };
                    };

                    try {
                        await cacheDataLoaded;
                        connect();
                    } catch {
                        // cache entry removed before data loaded
                    }
                    await cacheEntryRemoved; // nobody uses getBooks anymore -> clean up
                    stopped = true;
                    clearTimeout(retry);
                    ws?.close();
                },
            }),

            getBook: build.query<Book, number>({
                query: id => `/books/${id}`,
                providesTags: (_r, _e, id) => [{ type: 'Book', id }],
            }),

            addBook: build.mutation<Book, Book>({
                query: book => ({ url: '/books', method: 'POST', body: book }),
                invalidatesTags: [{ type: 'Book', id: 'LIST' }],
            }),

            updateBook: build.mutation<Book, Book>({
                query: book => ({ url: `/books/${book.id}`, method: 'PUT', body: book }),
                invalidatesTags: (_r, _e, book) => [{ type: 'Book', id: book.id }],
            }),

            // DELETE /api/books/:id
            deleteBook: build.mutation<void, number>({
                query: id => ({ url: `/books/${id}`, method: 'DELETE' }),
                invalidatesTags: (_r, _e, id) => [{ type: 'Book', id }],
            }),
        }),
    });

export const {
    useGetBooksQuery,
    useGetBookQuery,
    useAddBookMutation,
    useUpdateBookMutation,
    useDeleteBookMutation,
} = booksApi;