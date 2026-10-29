import React, { useState } from 'react';
import { IonButton, useIonAlert } from '@ionic/react';
import { Book } from '../book.types';
import { removeBook } from '../booksSlice';
import { useAppDispatch } from '../../../store/hooks';
import { notify } from '../../../store/slices/liveSlice';
import { errorMessage } from '../../../utils/errorMessage';

interface Props {
    book: Book;
    onDeleted: () => void;
}

const DeleteBookButton: React.FC<Props> = ({ book, onDeleted }) => {
    const dispatch = useAppDispatch();
    const [presentAlert] = useIonAlert();
    const [busy, setBusy] = useState(false);

    const remove = async () => {
        setBusy(true);
        try {
            const savedLocally = await dispatch(removeBook(book)).unwrap();
            if (savedLocally) dispatch(notify('Deleted on this device - will be sent when the server is reachable'));
            onDeleted();
        } catch (e) {
            setBusy(false);
            presentAlert({ header: 'Could not delete', message: errorMessage(e), buttons: ['OK'] });
        }
    };

    const confirm = () =>
        presentAlert({
            header: 'Delete book?',
            message: `"${book.title}" will be removed.`,
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                { text: 'Delete', role: 'destructive', handler: remove },
            ],
        });

    return (
        <IonButton expand="block" color="danger" fill="outline" onClick={confirm} disabled={busy}>
            Delete
        </IonButton>
    );
};

export default DeleteBookButton;
