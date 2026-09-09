package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/fhedul/amaarshop/backend/internal/service"
	"github.com/lib/pq"
)

func TestCheckoutDeliveryAndCoupons(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	admin, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	ctx := context.Background()
	schema := fmt.Sprintf("checkout_test_%d", time.Now().UnixNano())
	if _, err = admin.ExecContext(ctx, `CREATE SCHEMA `+pq.QuoteIdentifier(schema)); err != nil {
		t.Fatal(err)
	}
	defer admin.ExecContext(ctx, `DROP SCHEMA `+pq.QuoteIdentifier(schema)+` CASCADE`)
	if strings.HasPrefix(dsn, "postgres") {
		u, _ := url.Parse(dsn)
		q := u.Query()
		q.Set("search_path", schema+",public")
		u.RawQuery = q.Encode()
		dsn = u.String()
	} else {
		dsn += " search_path=" + schema + ",public"
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(8)
	files, err := filepath.Glob("../../../migrations/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = db.ExecContext(ctx, string(b)); err != nil {
			t.Fatalf("%s: %v", f, err)
		}
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := db.ExecContext(ctx, q, args...); err != nil {
			t.Fatal(err)
		}
	}
	var owner, shopID, otherShop string
	if err = db.QueryRowContext(ctx, `INSERT INTO users(email,password_hash) VALUES('coupon-owner@example.com','test') RETURNING id`).Scan(&owner); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRowContext(ctx, `INSERT INTO shops(owner_user_id,slug,name) VALUES($1,'coupon-shop','Test shop') RETURNING id`, owner).Scan(&shopID); err != nil {
		t.Fatal(err)
	}
	var otherOwner string
	db.QueryRowContext(ctx, `INSERT INTO users(email,password_hash) VALUES('other@example.com','test') RETURNING id`).Scan(&otherOwner)
	if err = db.QueryRowContext(ctx, `INSERT INTO shops(owner_user_id,slug,name) VALUES($1,'other-shop','Other shop') RETURNING id`, otherOwner).Scan(&otherShop); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO shop_delivery_settings(shop_id,cod_enabled,delivery_charge,advance_payment_required,is_configured) VALUES($1,true,60,true,true)`, shopID)
	products := NewProductRepo(db)
	shops := NewShopRepo(db)
	coupons := NewCouponRepo(db)
	orders := NewOrderRepo(db)
	reserves := NewCartReservationRepo(db)
	svc := service.NewOrderService(shops, NewDeliverySettingsRepo(db), products, orders, NewPaymentMethodRepo(db), reserves)
	svc.SetCoupons(coupons)
	couponSvc := service.NewCouponService(shops, coupons)
	p := &domain.Product{ShopID: shopID, Name: "Item", PriceBDT: "200.00", Stock: 20, IsActive: true, AdvanceDeliveryExempt: true}
	if err = products.Create(ctx, p); err != nil {
		t.Fatal(err)
	}
	loaded, err := products.FindByID(ctx, p.ID, shopID)
	if err != nil || !loaded.AdvanceDeliveryExempt {
		t.Fatal("product flag read", err)
	}
	loaded.AdvanceDeliveryExempt = false
	if err = products.Update(ctx, loaded); err != nil {
		t.Fatal(err)
	}
	loaded.AdvanceDeliveryExempt = true
	if err = products.Update(ctx, loaded); err != nil {
		t.Fatal(err)
	}
	list, _, err := products.ListByShop(ctx, shopID, domain.ProductFilter{Page: 1, PageSize: 10})
	if err != nil || len(list) != 1 || !list[0].AdvanceDeliveryExempt {
		t.Fatal("product list", err)
	}
	input := service.PlaceOrderInput{CustomerName: "Buyer", CustomerPhone: "+8801712345678", DeliveryAddress: "123 Test Street", DeliveryDivision: "Dhaka", Items: []service.OrderItemInput{{ProductID: p.ID, Quantity: 1}}}
	createCoupon := func(amount string) *domain.Coupon {
		t.Helper()
		c, err := couponSvc.Create(ctx, owner, amount, "01712345678", time.Now().Add(time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	c := createCoupon("50.00")
	input.CouponCode = strings.ToLower(c.Code)
	quote, err := svc.Quote(ctx, "coupon-shop", input)
	if err != nil || quote.TotalBDT != "210.00" || quote.AdvancePaymentRequired {
		t.Fatal("quote", quote, err)
	}
	check, _ := coupons.Find(ctx, shopID, c.Code)
	if check.RedeemedAt != nil {
		t.Fatal("quote redeemed coupon")
	}
	wrong := input
	wrong.CustomerPhone = "01812345678"
	if _, err = svc.Quote(ctx, "coupon-shop", wrong); !errors.Is(err, domain.ErrCouponInvalid) {
		t.Fatal("phone restriction", err)
	}
	if err = couponSvc.Disable(ctx, otherOwner, c.ID); !errors.Is(err, domain.ErrCouponInvalid) {
		t.Fatal("cross-shop disable", err)
	}
	if _, err = coupons.Find(ctx, otherShop, c.Code); !errors.Is(err, domain.ErrCouponInvalid) {
		t.Fatal("cross-shop lookup", err)
	}
	var successes atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.PlaceOrder(ctx, "coupon-shop", input)
			if err == nil {
				successes.Add(1)
			} else if !errors.Is(err, domain.ErrCouponInvalid) {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if successes.Load() != 1 {
		t.Fatal("concurrent coupon use", successes.Load())
	}
	// Read through the real order scanner and verify the persisted discount.
	row := db.QueryRowContext(ctx, `SELECT `+orderColumns+` FROM orders o WHERE o.coupon_id=$1`, c.ID)
	saved, err := scanOrder(row)
	if err != nil || saved.CouponCode != c.Code || saved.CouponDiscountBDT != "50.00" || saved.TotalBDT != "210.00" {
		t.Fatal("order snapshot", saved, err)
	}
	if _, err = orders.UpdateBuyerEditableFields(ctx, shopID, saved.ID, "01712345678", repository.BuyerEditableFields{DeliveryAddress: "456 Test Road", DeliveryDivision: "Dhaka", DeliveryDistrict: "Dhaka"}); err != nil {
		t.Fatal("update scanner", err)
	}
	// An order failure must not consume its coupon.
	c2 := createCoupon("25.00")
	input.CouponCode = c2.Code
	draft, err := svc.Quote(ctx, "coupon-shop", input)
	if err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE products SET stock=0 WHERE id=$1`, p.ID)
	if err = orders.PlaceOrder(ctx, draft); !errors.Is(err, domain.ErrInsufficientStock) {
		t.Fatal("expected stock failure", err)
	}
	check, err = coupons.Find(ctx, shopID, c2.Code)
	if err != nil || check.RedeemedAt != nil {
		t.Fatal("failed order consumed coupon", err)
	}
	exec(`UPDATE products SET stock=20 WHERE id=$1`, p.ID)
	// Reservations must use the same exemption and coupon rules.
	hold, err := reserves.Create(ctx, shopID, time.Now().Add(time.Minute), []repository.ReserveItemInput{{ProductID: p.ID, Quantity: 1}})
	if err != nil {
		t.Fatal(err)
	}
	input.ReservationID = hold.ID
	saved, err = svc.PlaceOrder(ctx, "coupon-shop", input)
	if err != nil || saved.TotalBDT != "235.00" || saved.AdvancePaymentRequired {
		t.Fatal("reserved checkout", err)
	}
	c3 := createCoupon("500.00")
	input.ReservationID = ""
	input.CouponCode = c3.Code
	quote, err = svc.Quote(ctx, "coupon-shop", input)
	if err != nil || quote.TotalBDT != "60.00" {
		t.Fatal("discount cap", err)
	}
	if err = couponSvc.Disable(ctx, owner, c3.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Quote(ctx, "coupon-shop", input); !errors.Is(err, domain.ErrCouponInvalid) {
		t.Fatal("disabled coupon", err)
	}
	down, err := os.ReadFile("../../../migrations/000024_delivery_coupons.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	exec(string(down))
}
