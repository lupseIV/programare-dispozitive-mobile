package main

import (
	"flag"
	"log"
	"net/http"
	"os"
)

func main() {
	addr := flag.String("addr", ":3000", "HTTP listen address")
	dbPath := flag.String("db", "books.db", "SQLite database file")
	usersFile := flag.String("users", "users.json", "JSON file with the users to create on start")
	simulate := flag.Bool("simulate", false, "periodically change data on the server to demo websocket notifications")
	flag.Parse()

	if v := os.Getenv("PORT"); v != "" {
		*addr = ":" + v
	}

	store, err := NewStore(*dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer func(store *Store) {
		err := store.Close()
		if err != nil {
			log.Printf("close db: %v", err)
		}
	}(store)

	if err := store.SeedUsers(*usersFile); err != nil {
		log.Fatalf("seed users from %s: %v", *usersFile, err)
	}

	hub := NewHub()
	go hub.Run()

	api := &API{store: store, hub: hub}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/login", api.login)
	mux.HandleFunc("POST /api/auth/logout", api.requireAuth(api.logout))
	mux.HandleFunc("GET /api/auth/me", api.requireAuth(api.me))
	mux.HandleFunc("GET /api/genres", api.requireAuth(api.listGenres))
	mux.HandleFunc("GET /api/books", api.requireAuth(api.listBooks))
	mux.HandleFunc("GET /api/books/{id}", api.requireAuth(api.getBook))
	mux.HandleFunc("POST /api/books", api.requireAuth(api.createBook))
	mux.HandleFunc("PUT /api/books/{id}", api.requireAuth(api.updateBook))
	mux.HandleFunc("DELETE /api/books/{id}", api.requireAuth(api.deleteBook))
	mux.HandleFunc("GET /ws", api.serveWS)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	if *simulate {
		go runSimulator(store, hub)
	}

	log.Printf("Books API listening on %s  (REST: /api/books, WebSocket: /ws)", *addr)
	log.Fatal(http.ListenAndServe(*addr, logging(cors(mux))))
}
