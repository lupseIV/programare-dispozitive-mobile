package main

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	ErrUserExists   = errors.New("username already taken")
	ErrBadLogin     = errors.New("invalid username or password")
	ErrUnauthorized = errors.New("unauthorized")
)

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

func (s *Store) migrateAuth() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS users (
	id       INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
	token      TEXT PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users(id),
	created_at TEXT NOT NULL
);`)
	return err
}

func hashPassword(password string, salt []byte) (string, error) {
	key, err := pbkdf2.Key(sha256.New, password, salt, 100_000, 32)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(salt) + "$" + hex.EncodeToString(key), nil
}

func checkPassword(stored, password string) bool {
	saltHex, _, ok := strings.Cut(stored, "$")
	if !ok {
		return false
	}
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return false
	}
	h, err := hashPassword(password, salt)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(h), []byte(stored)) == 1
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Store) CreateUser(username, password string) (User, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return User{}, err
	}
	hash, err := hashPassword(password, salt)
	if err != nil {
		return User{}, err
	}
	res, err := s.db.Exec(`INSERT INTO users (username, password) VALUES (?, ?)`, username, hash)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return User{}, ErrUserExists
		}
		return User{}, err
	}
	id, _ := res.LastInsertId()
	return User{ID: id, Username: username}, nil
}

func (s *Store) Authenticate(username, password string) (User, error) {
	var u User
	var stored string
	err := s.db.QueryRow(`SELECT id, username, password FROM users WHERE username = ?`, username).
		Scan(&u.ID, &u.Username, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrBadLogin
	} else if err != nil {
		return User{}, err
	}
	if !checkPassword(stored, password) {
		return User{}, ErrBadLogin
	}
	return u, nil
}

func (s *Store) CreateSession(userID int64) (string, error) {
	token, err := randomHex(32)
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
		token, userID, time.Now().UTC().Format(time.RFC3339Nano))
	return token, err
}

func (s *Store) UserByToken(token string) (User, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token).
		Scan(&u.ID, &u.Username)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	return u, err
}

func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
	return err
}

func (s *Store) UserIDs() ([]int64, error) {
	rows, err := s.db.Query(`SELECT id FROM users`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ---------- HTTP ----------

type ctxKey struct{}

func userFrom(r *http.Request) User {
	u, _ := r.Context().Value(ctxKey{}).(User)
	return u
}

func bearerToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return ""
}

// requireAuth rejects requests without a valid bearer token and puts the user in the context.
func (a *API) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "missing token")
			return
		}
		u, err := a.store.UserByToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	}
}

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

func readCredentials(w http.ResponseWriter, r *http.Request) (credentials, bool) {
	var c credentials
	if err := decodeJSON(w, r, &c); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return c, false
	}
	c.Username = strings.TrimSpace(c.Username)
	return c, true
}

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	c, ok := readCredentials(w, r)
	if !ok {
		return
	}
	u, err := a.store.Authenticate(c.Username, c.Password)
	if errors.Is(err, ErrBadLogin) {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	} else if err != nil {
		serverError(w, err)
		return
	}
	a.issueToken(w, u, http.StatusOK)
}

func (a *API) issueToken(w http.ResponseWriter, u User, status int) {
	token, err := a.store.CreateSession(u.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, status, authResponse{Token: token, User: u})
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	if err := a.store.DeleteSession(bearerToken(r)); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, userFrom(r))
}

// SeedUsers reads a JSON file like [{"username":"alice","password":"..."}] and creates
// the users that do not exist yet (each new user also gets a few sample books).
func (s *Store) SeedUsers(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var users []credentials
	if err := json.Unmarshal(data, &users); err != nil {
		return err
	}
	for _, c := range users {
		u, err := s.CreateUser(strings.TrimSpace(c.Username), c.Password)
		if errors.Is(err, ErrUserExists) {
			continue
		} else if err != nil {
			return err
		}
		if err := s.SeedUser(u.ID); err != nil {
			return err
		}
		log.Printf("seeded user %q", u.Username)
	}
	return nil
}
