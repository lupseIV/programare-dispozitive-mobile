import React from 'react';
import {IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar} from '@ionic/react';

interface Props {
    title: string;
    backHref?: string;
    end?: React.ReactNode;
    children?: React.ReactNode;
}

const PageHeader = ({title, backHref, end, children}: Props) => (
    <IonHeader>
        <IonToolbar>
            {backHref && (
                <IonButtons slot="start">
                    <IonBackButton defaultHref={backHref}/>
                </IonButtons>
            )}
            <IonTitle>{title}</IonTitle>
            {end && <IonButtons slot="end">{end}</IonButtons>}
        </IonToolbar>
        {children}
    </IonHeader>
);

export default PageHeader;