package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/lib/pq"
)

type reviewRepo struct {
	db *sql.DB
}

func NewReviewRepo(db *sql.DB) repository.ReviewRepository {
	return &reviewRepo{db: db}
}

const reviewColumns = `r.id, r.shop_id, r.product_id, r.order_id, r.order_item_id,
	r.customer_name, r.customer_phone, r.rating, r.body, r.image_url,
	r.owner_reply, r.owner_replied_at, r.created_at, r.updated_at,
	COALESCE(p.name, '')`

func scanReview(scanner interface{ Scan(...any) error }) (*domain.Review, error) {
	r := &domain.Review{}
	var imageURL, ownerReply sql.NullString
	var ownerRepliedAt sql.NullTime
	if err := scanner.Scan(
		&r.ID, &r.ShopID, &r.ProductID, &r.OrderID, &r.OrderItemID,
		&r.CustomerName, &r.CustomerPhone, &r.Rating, &r.Body, &imageURL,
		&ownerReply, &ownerRepliedAt, &r.CreatedAt, &r.UpdatedAt,
		&r.ProductName,
	); err != nil {
		return nil, err
	}
	if imageURL.Valid {
		r.ImageURL = &imageURL.String
	}
	if ownerReply.Valid {
		r.OwnerReply = &ownerReply.String
	}
	if ownerRepliedAt.Valid {
		t := ownerRepliedAt.Time
		r.OwnerRepliedAt = &t
	}
	return r, nil
}

func (r *reviewRepo) Create(ctx context.Context, review *domain.Review) error {
	var imageURL sql.NullString
	if review.ImageURL != nil {
		imageURL = sql.NullString{String: *review.ImageURL, Valid: true}
	}

	err := r.db.QueryRowContext(ctx,
		`INSERT INTO product_reviews
		   (shop_id, product_id, order_id, order_item_id,
		    customer_name, customer_phone, rating, body, image_url)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, created_at, updated_at`,
		review.ShopID, review.ProductID, review.OrderID, review.OrderItemID,
		review.CustomerName, review.CustomerPhone, review.Rating, review.Body, imageURL,
	).Scan(&review.ID, &review.CreatedAt, &review.UpdatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return domain.ErrReviewAlreadyExists
		}
		return fmt.Errorf("insert review: %w", err)
	}
	return nil
}

func (r *reviewRepo) FindByID(ctx context.Context, id string) (*domain.Review, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT `+reviewColumns+`
		 FROM product_reviews r
		 LEFT JOIN products p ON p.id = r.product_id
		 WHERE r.id = $1`,
		id,
	)
	rev, err := scanReview(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrReviewNotFound
		}
		return nil, fmt.Errorf("find review: %w", err)
	}
	return rev, nil
}

func (r *reviewRepo) ListByShop(ctx context.Context, shopID string, limit, offset int) ([]*domain.Review, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM product_reviews WHERE shop_id = $1`, shopID,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count shop reviews: %w", err)
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT `+reviewColumns+`
		 FROM product_reviews r
		 LEFT JOIN products p ON p.id = r.product_id
		 WHERE r.shop_id = $1
		 ORDER BY r.created_at DESC
		 LIMIT $2 OFFSET $3`,
		shopID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list shop reviews: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Review, 0)
	for rows.Next() {
		rev, err := scanReview(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan review: %w", err)
		}
		out = append(out, rev)
	}
	return out, total, rows.Err()
}

func (r *reviewRepo) ListByProduct(ctx context.Context, productID string, limit, offset int) ([]*domain.Review, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`, productID,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count product reviews: %w", err)
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT `+reviewColumns+`
		 FROM product_reviews r
		 LEFT JOIN products p ON p.id = r.product_id
		 WHERE r.product_id = $1
		 ORDER BY r.created_at DESC
		 LIMIT $2 OFFSET $3`,
		productID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list product reviews: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.Review, 0)
	for rows.Next() {
		rev, err := scanReview(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan review: %w", err)
		}
		out = append(out, rev)
	}
	return out, total, rows.Err()
}

func (r *reviewRepo) ShopRating(ctx context.Context, shopID string) (domain.ShopRating, error) {
	var avg sql.NullFloat64
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT AVG(rating)::float, COUNT(*)
		 FROM product_reviews
		 WHERE shop_id = $1`,
		shopID,
	).Scan(&avg, &count)
	if err != nil {
		return domain.ShopRating{}, fmt.Errorf("shop rating: %w", err)
	}
	rating := domain.ShopRating{Count: count}
	if avg.Valid {
		rating.Average = avg.Float64
	}
	return rating, nil
}

func (r *reviewRepo) ProductRating(ctx context.Context, productID string) (domain.ProductRating, error) {
	var avg sql.NullFloat64
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT AVG(rating)::float, COUNT(*)
		 FROM product_reviews
		 WHERE product_id = $1`,
		productID,
	).Scan(&avg, &count)
	if err != nil {
		return domain.ProductRating{}, fmt.Errorf("product rating: %w", err)
	}
	rating := domain.ProductRating{Count: count}
	if avg.Valid {
		rating.Average = avg.Float64
	}
	return rating, nil
}

func (r *reviewRepo) SetOwnerReply(ctx context.Context, ownerUserID, reviewID, reply string) (*domain.Review, error) {
	row := r.db.QueryRowContext(ctx,
		`UPDATE product_reviews r
		 SET owner_reply = $1, owner_replied_at = now()
		 FROM shops s
		 WHERE s.id = r.shop_id
		   AND s.owner_user_id = $2
		   AND r.id = $3
		 RETURNING r.id, r.shop_id, r.product_id, r.order_id, r.order_item_id,
		   r.customer_name, r.customer_phone, r.rating, r.body, r.image_url,
		   r.owner_reply, r.owner_replied_at, r.created_at, r.updated_at,
		   COALESCE((SELECT name FROM products WHERE id = r.product_id), '')`,
		reply, ownerUserID, reviewID,
	)
	rev, err := scanReview(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrReviewNotFound
		}
		return nil, fmt.Errorf("set owner reply: %w", err)
	}
	return rev, nil
}

func (r *reviewRepo) FindOrderItemForReview(ctx context.Context, orderItemID string) (repository.OrderItemReviewContext, error) {
	var c repository.OrderItemReviewContext
	err := r.db.QueryRowContext(ctx,
		`SELECT oi.order_id, o.shop_id, oi.product_id, oi.product_name_snapshot,
		        o.status, o.customer_name, o.customer_phone,
		        EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.order_item_id = oi.id)
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 WHERE oi.id = $1`,
		orderItemID,
	).Scan(
		&c.OrderID, &c.ShopID, &c.ProductID, &c.ProductName,
		&c.OrderStatus, &c.CustomerName, &c.CustomerPhone, &c.AlreadyReview,
	)
	if err != nil {
		return c, err
	}
	return c, nil
}
