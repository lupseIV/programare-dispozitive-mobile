const API_HOST = import.meta.env.VITE_API_HOST ?? 'localhost:3000';

export const API_URL = `http://${API_HOST}/api`;
export const WS_URL = `ws://${API_HOST}/ws`;
