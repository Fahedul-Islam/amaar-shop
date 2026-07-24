package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type courierSettingsRepo struct {
	db *sql.DB
}

func NewCourierSettingsRepo(db *sql.DB) repository.CourierSettingsRepository {
	return &courierSettingsRepo{db: db}
}

func (r *courierSettingsRepo) Get(ctx context.Context, shopID string) (*domain.CourierSettings, error) {
	cs := &domain.CourierSettings{ShopID: shopID, Provider: "steadfast"}
	err := r.db.QueryRowContext(ctx,
		`SELECT provider, api_key, secret_key, is_enabled, updated_at
		 FROM shop_courier_settings WHERE shop_id = $1`, shopID,
	).Scan(&cs.Provider, &cs.APIKey, &cs.SecretKey, &cs.IsEnabled, &cs.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		// No row yet — return the zero-value defaults so callers can render an
		// empty settings form and Configured() reports false.
		return cs, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get courier settings: %w", err)
	}
	return cs, nil
}

func (r *courierSettingsRepo) Upsert(ctx context.Context, s *domain.CourierSettings) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO shop_courier_settings (shop_id, provider, api_key, secret_key, is_enabled)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (shop_id) DO UPDATE
		   SET provider   = EXCLUDED.provider,
		       api_key    = EXCLUDED.api_key,
		       secret_key = EXCLUDED.secret_key,
		       is_enabled = EXCLUDED.is_enabled`,
		s.ShopID, s.Provider, s.APIKey, s.SecretKey, s.IsEnabled,
	)
	if err != nil {
		return fmt.Errorf("upsert courier settings: %w", err)
	}
	return nil
}
