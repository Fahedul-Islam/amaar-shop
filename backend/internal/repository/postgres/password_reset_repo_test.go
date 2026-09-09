package postgres

import (
	"context"
	"database/sql"
	"os"
	"sync"
	"sync/atomic"
	"testing"
)

// Run against an isolated test database; the test uses a temporary schema.
func TestPasswordResetPersistence(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	db, err := sql.Open("postgres", url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// One connection keeps search_path local to this test, including concurrent requests.
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	for _, q := range []string{`CREATE SCHEMA reset_test`, `SET search_path TO reset_test`, `CREATE TABLE users(id UUID PRIMARY KEY,email TEXT,password_hash TEXT,updated_at TIMESTAMPTZ)`} {
		if _, err = db.ExecContext(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	defer db.ExecContext(ctx, `DROP SCHEMA reset_test CASCADE`)
	migration, err := os.ReadFile("../../../migrations/000023_password_resets.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, string(migration)); err != nil {
		t.Fatal(err)
	}
	const id = "00000000-0000-0000-0000-000000000001"
	db.ExecContext(ctx, `INSERT INTO users(id,email,password_hash) VALUES ($1,'owner@example.com','old')`, id)
	r := NewPasswordResetRepo(db)
	if ok, err := r.Store(ctx, id, "code"); !ok || err != nil {
		t.Fatal(ok, err)
	}
	if ok, err := r.Store(ctx, id, "replacement"); ok || err != nil {
		t.Fatal("cooldown", ok, err)
	}
	for i := 0; i < 5; i++ {
		if ok, err := r.Consume(ctx, "owner@example.com", "wrong", "new"); ok || err != nil {
			t.Fatal(ok, err)
		}
	}
	if ok, err := r.Consume(ctx, "owner@example.com", "code", "new"); ok || err != nil {
		t.Fatal("attempt limit", ok, err)
	}
	db.ExecContext(ctx, `UPDATE password_resets SET sent_at=now()-interval '61 seconds'`)
	if ok, err := r.Store(ctx, id, "replacement"); !ok || err != nil {
		t.Fatal(ok, err)
	}
	if ok, err := r.Consume(ctx, "owner@example.com", "code", "new"); ok || err != nil {
		t.Fatal("superseded code", ok, err)
	}
	db.ExecContext(ctx, `UPDATE password_resets SET expires_at=now()-interval '1 second'`)
	if ok, err := r.Consume(ctx, "owner@example.com", "replacement", "new"); ok || err != nil {
		t.Fatal("expired code", ok, err)
	}
	db.ExecContext(ctx, `UPDATE password_resets SET expires_at=now()+interval '10 minutes'`)
	var successes atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := r.Consume(ctx, "owner@example.com", "replacement", "new")
			if err != nil {
				t.Error(err)
			}
			if ok {
				successes.Add(1)
			}
		}()
	}
	wg.Wait()
	if successes.Load() != 1 {
		t.Fatal("code must succeed exactly once")
	}
	var hash string
	var changed bool
	if err = db.QueryRowContext(ctx, `SELECT password_hash,password_changed_at IS NOT NULL FROM users WHERE id=$1`, id).Scan(&hash, &changed); err != nil || hash != "new" || !changed {
		t.Fatal(hash, changed, err)
	}
	down, err := os.ReadFile("../../../migrations/000023_password_resets.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, string(down)); err != nil {
		t.Fatal(err)
	}
}
