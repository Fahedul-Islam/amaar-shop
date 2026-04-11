package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/platform/database"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

type deliverySettingsRepo struct {
	db database.DBTX
}

func NewDeliverySettingsRepo(db database.DBTX) repository.DeliverySettingsRepository {
	return &deliverySettingsRepo{db: db}
}

func (r *deliverySettingsRepo) Get(ctx context.Context, shopID string) (*domain.DeliverySettings, error) {
	ds := &domain.DeliverySettings{}
	var threshold sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT shop_id, cod_enabled, delivery_charge::text, free_delivery_threshold::text,
		        advance_payment_required, COALESCE(advance_payment_instructions,''),
		        delivery_areas, updated_at
		 FROM shop_delivery_settings WHERE shop_id = $1`, shopID,
	).Scan(
		&ds.ShopID, &ds.CODEnabled, &ds.DeliveryCharge, &threshold,
		&ds.AdvancePaymentRequired, &ds.AdvancePaymentInstructions,
		pq.Array(&ds.DeliveryAreas), &ds.UpdatedAt,
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
	if ds.DeliveryAreas == nil {
		ds.DeliveryAreas = []string{}
	}
	return ds, nil
}

func (r *deliverySettingsRepo) Upsert(ctx context.Context, settings *domain.DeliverySettings) error {
	var threshold *string
	if settings.FreeDeliveryThreshold != nil && *settings.FreeDeliveryThreshold != "" {
		threshold = settings.FreeDeliveryThreshold
	}

	err := r.db.QueryRowContext(ctx,
		`INSERT INTO shop_delivery_settings
		   (shop_id, cod_enabled, delivery_charge, free_delivery_threshold,
		    advance_payment_required, advance_payment_instructions, delivery_areas)
		 VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6, $7)
		 ON CONFLICT (shop_id) DO UPDATE SET
		   cod_enabled = EXCLUDED.cod_enabled,
		   delivery_charge = EXCLUDED.delivery_charge,
		   free_delivery_threshold = EXCLUDED.free_delivery_threshold,
		   advance_payment_required = EXCLUDED.advance_payment_required,
		   advance_payment_instructions = EXCLUDED.advance_payment_instructions,
		   delivery_areas = EXCLUDED.delivery_areas
		 RETURNING updated_at`,
		settings.ShopID, settings.CODEnabled, settings.DeliveryCharge, threshold,
		settings.AdvancePaymentRequired, settings.AdvancePaymentInstructions,
		pq.Array(settings.DeliveryAreas),
	).Scan(&settings.UpdatedAt)
	return err
}
