# My Books – Lab 2 (built on the Lab 1 master–detail app)

A mobile app (Ionic + React + Redux Toolkit) for keeping track of the books you own and read, backed by a Go REST server with SQLite and live updates over WebSockets.

## Lab 2 additions

| Requirement | Where |
|---|---|
| Network status (online / offline / server unreachable) | `ConnectionBadge` (device `online`/`offline` events + websocket state) |
| Authentication, token in `localStorage`, no login page when already authenticated, logout | `backend/auth.go`, `features/auth`, `routes/AppRoutes.tsx`, logout button on the list |
| Books linked to the user; REST + websocket only expose the owner's books | `books.user_id`, every query filtered by user; hub delivers events per user (`/ws?token=`) |
| Online/offline behaviour | `features/books/booksSlice.ts`: REST first, failed/offline writes go to a persisted queue, list items show a cloud-offline icon, banner "N changes not sent" |
| Automatic sync when back online | `components/common/LiveSync.tsx` flushes the queue on the `online` event and whenever the websocket (re)connects |
| Pagination | `?page=&size=` + infinite scroll (20 per page) |
| Search & filter | title/author search, read/unread segment, genre select (all server-side; filtered locally when offline) |

Conflict policy when syncing: a queued edit that hits a version conflict (409) overwrites the server copy (last write wins); changes rejected with a 4xx (e.g. validation) are dropped and reported.

### Run
```
cd backend  && go run . [-simulate]     # http://localhost:3000
cd frontend && npm install && npm run dev
```
Log in with a user from `backend/users.json` (alice/alice123, bob/bob123, carol/carol123); the backend creates missing users, with sample books, on start. There is no sign-up. To test offline mode, use DevTools -> Network -> Offline, or stop the server.

## Features

### Entity: Book
| Field | Type | Notes |
|---|---|---|
| `id` | number | assigned by the server |
| `title` | string | required |
| `author` | string | required |
| `genre` | string | e.g. Sci-Fi, Fantasy, Programming |
| `year` | number | year of publication |
| `pages` | number | ≥ 0 |
| `read` | boolean | whether I've finished it |
| `rating` | number | 0–5 (0 = not rated) |
| `notes` | string | free text |
| `createdAt`, `updatedAt` | date | set by the server |
| `version` | number | incremented on each update (used for conflict detection) |

### Master view – book list
- Shows all books fetched from the server (title, author, year, genre, read/unread icon).
- Search by title or author.
- Pull down to refresh from the server.
- "+" button to add a new book.
- Badge showing whether the live connection (WebSocket) is up.
- Tapping a book opens its detail view.

### Detail view – view / edit a book
- Shows all fields of the selected book in an editable form.
- Save changes (PUT) or create a new book (POST).
- Delete the book, with a confirmation dialog.
- Server-side validation errors (e.g. missing title) are shown on the form.
- If the book is deleted on the server while open, the user is told and saving is disabled.

### REST service
- Data is fetched from and saved to the Go backend over HTTP/JSON, using RTK Query (Redux Toolkit), which also caches results and refetches after changes.

### Server-side notifications (WebSockets)
- The app keeps a WebSocket open to the server.
- Whenever a book is created, updated or deleted (by any client or by the server), every connected app receives the change and updates its list immediately, and a toast shows what happened.
- The socket reconnects automatically if the server restarts.

## Project structure

```
lab1-master-detail-app/
├── backend/    Go REST + WebSocket server, SQLite storage
└── frontend/   Ionic React app (Redux Toolkit + RTK Query)
```

## Running

### Backend (needs Go 1.23+)
```bash
cd backend
go mod tidy          # first time only – downloads dependencies
go run .             # http://localhost:3000
go run . -simulate   # also creates/updates a book every 10 s, to demo notifications
```
The database file `books.db` is created on first run and filled with 10 sample books. Delete it to reset.

### Frontend
```bash
cd frontend
npm install
ionic serve          # or: npm run dev
```

## API

| Method | URL | Description |
|---|---|---|
| GET | `/api/books?q=&genre=&read=&page=&size=` | list (paginated, filterable). Returns `{items, total, page, size}` |
| GET | `/api/books/{id}` | one book |
| POST | `/api/books` | create → 201 |
| PUT | `/api/books/{id}` | update; if `version` is sent and is stale → 409 with the current book |
| DELETE | `/api/books/{id}` | delete → 204 |
| WS | `/ws` | server pushes `{"type": "created" \| "updated" \| "deleted", "payload": Book}` |
