import React from 'react';
import { IonButton, useIonAlert } from '@ionic/react';
import { Book } from '../book.types';
import { useDeleteBookMutation } from '../services/booksApi';

interface Props {
    book: Book;
    onDeleted: () => void;
}

const DeleteBookButton: React.FC<Props> = ({ book, onDeleted }) => {
    const [presentAlert] = useIonAlert();
    const [deleteBook, { isLoading }] = useDeleteBookMutation();

    const confirm = () =>
        presentAlert({
            header: 'Delete book?',
            message: `"${book.title}" will be removed.`,
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                    text: 'Delete',
                    role: 'destructive',
                    handler: async () => {
                        await deleteBook(book.id!).unwrap();
                        onDeleted();
                    },
                },
            ],
        });

    return (
        <IonButton expand="block" color="danger" fill="outline" onClick={confirm} disabled={isLoading}>
            Delete
        </IonButton>
    );
};

export default DeleteBookButton;