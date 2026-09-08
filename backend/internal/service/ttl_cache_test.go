package service

import (
	"errors"
	"testing"
	"time"
)

func TestCachedValue_HitsAndMisses(t *testing.T) {
	c := newTTLCache(time.Minute)

	calls := 0
	load := func() (int, error) {
		calls++
		return 42, nil
	}

	for i := 0; i < 3; i++ {
		got, err := cachedValue(c, "k", load)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != 42 {
			t.Fatalf("got %d, want 42", got)
		}
	}
	if calls != 1 {
		t.Errorf("loader ran %d times, want 1 (later reads should hit the cache)", calls)
	}
}

func TestCachedValue_ExpiredEntryReloads(t *testing.T) {
	c := newTTLCache(time.Nanosecond)

	calls := 0
	load := func() (int, error) {
		calls++
		return calls, nil
	}

	if _, err := cachedValue(c, "k", load); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(time.Millisecond)
	got, err := cachedValue(c, "k", load)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != 2 || calls != 2 {
		t.Errorf("expired entry should reload: got %d after %d calls", got, calls)
	}
}

// A key holding one type but read as another must degrade to a reload. The
// previous cache asserted unconditionally, so this case panicked the request.
func TestCachedValue_TypeMismatchIsAMissNotAPanic(t *testing.T) {
	c := newTTLCache(time.Minute)

	if _, err := cachedValue(c, "shared", func() (string, error) { return "a string", nil }); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := cachedValue(c, "shared", func() (int, error) { return 7, nil })
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != 7 {
		t.Errorf("got %d, want 7 from the reload", got)
	}
}

func TestCachedValue_ErrorIsNotCached(t *testing.T) {
	c := newTTLCache(time.Minute)
	wantErr := errors.New("boom")

	calls := 0
	load := func() (int, error) {
		calls++
		if calls == 1 {
			return 0, wantErr
		}
		return 5, nil
	}

	if _, err := cachedValue(c, "k", load); !errors.Is(err, wantErr) {
		t.Fatalf("got %v, want %v", err, wantErr)
	}
	got, err := cachedValue(c, "k", load)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != 5 {
		t.Errorf("a failed load must not poison the key: got %d, want 5", got)
	}
}
