package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

type deliverySettingsRepo struct {
	db  database.DBTX
	raw *sql.DB
}

func NewDeliverySettingsRepo(db *sql.DB) repository.DeliverySettingsRepository {
	return &deliverySettingsRepo{db: db, raw: db}
}

func (r *deliverySettingsRepo) Get(ctx context.Context, shopID string) (*domain.DeliverySettings, error) {
	ds := &domain.DeliverySettings{}
	var threshold sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT shop_id, cod_enabled, delivery_charge::text, free_delivery_threshold::text,
		        advance_payment_required, COALESCE(advance_payment_instructions,''),
		        updated_at
	 FROM shop_delivery_settings WHERE shop_id = $1`, shopID,
	).Scan(
		&ds.ShopID, &ds.CODEnabled, &ds.DeliveryCharge, &threshold,
		&ds.AdvancePaymentRequired, &ds.AdvancePaymentInstructions, &ds.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrShopNotFound
	}
	if err != nil {
		return nil, err
	}
	if threshold.Valid {
		ds.FreeDeliveryThreshold = &threshold.String
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT id, division, delivery_charge::text
		 FROM shop_delivery_zones WHERE shop_id = $1 ORDER BY division`, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var z domain.DeliveryZone
		if err := rows.Scan(&z.ID, &z.Division, &z.DeliveryCharge); err != nil {
			return nil, err
		}
		ds.DeliveryZones = append(ds.DeliveryZones, z)
	}
	if ds.DeliveryZones == nil {
		ds.DeliveryZones = []domain.DeliveryZone{}
	}
	return ds, nil
}

func (r *deliverySettingsRepo) Upsert(ctx context.Context, settings *domain.DeliverySettings) error {
	tx, err := r.raw.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var threshold *string
	if settings.FreeDeliveryThreshold != nil && *settings.FreeDeliveryThreshold != "" {
		threshold = settings.FreeDeliveryThreshold
	}

	err = tx.QueryRowContext(ctx,
		`INSERT INTO shop_delivery_settings
		   (shop_id, cod_enabled, delivery_charge, free_delivery_threshold,
		    advance_payment_required, advance_payment_instructions)
		 VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6)
		 ON CONFLICT (shop_id) DO UPDATE SET
		   cod_enabled = EXCLUDED.cod_enabled,
		   delivery_charge = EXCLUDED.delivery_charge,
		   free_delivery_threshold = EXCLUDED.free_delivery_threshold,
		   advance_payment_required = EXCLUDED.advance_payment_required,
		   advance_payment_instructions = EXCLUDED.advance_payment_instructions
		 RETURNING updated_at`,
		settings.ShopID, settings.CODEnabled, settings.DeliveryCharge, threshold,
		settings.AdvancePaymentRequired, settings.AdvancePaymentInstructions,
	).Scan(&settings.UpdatedAt)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM shop_delivery_zones WHERE shop_id = $1`, settings.ShopID); err != nil {
		return err
	}

	for i := range settings.DeliveryZones {
		z := &settings.DeliveryZones[i]
		err := tx.QueryRowContext(ctx,
			`INSERT INTO shop_delivery_zones (shop_id, division, delivery_charge)
			 VALUES ($1, $2, $3::numeric)
			 RETURNING id`,
			settings.ShopID, z.Division, z.DeliveryCharge,
		).Scan(&z.ID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}
