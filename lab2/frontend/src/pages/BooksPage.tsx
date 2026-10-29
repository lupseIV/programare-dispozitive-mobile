import React, { useEffect } from 'react';
import {
    InfiniteScrollCustomEvent, IonButton, IonContent, IonFab, IonFabButton, IonIcon, IonInfiniteScroll,
    IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonPage, IonRefresher, IonRefresherContent,
    IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonToast, IonToolbar,
    RefresherEventDetail,
} from '@ionic/react';
import { add, cloudUploadOutline, logOutOutline } from 'ionicons/icons';
import {
    BookListItem, fetchBooks, fetchGenres, ReadFilter, selectGenres, selectPendingCount, selectVisibleBooks,
    setFilters, syncPending,
} from '../features/books';
import { logout } from '../features/auth';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { notify } from '../store/slices/liveSlice';
import { errorMessage } from '../utils/errorMessage';
import PageHeader from '../components/layout/PageHeader';
import ConnectionBadge from '../components/common/ConnectionBadge';
import './BooksPage.css';

const BooksPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const books = useAppSelector(selectVisibleBooks);
    const genres = useAppSelector(selectGenres);
    const pendingCount = useAppSelector(selectPendingCount);
    const { filters, loading, error, hasMore, total, fromCache, syncing } = useAppSelector(s => s.books);
    const { online, connected, notice } = useAppSelector(s => s.live);
    const username = useAppSelector(s => s.auth.user?.username);

    // (re)load the first page whenever the search / filters change
    useEffect(() => {
        void dispatch(fetchBooks({ reset: true }));
    }, [dispatch, filters]);

    useEffect(() => {
        void dispatch(fetchGenres());
    }, [dispatch]);

    // the server came back after we showed locally cached data: load the real thing
    useEffect(() => {
        if (connected && fromCache) void dispatch(fetchBooks({ reset: true }));
    }, [connected, fromCache, dispatch]);

    const refresh = async (e: CustomEvent<RefresherEventDetail>) => {
        await dispatch(syncPending());
        await dispatch(fetchBooks({ reset: true }));
        e.detail.complete();
    };

    const loadMore = async (e: InfiniteScrollCustomEvent) => {
        await dispatch(fetchBooks({ reset: false }));
        await e.target.complete();
    };

    const syncNow = async () => {
        const { sent, dropped } = await dispatch(syncPending()).unwrap();
        if (sent) dispatch(notify(`${sent} change${sent > 1 ? 's' : ''} sent to the server`));
        else if (dropped) dispatch(notify('The server rejected some changes'));
        else dispatch(notify('Server not reachable yet'));
    };

    return (
        <IonPage>
            <PageHeader
                title={username ? `${username}'s books` : 'My Books'}
                end={<>
                    <ConnectionBadge />
                    <IonButton aria-label="Log out" onClick={() => dispatch(logout())}>
                        <IonIcon slot="icon-only" icon={logOutOutline} />
                    </IonButton>
                </>}
            >
                <IonToolbar>
                    <IonSearchbar
                        value={filters.q}
                        debounce={300}
                        placeholder="Search title or author"
                        onIonInput={e => dispatch(setFilters({ q: e.detail.value ?? '' }))}
                    />
                </IonToolbar>
                <IonToolbar>
                    <IonSegment
                        value={filters.read}
                        onIonChange={e => dispatch(setFilters({ read: e.detail.value as ReadFilter }))}
                    >
                        <IonSegmentButton value="all"><IonLabel>All</IonLabel></IonSegmentButton>
                        <IonSegmentButton value="unread"><IonLabel>Unread</IonLabel></IonSegmentButton>
                        <IonSegmentButton value="read"><IonLabel>Read</IonLabel></IonSegmentButton>
                    </IonSegment>
                </IonToolbar>
            </PageHeader>

            <IonContent>
                <IonRefresher slot="fixed" onIonRefresh={refresh}>
                    <IonRefresherContent />
                </IonRefresher>

                <IonItem lines="none">
                    <IonSelect
                        label="Genre"
                        interface="popover"
                        value={filters.genre}
                        onIonChange={e => dispatch(setFilters({ genre: e.detail.value ?? '' }))}
                    >
                        <IonSelectOption value="">Any</IonSelectOption>
                        {genres.map(g => <IonSelectOption key={g} value={g}>{g}</IonSelectOption>)}
                    </IonSelect>
                </IonItem>

                {pendingCount > 0 && (
                    <IonItem color="warning" lines="none">
                        <IonLabel className="ion-text-wrap">
                            {pendingCount} change{pendingCount > 1 ? 's' : ''} not sent to the server yet
                            {!online && ' (offline)'}
                        </IonLabel>
                        <IonButton slot="end" fill="outline" color="dark" disabled={!online || syncing} onClick={syncNow}>
                            {syncing ? <IonSpinner name="dots" /> : <IonIcon slot="start" icon={cloudUploadOutline} />}
                            Send
                        </IonButton>
                    </IonItem>
                )}

                {fromCache && (
                    <p className="books-page__cache-note">Showing saved data - the server is not reachable.</p>
                )}
                {error && <p className="books-page__error">{errorMessage(error)}</p>}

                <IonList>
                    {books.map(book => <BookListItem key={book.id} book={book} />)}
                </IonList>

                {loading && books.length === 0 && <div className="books-page__empty"><IonSpinner /></div>}
                {!loading && !error && books.length === 0 && (
                    <p className="books-page__empty">No books found.</p>
                )}
                {books.length > 0 && !hasMore && (
                    <p className="books-page__count">{fromCache ? books.length : total} book{books.length === 1 ? '' : 's'}</p>
                )}

                <IonInfiniteScroll className="books-page__more" threshold="100px" disabled={!hasMore || loading} onIonInfinite={loadMore}>
                    <IonInfiniteScrollContent loadingSpinner="dots" loadingText="Loading more books..." />
                </IonInfiniteScroll>

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton routerLink="/books/new">
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>

                <IonToast
                    isOpen={!!notice}
                    message={notice}
                    duration={2500}
                    position="top"
                    onDidDismiss={() => dispatch(notify(undefined))}
                />
            </IonContent>
        </IonPage>
    );
};

export default BooksPage;
