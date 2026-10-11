import React from 'react';
import { IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import { Book } from '../book.types';
import './BookListItem.css';

interface Props {
    book: Book;
}

const BookListItem: React.FC<Props> = ({ book }) => (
    <IonItem className="book-list-item" routerLink={`/books/${book.id}`} detail>
        <IonIcon
            slot="start"
            icon={book.read ? checkmarkCircle : ellipseOutline}
            color={book.read ? 'success' : 'medium'}
        />
        <IonLabel>
            <h2>{book.title}</h2>
            <p>{book.author} · {book.year}</p>
        </IonLabel>
        {book.genre && <IonNote slot="end" className="book-list-item__genre">{book.genre}</IonNote>}
    </IonItem>
);

export default BookListItem;