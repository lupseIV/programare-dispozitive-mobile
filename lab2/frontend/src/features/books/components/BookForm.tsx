import React from 'react';
import {
    IonInput, IonItem, IonLabel, IonList, IonRange, IonText, IonTextarea, IonToggle,
} from '@ionic/react';
import { Book } from '../book.types';
import './BookForm.css';

interface Props {
    book: Book;
    onChange: (book: Book) => void;
    error?: string;
}

const BookForm: React.FC<Props> = ({ book, onChange, error }) => {
    const set = <K extends keyof Book>(key: K, value: Book[K]) => onChange({ ...book, [key]: value });

    return (
        <div className="book-form">
            {error && <IonText color="danger"><p className="book-form__error">{error}</p></IonText>}

            <IonList inset>
                <IonItem>
                    <IonInput label="Title" labelPlacement="stacked" value={book.title}
                              onIonInput={e => set('title', e.detail.value ?? '')} />
                </IonItem>
                <IonItem>
                    <IonInput label="Author" labelPlacement="stacked" value={book.author}
                              onIonInput={e => set('author', e.detail.value ?? '')} />
                </IonItem>
                <IonItem>
                    <IonInput label="Genre" labelPlacement="stacked" value={book.genre}
                              onIonInput={e => set('genre', e.detail.value ?? '')} />
                </IonItem>
                <IonItem>
                    <IonInput label="Year" labelPlacement="stacked" type="number" value={book.year}
                              onIonInput={e => set('year', Number(e.detail.value) || 0)} />
                </IonItem>
                <IonItem>
                    <IonInput label="Pages" labelPlacement="stacked" type="number" value={book.pages}
                              onIonInput={e => set('pages', Number(e.detail.value) || 0)} />
                </IonItem>
                <IonItem>
                    <IonToggle checked={book.read} onIonChange={e => set('read', e.detail.checked)}>
                        Read
                    </IonToggle>
                </IonItem>
                <IonItem>
                    <IonLabel className="book-form__rating-label">Rating: {book.rating || '–'}</IonLabel>
                    <IonRange min={0} max={5} step={1} snaps ticks value={book.rating}
                              onIonChange={e => set('rating', e.detail.value as number)} />
                </IonItem>
                <IonItem>
                    <IonTextarea label="Notes" labelPlacement="stacked" autoGrow value={book.notes}
                                 onIonInput={e => set('notes', e.detail.value ?? '')} />
                </IonItem>
            </IonList>
        </div>
    );
};

export default BookForm;