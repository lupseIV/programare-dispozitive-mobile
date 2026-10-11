package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// Event is what clients receive over the websocket, e.g.
// {"type":"created","payload":{...book...}}
type Event struct {
	Type    string `json:"type"` // created | updated | deleted
	Payload Book   `json:"payload"`
}

type Hub struct {
	clients    map[*client]bool
	register   chan *client
	unregister chan *client
	broadcast  chan []byte
}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // dev: allow any origin
}

func NewHub() *Hub {
	return &Hub{
		clients:    map[*client]bool{},
		register:   make(chan *client),
		unregister: make(chan *client),
		broadcast:  make(chan []byte, 64),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = true
			log.Printf("ws: client connected (%d total)", len(h.clients))
		case c := <-h.unregister:
			if h.clients[c] {
				delete(h.clients, c)
				close(c.send)
				log.Printf("ws: client disconnected (%d total)", len(h.clients))
			}
		case msg := <-h.broadcast:
			for c := range h.clients {
				select {
				case c.send <- msg:
				default: // slow client: drop it
					delete(h.clients, c)
					close(c.send)
				}
			}
		}
	}
}

func (h *Hub) Notify(eventType string, b Book) {
	data, _ := json.Marshal(Event{Type: eventType, Payload: b})
	h.broadcast <- data
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	c := &client{conn: conn, send: make(chan []byte, 16)}
	h.register <- c
	go c.writeLoop()
	go c.readLoop(h)
}

const (
	pongWait   = 60 * time.Second
	pingPeriod = 50 * time.Second
)

// readLoop only exists to detect disconnects and handle pongs.
func (c *client) readLoop(h *Hub) {
	defer func() {
		h.unregister <- c
		err := c.conn.Close()
		if err != nil {
			return
		}
	}()
	err := c.conn.SetReadDeadline(time.Now().Add(pongWait))
	if err != nil {
		return
	}
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (c *client) writeLoop() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		err := c.conn.Close()
		if err != nil {
			return
		}
	}()
	for {
		select {
		case msg, ok := <-c.send:
			err := c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err != nil {
				return
			}
			if !ok {
				err := c.conn.WriteMessage(websocket.CloseMessage, nil)
				if err != nil {
					return
				}
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			err := c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err != nil {
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
