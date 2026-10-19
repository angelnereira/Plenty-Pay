package ratelimit

import (
	"context"
	"testing"
	"time"
)

func TestMemoryLimiter_AllowsUpToLimit(t *testing.T) {
	l := NewMemory()
	for i := 0; i < 3; i++ {
		ok, _, err := l.Allow(context.Background(), "k", 3, time.Minute)
		if err != nil || !ok {
			t.Fatalf("request %d should be allowed: ok=%v err=%v", i, ok, err)
		}
	}
	ok, retry, _ := l.Allow(context.Background(), "k", 3, time.Minute)
	if ok {
		t.Fatal("4th request should be denied")
	}
	if retry < 1 {
		t.Fatalf("retry-after should be >=1, got %d", retry)
	}
}

func TestMemoryLimiter_SeparateKeys(t *testing.T) {
	l := NewMemory()
	for i := 0; i < 2; i++ {
		ok, _, _ := l.Allow(context.Background(), "a", 1, time.Minute)
		if i == 0 && !ok {
			t.Fatal("first a should pass")
		}
		if i == 1 && ok {
			t.Fatal("second a should fail")
		}
	}
	ok, _, _ := l.Allow(context.Background(), "b", 1, time.Minute)
	if !ok {
		t.Fatal("b should pass independently")
	}
}

func TestMemoryLimiter_WindowReset(t *testing.T) {
	l := NewMemory()
	l.Allow(context.Background(), "k", 1, 10*time.Millisecond)
	time.Sleep(20 * time.Millisecond)
	ok, _, _ := l.Allow(context.Background(), "k", 1, 10*time.Millisecond)
	if !ok {
		t.Fatal("should allow after window reset")
	}
}
