import React, { useState } from 'react';
import {
    IonButton, IonContent, IonInput, IonItem, IonList, IonPage, IonSpinner, IonText,
} from '@ionic/react';
import PageHeader from '../components/layout/PageHeader';
import ConnectionBadge from '../components/common/ConnectionBadge';
import { authenticate } from '../features/auth';
import { useAppDispatch } from '../store/hooks';
import { errorMessage } from '../utils/errorMessage';
import './LoginPage.css';

const LoginPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            await dispatch(authenticate({ username, password })).unwrap();
            // AppRoutes redirects to /books as soon as the token is in the store
        } catch (err) {
            setError(err);
            setBusy(false);
        }
    };

    return (
        <IonPage>
            <PageHeader title="My Books" end={<ConnectionBadge />} />
            <IonContent>
                <form className="login-page" onSubmit={submit}>
                    {error ? <IonText color="danger"><p>{errorMessage(error)}</p></IonText> : null}

                    <IonList inset>
                        <IonItem>
                            <IonInput label="Username" labelPlacement="stacked" autocomplete="username"
                                      value={username} onIonInput={e => setUsername(e.detail.value ?? '')} />
                        </IonItem>
                        <IonItem>
                            <IonInput label="Password" labelPlacement="stacked" type="password"
                                      autocomplete="current-password"
                                      value={password} onIonInput={e => setPassword(e.detail.value ?? '')} />
                        </IonItem>
                    </IonList>

                    <IonButton expand="block" type="submit" disabled={busy || !username || !password}>
                        {busy ? <IonSpinner name="dots" /> : 'Log in'}
                    </IonButton>
                </form>
            </IonContent>
        </IonPage>
    );
};

export default LoginPage;
