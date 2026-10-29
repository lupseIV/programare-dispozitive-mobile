import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import BooksPage from '../pages/BooksPage';
import BookDetailsPage from '../pages/BookDetailsPage';
import LoginPage from '../pages/LoginPage';
import LiveSync from '../components/common/LiveSync';
import NetworkStatus from '../components/common/NetworkStatus';
import { useAppSelector } from '../store/hooks';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const token = useAppSelector(s => s.auth.token);
    return token ? children : <Navigate to="/login" replace />;
};

const LoginRoute: React.FC = () => {
    const token = useAppSelector(s => s.auth.token);
    return token ? <Navigate to="/books" replace /> : <LoginPage />;
};

const AppRoutes: React.FC = () => {
    const token = useAppSelector(s => s.auth.token);
    return (
        <IonReactRouter>
            <NetworkStatus />
            {token && <LiveSync />}
            <IonRouterOutlet>
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/books" element={<RequireAuth><BooksPage /></RequireAuth>} />
                <Route path="/books/:id" element={<RequireAuth><BookDetailsPage /></RequireAuth>} />
                <Route path="/" element={<Navigate to="/books" replace />} />
            </IonRouterOutlet>
        </IonReactRouter>
    );
};

export default AppRoutes;
