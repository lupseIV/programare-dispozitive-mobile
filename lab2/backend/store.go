package main

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

type Book struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	Genre     string    `json:"genre"`
	Year      int       `json:"year"`
	Pages     int       `json:"pages"`
	Read      bool      `json:"read"`
	Rating    int       `json:"rating"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Version   int       `json:"version"`
}

var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("version conflict")
)

type Store struct{ db *sql.DB }

func NewStore(path string) (*Store, error) {
	db, err := sql.Open(sqlDriver, path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	if err := s.migrateAuth(); err != nil {
		return err
	}
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS books (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id    INTEGER NOT NULL REFERENCES users(id),
	title      TEXT    NOT NULL,
	author     TEXT    NOT NULL,
	genre      TEXT    NOT NULL DEFAULT '',
	year       INTEGER NOT NULL DEFAULT 0,
	pages      INTEGER NOT NULL DEFAULT 0,
	read       INTEGER NOT NULL DEFAULT 0,
	rating     INTEGER NOT NULL DEFAULT 0,
	notes      TEXT    NOT NULL DEFAULT '',
	created_at TEXT    NOT NULL,
	updated_at TEXT    NOT NULL,
	version    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id, id DESC);`)
	return err
}

// SeedUser inserts some sample books for a freshly registered user.
func (s *Store) SeedUser(userID int64) error {
	samples := []Book{
		{Title: "Dune", Author: "Frank Herbert", Genre: "Sci-Fi", Year: 1965, Pages: 412, Read: true, Rating: 5, Notes: "Spice must flow."},
		{Title: "1984", Author: "George Orwell", Genre: "Dystopia", Year: 1949, Pages: 328, Read: true, Rating: 4},
		{Title: "The Hobbit", Author: "J.R.R. Tolkien", Genre: "Fantasy", Year: 1937, Pages: 310, Read: true, Rating: 5},
		{Title: "Clean Code", Author: "Robert C. Martin", Genre: "Programming", Year: 2008, Pages: 464, Read: false},
		{Title: "The Pragmatic Programmer", Author: "Andrew Hunt, David Thomas", Genre: "Programming", Year: 1999, Pages: 352, Read: true, Rating: 4},
		{Title: "Ion", Author: "Liviu Rebreanu", Genre: "Classic", Year: 1920, Pages: 480, Read: false},
		{Title: "Enigma Otiliei", Author: "George Calinescu", Genre: "Classic", Year: 1938, Pages: 420, Read: true, Rating: 3},
		{Title: "Designing Data-Intensive Applications", Author: "Martin Kleppmann", Genre: "Programming", Year: 2017, Pages: 616, Read: false, Notes: "Read the chapter on replication."},
		{Title: "Project Hail Mary", Author: "Andy Weir", Genre: "Sci-Fi", Year: 2021, Pages: 496, Read: false},
		{Title: "The Name of the Wind", Author: "Patrick Rothfuss", Genre: "Fantasy", Year: 2007, Pages: 662, Read: true, Rating: 4},
		{Title: "Neuromancer", Author: "William Gibson", Genre: "Sci-Fi", Year: 1984, Pages: 271, Read: true, Rating: 4},
		{Title: "Foundation", Author: "Isaac Asimov", Genre: "Sci-Fi", Year: 1951, Pages: 255, Read: true, Rating: 5},
		{Title: "The Left Hand of Darkness", Author: "Ursula K. Le Guin", Genre: "Sci-Fi", Year: 1969, Pages: 304, Read: false},
		{Title: "Snow Crash", Author: "Neal Stephenson", Genre: "Sci-Fi", Year: 1992, Pages: 480, Read: true, Rating: 4},
		{Title: "The Martian", Author: "Andy Weir", Genre: "Sci-Fi", Year: 2011, Pages: 369, Read: true, Rating: 5},
		{Title: "Ender's Game", Author: "Orson Scott Card", Genre: "Sci-Fi", Year: 1985, Pages: 324, Read: true, Rating: 4},
		{Title: "Hyperion", Author: "Dan Simmons", Genre: "Sci-Fi", Year: 1989, Pages: 482, Read: false},
		{Title: "The Fellowship of the Ring", Author: "J.R.R. Tolkien", Genre: "Fantasy", Year: 1954, Pages: 423, Read: true, Rating: 5},
		{Title: "A Game of Thrones", Author: "George R.R. Martin", Genre: "Fantasy", Year: 1996, Pages: 694, Read: true, Rating: 4},
		{Title: "The Wise Man's Fear", Author: "Patrick Rothfuss", Genre: "Fantasy", Year: 2011, Pages: 994, Read: false},
		{Title: "A Wizard of Earthsea", Author: "Ursula K. Le Guin", Genre: "Fantasy", Year: 1968, Pages: 183, Read: true, Rating: 4},
		{Title: "Mistborn: The Final Empire", Author: "Brandon Sanderson", Genre: "Fantasy", Year: 2006, Pages: 541, Read: true, Rating: 5},
		{Title: "The Way of Kings", Author: "Brandon Sanderson", Genre: "Fantasy", Year: 2010, Pages: 1007, Read: false},
		{Title: "Brave New World", Author: "Aldous Huxley", Genre: "Dystopia", Year: 1932, Pages: 311, Read: true, Rating: 4},
		{Title: "Fahrenheit 451", Author: "Ray Bradbury", Genre: "Dystopia", Year: 1953, Pages: 194, Read: true, Rating: 4},
		{Title: "The Handmaid's Tale", Author: "Margaret Atwood", Genre: "Dystopia", Year: 1985, Pages: 311, Read: false},
		{Title: "We", Author: "Yevgeny Zamyatin", Genre: "Dystopia", Year: 1924, Pages: 226, Read: false},
		{Title: "Refactoring", Author: "Martin Fowler", Genre: "Programming", Year: 1999, Pages: 431, Read: false},
		{Title: "Structure and Interpretation of Computer Programs", Author: "Harold Abelson, Gerald Jay Sussman", Genre: "Programming", Year: 1985, Pages: 657, Read: false},
		{Title: "The Go Programming Language", Author: "Alan Donovan, Brian Kernighan", Genre: "Programming", Year: 2015, Pages: 380, Read: true, Rating: 4},
		{Title: "Code Complete", Author: "Steve McConnell", Genre: "Programming", Year: 1993, Pages: 914, Read: false},
		{Title: "Introduction to Algorithms", Author: "Thomas H. Cormen et al.", Genre: "Programming", Year: 1990, Pages: 1312, Read: false},
		{Title: "Eloquent JavaScript", Author: "Marijn Haverbeke", Genre: "Programming", Year: 2011, Pages: 472, Read: true, Rating: 3},
		{Title: "Design Patterns", Author: "Erich Gamma et al.", Genre: "Programming", Year: 1994, Pages: 395, Read: true, Rating: 3},
		{Title: "Crime and Punishment", Author: "Fyodor Dostoevsky", Genre: "Classic", Year: 1866, Pages: 545, Read: true, Rating: 5},
		{Title: "Pride and Prejudice", Author: "Jane Austen", Genre: "Classic", Year: 1813, Pages: 432, Read: true, Rating: 4},
		{Title: "Moara cu noroc", Author: "Ioan Slavici", Genre: "Classic", Year: 1881, Pages: 96, Read: true, Rating: 3},
		{Title: "Baltagul", Author: "Mihail Sadoveanu", Genre: "Classic", Year: 1930, Pages: 224, Read: false},
		{Title: "Maitreyi", Author: "Mircea Eliade", Genre: "Classic", Year: 1933, Pages: 256, Read: true, Rating: 4},
		{Title: "Don Quixote", Author: "Miguel de Cervantes", Genre: "Classic", Year: 1605, Pages: 992, Read: false},
		{Title: "Moby-Dick", Author: "Herman Melville", Genre: "Classic", Year: 1851, Pages: 635, Read: false},
		{Title: "The Great Gatsby", Author: "F. Scott Fitzgerald", Genre: "Classic", Year: 1925, Pages: 180, Read: true, Rating: 4},
		{Title: "Murder on the Orient Express", Author: "Agatha Christie", Genre: "Mystery", Year: 1934, Pages: 256, Read: true, Rating: 4},
		{Title: "The Hound of the Baskervilles", Author: "Arthur Conan Doyle", Genre: "Mystery", Year: 1902, Pages: 256, Read: true, Rating: 4},
		{Title: "The Girl with the Dragon Tattoo", Author: "Stieg Larsson", Genre: "Mystery", Year: 2005, Pages: 465, Read: false},
		{Title: "Gone Girl", Author: "Gillian Flynn", Genre: "Mystery", Year: 2012, Pages: 422, Read: true, Rating: 3},
		{Title: "Sapiens", Author: "Yuval Noah Harari", Genre: "History", Year: 2011, Pages: 443, Read: true, Rating: 4},
		{Title: "Guns, Germs, and Steel", Author: "Jared Diamond", Genre: "History", Year: 1997, Pages: 480, Read: false},
		{Title: "The Silk Roads", Author: "Peter Frankopan", Genre: "History", Year: 2015, Pages: 636, Read: false},
		{Title: "Thinking, Fast and Slow", Author: "Daniel Kahneman", Genre: "Science", Year: 2011, Pages: 499, Read: true, Rating: 4},
		{Title: "A Brief History of Time", Author: "Stephen Hawking", Genre: "Science", Year: 1988, Pages: 212, Read: true, Rating: 4},
		{Title: "Cosmos", Author: "Carl Sagan", Genre: "Science", Year: 1980, Pages: 396, Read: false},
		{Title: "The Selfish Gene", Author: "Richard Dawkins", Genre: "Science", Year: 1976, Pages: 360, Read: false},
		{Title: "Atomic Habits", Author: "James Clear", Genre: "Self-Help", Year: 2018, Pages: 320, Read: true, Rating: 3},
		{Title: "Meditations", Author: "Marcus Aurelius", Genre: "Philosophy", Year: 180, Pages: 254, Read: true, Rating: 5},
	}
	for i := range samples {
		if _, err := s.Create(userID, &samples[i]); err != nil {
			return err
		}
	}
	return nil
}

