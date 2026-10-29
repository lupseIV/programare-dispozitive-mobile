import React, { useEffect, useState } from 'react';
import {
    IonContent, IonFab, IonFabButton, IonIcon, IonList, IonLoading, IonPage, IonRefresher,
    IonRefresherContent, IonSearchbar, IonToast, IonToolbar, RefresherEventDetail,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { BookListItem, useGetBooksQuery } from '../features/books';
import { useAppSelector } from '../store/hooks';
import { errorMessage } from '../utils/errorMessage';
import PageHeader from '../components/layout/PageHeader';
import ConnectionBadge from '../components/common/ConnectionBadge';
import './BooksPage.css';

const BooksPage: React.FC = () => {
    const { data: books = [], isLoading, error, refetch } = useGetBooksQuery();
    const connected = useAppSelector(state => state.live.connected);
    const lastEvent = useAppSelector(state => state.live.lastEvent);

    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<string>();

    useEffect(() => {
        if (lastEvent) setToast(`Book "${lastEvent.payload.title}" was ${lastEvent.type}`);
    }, [lastEvent]);

    const filtered = books.filter(b =>
        (b.title + ' ' + b.author).toLowerCase().includes(search.toLowerCase()));

    const refresh = async (e: CustomEvent<RefresherEventDetail>) => {
        await refetch();
        e.detail.complete();
    };

    return (
        <IonPage>
            <PageHeader title="My Books" end={<ConnectionBadge connected={connected} />}>
                <IonToolbar>
                    <IonSearchbar
                        value={search}
                        debounce={200}
                        placeholder="Search title or author"
                        onIonInput={e => setSearch(e.detail.value ?? '')}
                    />
                </IonToolbar>
            </PageHeader>

            <IonContent>
                <IonRefresher slot="fixed" onIonRefresh={refresh}>
                    <IonRefresherContent />
                </IonRefresher>

                <IonLoading isOpen={isLoading} message="Loading books..." />
                {error && <p className="books-page__error">{errorMessage(error)}</p>}

                <IonList>
                    {filtered.map(book => <BookListItem key={book.id} book={book} />)}
                </IonList>

                {!isLoading && !error && filtered.length === 0 && (
                    <p className="books-page__empty">No books found.</p>
                )}

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
                    <IonFabButton routerLink="/books/new">
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>

                <IonToast
                    isOpen={!!toast}
                    message={toast}
                    duration={2000}
                    position="top"
                    onDidDismiss={() => setToast(undefined)}
                />
            </IonContent>
        </IonPage>
    );
};

export default BooksPage;