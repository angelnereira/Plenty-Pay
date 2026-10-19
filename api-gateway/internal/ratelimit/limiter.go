package ratelimit

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

// Limiter decide si una petición entra dentro del cupo de un contador.
type Limiter interface {
	Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error)
}

// MemoryLimiter: contador en memoria con ventana fija.
type MemoryLimiter struct {
	mu      sync.Mutex
	buckets map[string]*memBucket
}

type memBucket struct {
	count   int
	resetAt time.Time
}

func NewMemory() *MemoryLimiter {
	return &MemoryLimiter{buckets: make(map[string]*memBucket)}
}

func (m *MemoryLimiter) Allow(_ context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	b, ok := m.buckets[key]
	if !ok || now.After(b.resetAt) {
		b = &memBucket{count: 0, resetAt: now.Add(window)}
		m.buckets[key] = b
	}
	if b.count >= limit {
		retry := int(time.Until(b.resetAt).Seconds())
		if retry < 1 {
			retry = 1
		}
		return false, retry, nil
	}
	b.count++
	return true, 0, nil
}

// NatsKVLimiter: contador compartido en NATS KV (ventana fija). Funciona con varias réplicas.
type NatsKVLimiter struct {
	KV nats.KeyValue
}

func NewNatsKV(kv nats.KeyValue) *NatsKVLimiter {
	return &NatsKVLimiter{KV: kv}
}

// ErrKeyNotFound sentinel; implementaciones deben devolver un error comparable.
var ErrKeyNotFound = nats.ErrKeyNotFound

func isNotFound(err error) bool {
	return err != nil && (errors.Is(err, ErrKeyNotFound) || contains(err.Error(), "key not found"))
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (func() bool {
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	})()
}

func (n *NatsKVLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	if n.KV == nil {
		return true, 0, errors.New("nil kv")
	}
	minute := time.Now().UTC().Truncate(time.Minute).Unix()
	k := fmt.Sprintf("rl_%s_%d", sanitizeKey(key), minute)
	for attempt := 0; attempt < 5; attempt++ {
		entry, err := n.KV.Get(k)
		var rev uint64
		count := 0
		if err == nil {
			rev = entry.Revision()
			if v, perr := strconv.Atoi(string(entry.Value())); perr == nil {
				count = v
			}
		} else if !isNotFound(err) {
			return true, 0, err // fail-open
		}
		if count >= limit {
			retry := int(time.Until(time.Unix(minute, 0).Add(window)).Seconds())
			if retry < 1 {
				retry = 1
			}
			return false, retry, nil
		}
		newVal := []byte(strconv.Itoa(count + 1))
		var nerr error
		if rev == 0 {
			_, nerr = n.KV.Create(k, newVal)
		} else {
			_, nerr = n.KV.Update(k, newVal, rev)
		}
		if nerr == nil {
			return true, 0, nil
		}
		time.Sleep(time.Millisecond * time.Duration(attempt+1))
	}
	return true, 0, errors.New("ratelimit: too many conflicts")
}


func sanitizeKey(key string) string {
	out := make([]byte, 0, len(key))
	for i := 0; i < len(key); i++ {
		c := key[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '/' || c == '=' {
			out = append(out, c)
		} else {
			out = append(out, '_')
		}
	}
	return string(out)
}
