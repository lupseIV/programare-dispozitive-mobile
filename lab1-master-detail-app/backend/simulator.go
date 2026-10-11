package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"
)

// runSimulator changes data on the server every few seconds so you can watch
// the websocket notifications arrive in the app without touching it.
// Start the server with:  go run . -simulate
func runSimulator(store *Store, hub *Hub) {
	titles := []string{"The Silent Compiler", "Goroutines at Dawn", "A Tale of Two Threads", "The Last Mutex", "Null Pointer Blues"}
	authors := []string{"Ada Lovelace", "Alan Turing", "Grace Hopper", "Linus Torvalds"}
	genres := []string{"Sci-Fi", "Fantasy", "Programming", "Classic"}
	n := 0
	for range time.Tick(10 * time.Second) {
		n++
		if n%2 == 1 {
			b, err := store.Create(&Book{
				Title:  fmt.Sprintf("%s #%d", titles[rand.Intn(len(titles))], n),
				Author: authors[rand.Intn(len(authors))],
				Genre:  genres[rand.Intn(len(genres))],
				Year:   1950 + rand.Intn(75),
				Pages:  100 + rand.Intn(600),
			})
			if err == nil {
				log.Printf("simulator: created book %d", b.ID)
				hub.Notify("created", b)
			}
			continue
		}
		// toggle "read" on a random existing book
		books, _, err := store.List(ListParams{Limit: 200})
		if err != nil || len(books) == 0 {
			continue
		}
		b := books[rand.Intn(len(books))]
		b.Read = !b.Read
		b.Version = 0 // unconditional update
		if u, err := store.Update(b.ID, &b); err == nil {
			log.Printf("simulator: updated book %d (read=%v)", u.ID, u.Read)
			hub.Notify("updated", u)
		}
	}
}
