// Package events defines the Redis pub/sub channels shared by the ingestion
// service and the API.
package events

const (
	// PositionsChannel carries live positions from ingest to the API hub.
	PositionsChannel = "rudra.positions"
	// CommandsChannel carries Codec 12 commands from the API to ingest.
	CommandsChannel = "rudra.device.commands"
	// AlertsChannel carries alerts raised by the worker to the API hub.
	AlertsChannel = "rudra.alerts"
)
