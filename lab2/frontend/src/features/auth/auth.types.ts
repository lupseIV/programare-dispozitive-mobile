export interface User {
    id: number;
    username: string;
}

export interface Credentials {
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}
