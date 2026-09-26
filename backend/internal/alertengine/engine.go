// Package alertengine evaluates live telemetry events against tenant settings
// and raises alerts in PostgreSQL, broadcasting them to the API hub.
package alertengine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/rudra-netra/backend/internal/domain"
	"github.com/rudra-netra/backend/internal/events"
	redisrepo "github.com/rudra-netra/backend/internal/repository/redis"
)

// Business rule thresholds that are not tenant specific.
const (
	powerCutVoltage     = 21.5  // V: external supply below this means a power cut
	reeferBreachHigh    = -14.0 // °C: freezer band breach upper bound
	reeferBreachLow     = 0.0   // °C: ambient (non-reefer) temperatures are far above this band
	overspeedCooldown   = 5 * time.Minute
	idleCooldown        = 30 * time.Minute
	powerCutCooldown    = 30 * time.Minute
	temperatureCooldown = 30 * time.Minute
	defaultSpeedLimit   = 80
	defaultIdleMinutes  = 15
	rulesCacheTTL       = time.Minute
)

type companyRules struct {
	speedLimit  int
	idleMinutes int
	loadedAt    time.Time
}

type deviceState struct {
	idleSince       time.Time
	lastOverspeed   time.Time
	lastIdle        time.Time
	lastPowerCut    time.Time
	lastTemperature time.Time
}

// Engine consumes live position events and raises alerts with per-device
// cooldowns so a single incident does not spam the ledger.
type Engine struct {
	pool   *pgxpool.Pool
	redis  *redisrepo.Client
	logger *zap.Logger

	mu        sync.Mutex
	devices   map[int64]*deviceState
	companies map[int64]*companyRules
}

// New creates an alert engine.
func New(pool *pgxpool.Pool, redis *redisrepo.Client, logger *zap.Logger) *Engine {
	return &Engine{
		pool:      pool,
		redis:     redis,
		logger:    logger,
		devices:   make(map[int64]*deviceState),
		companies: make(map[int64]*companyRules),
	}
}

// Run subscribes to live positions and evaluates them until ctx is cancelled.
func (e *Engine) Run(ctx context.Context) {
	pubsub := e.redis.Subscribe(ctx, events.PositionsChannel)
	defer pubsub.Close()
	channel := pubsub.Channel()

	e.logger.Info("alert engine listening for live telemetry", zap.String("channel", events.PositionsChannel))

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-channel:
			if !ok {
				return
			}
			var event domain.LiveEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				e.logger.Warn("invalid live event for alert engine", zap.Error(err))
				continue
			}
			if event.DeviceID == 0 || event.CompanyID == 0 {
				continue
			}
			e.evaluate(ctx, &event)
		}
	}
}

// evaluate applies the rule set to one live event.
func (e *Engine) evaluate(ctx context.Context, event *domain.LiveEvent) {
	rules := e.rules(ctx, event.CompanyID)
	now := time.Now()
	state := e.deviceState(event.DeviceID)

	// Overspeed
	if rules.speedLimit > 0 && event.Speed > float64(rules.speedLimit) &&
		now.Sub(state.lastOverspeed) > overspeedCooldown {
		state.lastOverspeed = now
		e.raise(ctx, event, "overspeed", "critical",
			fmt.Sprintf("Vehicle %s overspeeding at %.0f km/h (limit %d km/h)",
				label(event), event.Speed, rules.speedLimit))
	}

	// Extended idling (ignition on, stationary)
	if event.Ignition && event.Speed <= 2 {
		if state.idleSince.IsZero() {
			state.idleSince = now
		} else if now.Sub(state.idleSince) >= time.Duration(rules.idleMinutes)*time.Minute &&
			now.Sub(state.lastIdle) > idleCooldown {
			state.lastIdle = now
			e.raise(ctx, event, "over_idle", "warning",
				fmt.Sprintf("Vehicle %s idling with ignition ON for %d minutes",
					label(event), int(now.Sub(state.idleSince).Minutes())))
		}
	} else {
		state.idleSince = time.Time{}
	}

	// Power cut (external supply below the backup threshold)
	if event.Voltage != nil && *event.Voltage > 0 && *event.Voltage < powerCutVoltage &&
		now.Sub(state.lastPowerCut) > powerCutCooldown {
		state.lastPowerCut = now
		e.raise(ctx, event, "power_cut", "critical",
			fmt.Sprintf("Vehicle %s main power cut (external %.1f V, backup battery engaged)",
				label(event), *event.Voltage))
	}

	// Reefer temperature breach inside the freezer band
	if event.Temperature != nil && *event.Temperature >= reeferBreachHigh && *event.Temperature <= reeferBreachLow &&
		now.Sub(state.lastTemperature) > temperatureCooldown {
		state.lastTemperature = now
		e.raise(ctx, event, "temperature", "critical",
			fmt.Sprintf("Reefer unit %s temperature %.1f°C exceeded the -15.0°C threshold",
				label(event), *event.Temperature))
	}
}

// rules returns cached tenant thresholds, refreshing them once a minute.
func (e *Engine) rules(ctx context.Context, companyID int64) *companyRules {
	e.mu.Lock()
	rules := e.companies[companyID]
	e.mu.Unlock()
	if rules != nil && time.Since(rules.loadedAt) < rulesCacheTTL {
		return rules
	}

	rules = &companyRules{speedLimit: defaultSpeedLimit, idleMinutes: defaultIdleMinutes, loadedAt: time.Now()}
	var speed, idle int
	if err := e.pool.QueryRow(ctx, `
		SELECT COALESCE(speed_threshold_kmh, 0), COALESCE(idle_threshold_minutes, 0)
		FROM company_settings WHERE company_id = $1
	`, companyID).Scan(&speed, &idle); err == nil {
		if speed > 0 {
			rules.speedLimit = speed
		}
		if idle > 0 {
			rules.idleMinutes = idle
		}
	}

	e.mu.Lock()
	e.companies[companyID] = rules
	e.mu.Unlock()
	return rules
}

func (e *Engine) deviceState(deviceID int64) *deviceState {
	e.mu.Lock()
	defer e.mu.Unlock()
	state, ok := e.devices[deviceID]
	if !ok {
		state = &deviceState{}
		e.devices[deviceID] = state
	}
	return state
}

// raise stores the alert and publishes it for WebSocket broadcast.
func (e *Engine) raise(ctx context.Context, event *domain.LiveEvent, alertType, severity, message string) {
	var alertID int64
	err := e.pool.QueryRow(ctx, `
		INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
		VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), FALSE, $7, NOW())
		RETURNING id
	`, event.CompanyID, event.DeviceID, alertType, message, event.Lng, event.Lat, severity).Scan(&alertID)
	if err != nil {
		e.logger.Error("failed to store alert", zap.Error(err), zap.String("type", alertType))
		return
	}

	e.logger.Info("alert raised",
		zap.Int64("alert_id", alertID),
		zap.String("type", alertType),
		zap.String("severity", severity),
		zap.String("message", message))

	if e.redis == nil {
		return
	}
	pubCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	_ = e.redis.Publish(pubCtx, events.AlertsChannel, map[string]interface{}{
		"id":         alertID,
		"company_id": event.CompanyID,
		"device_id":  event.DeviceID,
		"type":       alertType,
		"severity":   severity,
		"message":    message,
		"vehicle":    label(event),
		"lat":        event.Lat,
		"lng":        event.Lng,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}

func label(event *domain.LiveEvent) string {
	if event.RegNumber != "" {
		return event.RegNumber
	}
	return fmt.Sprintf("#%d", event.DeviceID)
}
