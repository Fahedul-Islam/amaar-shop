package service

import (
	"sync"
	"time"
)

// ttlCache is a small in-memory cache the analytics services use to absorb
// dashboard refresh-spam. It is deliberately dumb: no eviction, no size cap.
// Entries are per-shop and few, and a process restart clearing them is fine.
type ttlCache struct {
	mu      sync.RWMutex
	ttl     time.Duration
	entries map[string]ttlEntry
}

type ttlEntry struct {
	value     any
	expiresAt time.Time
}

func newTTLCache(ttl time.Duration) *ttlCache {
	return &ttlCache{ttl: ttl, entries: make(map[string]ttlEntry)}
}

func (c *ttlCache) get(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[key]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.value, true
}

func (c *ttlCache) set(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = ttlEntry{value: value, expiresAt: time.Now().Add(c.ttl)}
}

// cachedValue returns the cached value for key, or calls load and stores the
// result under it.
//
// A stored value whose type doesn't match T counts as a miss and is
// recomputed. That matters: the previous implementation asserted the cached
// value unconditionally, so any key that ever held two different types would
// panic the request rather than degrade to a reload.
func cachedValue[T any](c *ttlCache, key string, load func() (T, error)) (T, error) {
	if v, ok := c.get(key); ok {
		if typed, ok := v.(T); ok {
			return typed, nil
		}
	}
	out, err := load()
	if err != nil {
		var zero T
		return zero, err
	}
	c.set(key, out)
	return out, nil
}
