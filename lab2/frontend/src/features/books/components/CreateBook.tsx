import React, { useState } from 'react';
import { IonButton } from '@ionic/react';
import { Book, emptyBook } from '../book.types';
import { useAddBookMutation } from '../services/booksApi';
import { errorMessage } from '../../../utils/errorMessage';
import BookForm from './BookForm';

interface Props {
    onDone: () => void;
}

const CreateBook: React.FC<Props> = ({ onDone }) => {
    const [book, setBook] = useState<Book>(emptyBook());
    const [addBook, { isLoading, error }] = useAddBookMutation();

    const save = async () => {
        try {
            await addBook(book).unwrap();
            onDone();
        } catch {
            // error is shown through `error`
        }
    };

    return (
        <>
            <BookForm book={book} onChange={setBook} error={errorMessage(error)} />
            <IonButton expand="block" onClick={save} disabled={isLoading}>
                Create
            </IonButton>
        </>
    );
};

export default CreateBook;