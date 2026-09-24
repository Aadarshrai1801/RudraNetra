// Package websocket implements a WebSocket hub for broadcasting
// real-time vehicle position updates to connected browser clients.
package websocket

import (
	"encoding/json"
	"sync"

	"go.uber.org/zap"
)

// Message represents a WebSocket message.
type Message struct {
	Type    string      `json:"type"`    // position, alert, geofence
	Payload interface{} `json:"payload"` // typed data
}

// Client represents a connected WebSocket client.
type Client struct {
	ID             string
	CompanyID      int64
	Send           chan []byte
	SubscribedDevs map[int64]bool // device IDs this client wants updates for
	mu             sync.RWMutex
}

// NewClient creates a new WebSocket client.
func NewClient(id string, companyID int64) *Client {
	return &Client{
		ID:             id,
		CompanyID:      companyID,
		Send:           make(chan []byte, 256),
		SubscribedDevs: make(map[int64]bool),
	}
}

// Subscribe adds device IDs to this client's subscription list.
func (c *Client) Subscribe(deviceIDs []int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, id := range deviceIDs {
		c.SubscribedDevs[id] = true
	}
}

// IsSubscribed checks if a client is subscribed to a device.
func (c *Client) IsSubscribed(deviceID int64) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	// If no specific subscriptions, send all (for the client's company)
	if len(c.SubscribedDevs) == 0 {
		return true
	}
	return c.SubscribedDevs[deviceID]
}

// Hub manages all WebSocket clients and broadcasts messages.
type Hub struct {
	// Registered clients grouped by company ID
	clients map[int64]map[*Client]bool

	// Channel to register new clients
	Register chan *Client

	// Channel to unregister clients
	Unregister chan *Client

	// Channel for incoming messages to broadcast
	Broadcast chan BroadcastMessage

	mu     sync.RWMutex
	logger *zap.Logger
}

// BroadcastMessage wraps a message with target info.
type BroadcastMessage struct {
	CompanyID int64
	DeviceID  int64
	Data      []byte
}

// NewHub creates a new WebSocket hub.
func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		clients:    make(map[int64]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan BroadcastMessage, 1024),
		logger:     logger,
	}
}

// Run starts the hub's event loop. Should be called as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if _, ok := h.clients[client.CompanyID]; !ok {
				h.clients[client.CompanyID] = make(map[*Client]bool)
			}
			h.clients[client.CompanyID][client] = true
			h.mu.Unlock()
			h.logger.Info("client connected",
				zap.String("client_id", client.ID),
				zap.Int64("company_id", client.CompanyID),
			)

		case client := <-h.Unregister:
			h.mu.Lock()
			if companyClients, ok := h.clients[client.CompanyID]; ok {
				if _, exists := companyClients[client]; exists {
					delete(companyClients, client)
					close(client.Send)
					if len(companyClients) == 0 {
						delete(h.clients, client.CompanyID)
					}
				}
			}
			h.mu.Unlock()
			h.logger.Info("client disconnected",
				zap.String("client_id", client.ID),
				zap.Int64("company_id", client.CompanyID),
			)

		case msg := <-h.Broadcast:
			h.mu.RLock()
			companyClients, ok := h.clients[msg.CompanyID]
			h.mu.RUnlock()

			if !ok {
				continue
			}

			for client := range companyClients {
				if client.IsSubscribed(msg.DeviceID) {
					select {
					case client.Send <- msg.Data:
					default:
						// Client buffer full — disconnect
						h.Unregister <- client
					}
				}
			}
		}
	}
}

// BroadcastPosition sends a position update to all subscribed clients.
func (h *Hub) BroadcastPosition(companyID, deviceID int64, data interface{}) {
	jsonData, err := json.Marshal(Message{
		Type:    "position",
		Payload: data,
	})
	if err != nil {
		h.logger.Error("failed to marshal position", zap.Error(err))
		return
	}

	h.Broadcast <- BroadcastMessage{
		CompanyID: companyID,
		DeviceID:  deviceID,
		Data:      jsonData,
	}
}

// BroadcastAlert sends an alert notification to all company clients.
func (h *Hub) BroadcastAlert(companyID int64, data interface{}) {
	jsonData, err := json.Marshal(Message{
		Type:    "alert",
		Payload: data,
	})
	if err != nil {
		h.logger.Error("failed to marshal alert", zap.Error(err))
		return
	}

	h.Broadcast <- BroadcastMessage{
		CompanyID: companyID,
		DeviceID:  0, // alerts go to all company clients
		Data:      jsonData,
	}
}

// ConnectedCount returns the total number of connected clients.
func (h *Hub) ConnectedCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	count := 0
	for _, clients := range h.clients {
		count += len(clients)
	}
	return count
}
