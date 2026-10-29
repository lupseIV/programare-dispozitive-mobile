import { useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { onlineChanged } from '../../store/slices/liveSlice';
import { hasInternet } from '../../utils/connectivity';

/** Keeps `live.online` equal to "the device really has internet access". */
const NetworkStatus: React.FC = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        let stopped = false;
        const check = async () => {
            const online = await hasInternet();
            if (!stopped) dispatch(onlineChanged(online));
        };
        const onChange = () => void check();
        window.addEventListener('online', onChange);
        window.addEventListener('offline', onChange);
        void check();
        const timer = setInterval(check, 5000);
        return () => {
            stopped = true;
            clearInterval(timer);
            window.removeEventListener('online', onChange);
            window.removeEventListener('offline', onChange);
        };
    }, [dispatch]);

    return null;
};

export default NetworkStatus;
