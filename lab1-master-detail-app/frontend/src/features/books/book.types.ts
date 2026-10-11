export interface Book {
    id?: number;
    title: string;
    author: string;
    genre: string;
    year: number;
    pages: number;
    read: boolean;
    rating: number; // 0..5
    notes: string;
    createdAt?: string;
    updatedAt?: string;
    version?: number;
}

export interface BookEvent {
    type: 'created' | 'updated' | 'deleted';
    payload: Book;
}

export const emptyBook = (): Book => ({
    title: '',
    author: '',
    genre: '',
    year: new Date().getFullYear(),
    pages: 0,
    read: false,
    rating: 0,
    notes: '',
});