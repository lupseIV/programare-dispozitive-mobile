import React from 'react';
import { useParams } from 'react-router-dom';
import { IonContent, IonPage, useIonRouter } from '@ionic/react';
import { CreateBook, EditBook } from '../features/books';
import PageHeader from '../components/layout/PageHeader';
import './BookDetailsPage.css';

const BookDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isNew = id === 'new';
    const router = useIonRouter();
    const goBack = () => router.goBack();

    return (
        <IonPage>
            <PageHeader title={isNew ? 'New book' : 'Edit book'} backHref="/books" />
            <IonContent className="book-details-page">
                <div className="book-details-page__container">
                    {isNew
                        ? <CreateBook onDone={goBack} />
                        : <EditBook key={id} bookId={Number(id)} onDone={goBack} />}
                </div>
            </IonContent>
        </IonPage>
    );
};

export default BookDetailsPage;