package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rudra-netra/backend/internal/config"
	"github.com/rudra-netra/backend/internal/domain"
	"go.uber.org/zap"
)

// Client wraps the go-redis client.
type Client struct {
	rdb    *redis.Client
	logger *zap.Logger
}

// NewClient initializes a new Redis client connection.
func NewClient(ctx context.Context, cfg *config.RedisConfig, logger *zap.Logger) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis at %s: %w", cfg.Addr, err)
	}

	logger.Info("connected to Redis successfully", zap.String("addr", cfg.Addr))
	return &Client{rdb: rdb, logger: logger}, nil
}

// SetLivePosition caches the latest position of a device (key: device:pos:{deviceID}).
func (c *Client) SetLivePosition(ctx context.Context, deviceID int64, pos *domain.LivePosition) error {
	data, err := json.Marshal(pos)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("device:pos:%d", deviceID)
	// Cache for 24 hours
	return c.rdb.Set(ctx, key, data, 24*time.Hour).Err()
}

// GetLivePosition gets the cached latest position of a device.
func (c *Client) GetLivePosition(ctx context.Context, deviceID int64) (*domain.LivePosition, error) {
	key := fmt.Sprintf("device:pos:%d", deviceID)
	val, err := c.rdb.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var pos domain.LivePosition
	if err := json.Unmarshal([]byte(val), &pos); err != nil {
		return nil, err
	}
	return &pos, nil
}

// Close closes the Redis connection.
func (c *Client) Close() error {
	return c.rdb.Close()
}
