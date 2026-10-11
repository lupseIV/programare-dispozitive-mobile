import React, { useEffect, useState } from 'react';
import { IonButton, IonSpinner, IonText } from '@ionic/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Book } from '../book.types';
import { useGetBookQuery, useGetBooksQuery, useUpdateBookMutation } from '../services/booksApi';
import { errorMessage } from '../../../utils/errorMessage';
import BookForm from './BookForm';
import DeleteBookButton from './DeleteBookButton';
import './EditBook.css';

interface Props {
    bookId: number;
    onDone: () => void;
}

const EditBook: React.FC<Props> = ({ bookId, onDone }) => {
    const [book, setBook] = useState<Book>();

    const { fromList, listLoaded } = useGetBooksQuery(undefined, {
        selectFromResult: ({ data, isSuccess }) => ({
            fromList: data?.find(b => b.id === bookId),
            listLoaded: isSuccess,
        }),
    });
    const { data: fetched, error: loadError } = useGetBookQuery(fromList || book ? skipToken : bookId);

    const [updateBook, { isLoading, error: saveError }] = useUpdateBookMutation();

    const serverBook = fromList ?? fetched;
    useEffect(() => {
        if (!book && serverBook) setBook(serverBook);
    }, [book, serverBook]);

    const deletedOnServer = !!book && listLoaded && !fromList;

    const save = async () => {
        if (!book) return;
        try {
            await updateBook(book).unwrap();
            onDone();
        } catch {
            // error is shown through `saveError`
        }
    };

    if (loadError) return <IonText color="danger"><p>{errorMessage(loadError)}</p></IonText>;
    if (!book) return <div className="edit-book__loading"><IonSpinner /></div>;

    return (
        <>
            {deletedOnServer && (
            <IonText color="warning">
            <p className="edit-book__warning">This book was deleted on the server.</p>
    </IonText>
)}

    <BookForm book={book} onChange={setBook} error={errorMessage(saveError)} />

    <div className="edit-book__actions">
    <IonButton expand="block" onClick={save} disabled={isLoading || deletedOnServer}>
    Save
    </IonButton>
    <DeleteBookButton book={book} onDeleted={onDone} />
    </div>
    </>
);
};

export default EditBook;