import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import BooksPage from '../pages/BooksPage';
import BookDetailsPage from '../pages/BookDetailsPage';

const AppRoutes: React.FC = () => (
    <IonReactRouter>
        <IonRouterOutlet>
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:id" element={<BookDetailsPage />} />
            <Route path="/" element={<Navigate to="/books" replace />} />
        </IonRouterOutlet>
    </IonReactRouter>
);

export default AppRoutes;