const bookCols = `id, title, author, genre, year, pages, read, rating, notes, created_at, updated_at, version`

type scanner interface{ Scan(dest ...any) error }

func scanBook(r scanner) (Book, error) {
	var b Book
	var read int
	var created, updated string
	err := r.Scan(&b.ID, &b.Title, &b.Author, &b.Genre, &b.Year, &b.Pages, &read, &b.Rating, &b.Notes, &created, &updated, &b.Version)
	if err != nil {
		return b, err
	}
	b.Read = read == 1
	b.CreatedAt, _ = time.Parse(time.RFC3339Nano, created)
	b.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updated)
	return b, nil
}

type ListParams struct {
	UserID int64
	Query  string // matches title or author
	Genre  string
	Read   *bool
	Limit  int
	Offset int
}

func (s *Store) List(p ListParams) ([]Book, int, error) {
	where := []string{"user_id = ?"}
	args := []any{p.UserID}
	if p.Query != "" {
		where = append(where, "(title LIKE ? OR author LIKE ?)")
		like := "%" + p.Query + "%"
		args = append(args, like, like)
	}
	if p.Genre != "" {
		where = append(where, "genre = ?")
		args = append(args, p.Genre)
	}
	if p.Read != nil {
		where = append(where, "read = ?")
		args = append(args, boolToInt(*p.Read))
	}
	cond := strings.Join(where, " AND ")

	var total int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM books WHERE `+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q := `SELECT ` + bookCols + ` FROM books WHERE ` + cond + ` ORDER BY id DESC LIMIT ? OFFSET ?`
	rows, err := s.db.Query(q, append(args, p.Limit, p.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer func(rows *sql.Rows) {
		err := rows.Close()
		if err != nil {
		}
	}(rows)

	books := []Book{}
	for rows.Next() {
		b, err := scanBook(rows)
		if err != nil {
			return nil, 0, err
		}
		books = append(books, b)
	}
	return books, total, rows.Err()
}

func (s *Store) Get(userID, id int64) (Book, error) {
	b, err := scanBook(s.db.QueryRow(`SELECT `+bookCols+` FROM books WHERE id = ? AND user_id = ?`, id, userID))
	if errors.Is(err, sql.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) Create(userID int64, b *Book) (Book, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.db.Exec(
		`INSERT INTO books (user_id, title, author, genre, year, pages, read, rating, notes, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
		userID, b.Title, b.Author, b.Genre, b.Year, b.Pages, boolToInt(b.Read), b.Rating, b.Notes, now, now)
	if err != nil {
		return Book{}, err
	}
	id, _ := res.LastInsertId()
	return s.Get(userID, id)
}

