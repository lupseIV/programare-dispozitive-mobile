import React from 'react';
import { IonBadge } from '@ionic/react';
import { useAppSelector } from '../../store/hooks';
import './ConnectionBadge.css';

/** whether the device has internet access */
const ConnectionBadge: React.FC = () => {
    const online = useAppSelector(s => s.live.online);

    return (
        <IonBadge className="connection-badge" color={online ? 'success' : 'danger'}>
            {online ? 'online' : 'offline'}
        </IonBadge>
    );
};

export default ConnectionBadge;
