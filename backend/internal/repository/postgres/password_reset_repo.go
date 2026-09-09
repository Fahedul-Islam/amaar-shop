package postgres

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"errors"
)

type PasswordResetRepo struct{ db *sql.DB }

func NewPasswordResetRepo(db *sql.DB) *PasswordResetRepo { return &PasswordResetRepo{db} }
func (r *PasswordResetRepo) Store(ctx context.Context, id, hash string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `INSERT INTO password_resets (user_id,code_hash,expires_at) VALUES ($1,$2,now()+interval '10 minutes')
 ON CONFLICT (user_id) DO UPDATE SET code_hash=$2, expires_at=now()+interval '10 minutes',sent_at=now(),attempts=0
 WHERE password_resets.sent_at <= now()-interval '60 seconds'`, id, hash)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n == 1, err
}
func (r *PasswordResetRepo) Delete(ctx context.Context, id, hash string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM password_resets WHERE user_id=$1 AND code_hash=$2`, id, hash)
	return err
}
func (r *PasswordResetRepo) Consume(ctx context.Context, email, code, password string) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	var id, hash string
	err = tx.QueryRowContext(ctx, `SELECT p.user_id,p.code_hash FROM password_resets p JOIN users u ON u.id=p.user_id
 WHERE u.email=$1 AND p.expires_at>now() AND p.attempts<5 FOR UPDATE OF p`, email).Scan(&id, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if subtle.ConstantTimeCompare([]byte(hash), []byte(code)) != 1 {
		_, err = tx.ExecContext(ctx, `UPDATE password_resets SET attempts=attempts+1 WHERE user_id=$1`, id)
		if err != nil {
			return false, err
		}
		return false, tx.Commit()
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET password_hash=$2,updated_at=now(),password_changed_at=now() WHERE id=$1`, id, password); err != nil {
		return false, err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM password_resets WHERE user_id=$1`, id); err != nil {
		return false, err
	}
	return true, tx.Commit()
}
