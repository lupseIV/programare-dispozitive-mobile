import React, { useEffect, useState } from 'react';
import { IonButton, IonSpinner, IonText } from '@ionic/react';
import { Book } from '../book.types';
import { saveBook, selectBookById } from '../booksSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { notify } from '../../../store/slices/liveSlice';
import { http } from '../../../services/http';
import { errorMessage } from '../../../utils/errorMessage';
import BookForm from './BookForm';
import DeleteBookButton from './DeleteBookButton';
import './EditBook.css';

interface Props {
    bookId: number;
    onDone: () => void;
}

const EditBook: React.FC<Props> = ({ bookId, onDone }) => {
    const dispatch = useAppDispatch();
    const [book, setBook] = useState<Book>();
    const [loadError, setLoadError] = useState<unknown>();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<unknown>();

    // the list may not contain this book (other page, deep link): then ask the server
    const known = useAppSelector(selectBookById(bookId));
    useEffect(() => {
        if (!book && known) setBook(known);
    }, [book, known]);
    useEffect(() => {
        if (known || book || bookId < 0) return;
        http<Book>(`/books/${bookId}`).then(setBook, setLoadError);
    }, [bookId, known, book]);

    const save = async () => {
        if (!book) return;
        setSaving(true);
        setSaveError(undefined);
        try {
            const savedLocally = await dispatch(saveBook(book)).unwrap();
            if (savedLocally) dispatch(notify('Saved on this device - will be sent when the server is reachable'));
            onDone();
        } catch (e) {
            setSaveError(e);
            setSaving(false);
        }
    };

    if (loadError) return <IonText color="danger"><p>{errorMessage(loadError)}</p></IonText>;
    if (!book) return <div className="edit-book__loading"><IonSpinner /></div>;

    return (
        <>
            <BookForm book={book} onChange={setBook} error={errorMessage(saveError)} />

            <div className="edit-book__actions">
                <IonButton expand="block" onClick={save} disabled={saving}>
                    Save
                </IonButton>
                <DeleteBookButton book={book} onDeleted={onDone} />
            </div>
        </>
    );
};

export default EditBook;
