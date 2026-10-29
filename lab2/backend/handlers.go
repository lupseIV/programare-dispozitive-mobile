package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	store *Store
	hub   *Hub
}

func (a *API) listBooks(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	page := atoiDefault(qs.Get("page"), 1)
	size := atoiDefault(qs.Get("size"), 50)
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 200 {
		size = 50
	}
	p := ListParams{
		UserID: userFrom(r).ID,
		Query:  strings.TrimSpace(qs.Get("q")),
		Genre:  qs.Get("genre"),
		Limit:  size,
		Offset: (page - 1) * size,
	}
	if v := qs.Get("read"); v != "" {
		b := v == "true" || v == "1"
		p.Read = &b
	}
	books, total, err := a.store.List(p)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": books,
		"total": total,
		"page":  page,
		"size":  size,
	})
}

func (a *API) getBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	b, err := a.store.Get(userFrom(r).ID, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "book not found")
		return
	} else if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *API) createBook(w http.ResponseWriter, r *http.Request) {
	var in Book
	if !decodeAndValidate(w, r, &in) {
		return
	}
	b, err := a.store.Create(userFrom(r).ID, &in)
	if err != nil {
		serverError(w, err)
		return
	}
	a.hub.Notify(userFrom(r).ID, "created", b)
	writeJSON(w, http.StatusCreated, b)
}

func (a *API) updateBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in Book
	if !decodeAndValidate(w, r, &in) {
		return
	}
	b, err := a.store.Update(userFrom(r).ID, id, &in)
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "book not found")
		return
	case errors.Is(err, ErrConflict):
		// return the current server version so the client can resolve the conflict
		writeJSON(w, http.StatusConflict, map[string]any{"error": "version conflict", "current": b})
		return
	case err != nil:
		serverError(w, err)
		return
	}
	a.hub.Notify(userFrom(r).ID, "updated", b)
	writeJSON(w, http.StatusOK, b)
}

func (a *API) deleteBook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	b, err := a.store.Delete(userFrom(r).ID, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "book not found")
		return
	} else if err != nil {
		serverError(w, err)
		return
	}
	a.hub.Notify(userFrom(r).ID, "deleted", b)
	w.WriteHeader(http.StatusNoContent)
}

// ---------- helpers ----------

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) error {
	return json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v)
}

func decodeAndValidate(w http.ResponseWriter, r *http.Request, b *Book) bool {
	if err := decodeJSON(w, r, b); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return false
	}
	b.Title = strings.TrimSpace(b.Title)
	b.Author = strings.TrimSpace(b.Author)
	errs := map[string]string{}
	if b.Title == "" {
		errs["title"] = "title is required"
	}
	if b.Author == "" {
		errs["author"] = "author is required"
	}
	if b.Year < 0 || b.Year > time.Now().Year()+1 {
		errs["year"] = "year is out of range"
	}
	if b.Pages < 0 {
		errs["pages"] = "pages must be >= 0"
	}
	if b.Rating < 0 || b.Rating > 5 {
		errs["rating"] = "rating must be between 0 and 5"
	}
	if len(errs) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "validation failed", "fields": errs})
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}

func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(v)
	if err != nil {
		return
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal server error")
}

// ---------- middleware ----------

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws" { // websocket needs the raw writer (Hijacker)
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s -> %d (%s)", r.Method, r.URL.RequestURI(), rec.status, time.Since(start).Round(time.Microsecond))
	})
}

func (a *API) listGenres(w http.ResponseWriter, r *http.Request) {
	genres, err := a.store.Genres(userFrom(r).ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, genres)
}