// Update replaces a book. If b.Version > 0 it must match the stored version
// (optimistic concurrency); otherwise the update is unconditional.
func (s *Store) Update(userID, id int64, b *Book) (Book, error) {
	current, err := s.Get(userID, id)
	if err != nil {
		return Book{}, err
	}
	if b.Version > 0 && b.Version != current.Version {
		return current, ErrConflict
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = s.db.Exec(
		`UPDATE books SET title=?, author=?, genre=?, year=?, pages=?, read=?, rating=?, notes=?, updated_at=?, version=version+1
		 WHERE id=? AND user_id=?`,
		b.Title, b.Author, b.Genre, b.Year, b.Pages, boolToInt(b.Read), b.Rating, b.Notes, now, id, userID)
	if err != nil {
		return Book{}, err
	}
	return s.Get(userID, id)
}

func (s *Store) Delete(userID, id int64) (Book, error) {
	b, err := s.Get(userID, id)
	if err != nil {
		return b, err
	}
	_, err = s.db.Exec(`DELETE FROM books WHERE id = ? AND user_id = ?`, id, userID)
	return b, err
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

// Genres returns the distinct non-empty genres of the user's books (for the filter dropdown).
func (s *Store) Genres(userID int64) ([]string, error) {
	rows, err := s.db.Query(`SELECT DISTINCT genre FROM books WHERE user_id = ? AND genre <> '' ORDER BY genre`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	genres := []string{}
	for rows.Next() {
		var g string
		if err := rows.Scan(&g); err != nil {
			return nil, err
		}
		genres = append(genres, g)
	}
	return genres, rows.Err()
}
