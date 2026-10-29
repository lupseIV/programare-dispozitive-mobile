import React, { useState } from 'react';
import { IonButton } from '@ionic/react';
import { Book, emptyBook } from '../book.types';
import { saveBook } from '../booksSlice';
import { useAppDispatch } from '../../../store/hooks';
import { notify } from '../../../store/slices/liveSlice';
import { errorMessage } from '../../../utils/errorMessage';
import BookForm from './BookForm';

interface Props {
    onDone: () => void;
}

const CreateBook: React.FC<Props> = ({ onDone }) => {
    const dispatch = useAppDispatch();
    const [book, setBook] = useState<Book>(emptyBook());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<unknown>();

    const save = async () => {
        setSaving(true);
        setError(undefined);
        try {
            const savedLocally = await dispatch(saveBook(book)).unwrap();
            if (savedLocally) dispatch(notify('Saved on this device - will be sent when the server is reachable'));
            onDone();
        } catch (e) {
            setError(e);
            setSaving(false);
        }
    };

    return (
        <>
            <BookForm book={book} onChange={setBook} error={errorMessage(error)} />
            <IonButton expand="block" onClick={save} disabled={saving}>
                Create
            </IonButton>
        </>
    );
};

export default CreateBook;
