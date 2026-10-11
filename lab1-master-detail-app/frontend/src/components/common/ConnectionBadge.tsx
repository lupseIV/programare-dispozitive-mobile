import React from 'react';
import { IonBadge } from '@ionic/react';
import './ConnectionBadge.css';

interface Props {
    connected: boolean;
}

const ConnectionBadge: React.FC<Props> = ({ connected }) => (
    <IonBadge className="connection-badge" color={connected ? 'success' : 'medium'}>
        {connected ? 'live' : 'offline'}
    </IonBadge>
);

export default ConnectionBadge;