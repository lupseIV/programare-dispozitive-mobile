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
	if err := s.seed(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS books (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
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
);`)
	return err
}

// seed inserts some sample books the first time the database is created.
func (s *Store) seed() error {
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM books`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
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
	}
	for i := range samples {
		if _, err := s.Create(&samples[i]); err != nil {
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
	Query  string // matches title or author
	Genre  string
	Read   *bool
	Limit  int
	Offset int
}

func (s *Store) List(p ListParams) ([]Book, int, error) {
	where := []string{"1=1"}
	args := []any{}
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

func (s *Store) Get(id int64) (Book, error) {
	b, err := scanBook(s.db.QueryRow(`SELECT `+bookCols+` FROM books WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return b, ErrNotFound
	}
	return b, err
}

func (s *Store) Create(b *Book) (Book, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	res, err := s.db.Exec(
		`INSERT INTO books (title, author, genre, year, pages, read, rating, notes, created_at, updated_at, version)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
		b.Title, b.Author, b.Genre, b.Year, b.Pages, boolToInt(b.Read), b.Rating, b.Notes, now, now)
	if err != nil {
		return Book{}, err
	}
	id, _ := res.LastInsertId()
	return s.Get(id)
}

// Update replaces a book. If b.Version > 0 it must match the stored version
// (optimistic concurrency); otherwise the update is unconditional.
func (s *Store) Update(id int64, b *Book) (Book, error) {
	current, err := s.Get(id)
	if err != nil {
		return Book{}, err
	}
	if b.Version > 0 && b.Version != current.Version {
		return current, ErrConflict
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = s.db.Exec(
		`UPDATE books SET title=?, author=?, genre=?, year=?, pages=?, read=?, rating=?, notes=?, updated_at=?, version=version+1
		 WHERE id=?`,
		b.Title, b.Author, b.Genre, b.Year, b.Pages, boolToInt(b.Read), b.Rating, b.Notes, now, id)
	if err != nil {
		return Book{}, err
	}
	return s.Get(id)
}

func (s *Store) Delete(id int64) (Book, error) {
	b, err := s.Get(id)
	if err != nil {
		return b, err
	}
	_, err = s.db.Exec(`DELETE FROM books WHERE id = ?`, id)
	return b, err
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
