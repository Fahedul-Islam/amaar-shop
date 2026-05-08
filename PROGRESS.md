# Feature: Advance Delivery Fee for COD Orders

Track plan, progress, and context for adding seller-configurable advance
delivery-fee collection to the COD checkout flow.

---

## Context Snapshot (read before starting any task)

### Existing groundwork
The codebase already has a partial foundation. **Reuse, do not duplicate.**

- [`backend/internal/domain/delivery_settings.go`](backend/internal/domain/delivery_settings.go) — `DeliverySettings` already has `AdvancePaymentRequired` (bool) and `AdvancePaymentInstructions` (free-text string). The boolean toggle is therefore already modeled; what is missing is the **structured payment-method list** and the **per-order proof submission**.
- [`backend/internal/domain/order.go`](backend/internal/domain/order.go) — `Order` already has `AdvancePaymentRequired` and `AdvancePaymentReceived` flags. No proof fields yet (transaction id, receipt, payment method picked).
- Migration cap is `000015`. Next migration = `000016`.
- Backend layering convention is strict: **handler → service → repository**. Every feature has matching files in [backend/internal/handler/http/](backend/internal/handler/http/), [backend/internal/service/](backend/internal/service/), [backend/internal/repository/](backend/internal/repository/), and [backend/internal/domain/](backend/internal/domain/). Do not call repos from handlers, do not put HTTP types in services.
- Router wiring lives in [backend/internal/handler/http/router.go](backend/internal/handler/http/router.go) and dependency wiring in [backend/internal/app/](backend/internal/app/) — both must be updated when adding a new handler.
- Frontend dashboard delivery settings UI: [frontend/src/app/dashboard/settings/delivery/page.tsx](frontend/src/app/dashboard/settings/delivery/page.tsx) — extend here, do not create a new settings page.
- Buyer checkout: [frontend/src/app/s/\[slug\]/checkout/page.tsx](frontend/src/app/s/%5Bslug%5D/checkout/page.tsx) — extend with the advance-payment step.
- Seller order detail: [frontend/src/app/dashboard/orders/\[id\]/](frontend/src/app/dashboard/orders/%5Bid%5D/) — surface buyer's submitted proof + a "mark received" control.
- Buyer order tracking already exists at [frontend/src/app/order-lookup/](frontend/src/app/order-lookup/) and [frontend/src/app/s/\[slug\]/order-lookup/](frontend/src/app/s/%5Bslug%5D/order-lookup/) — extend these for proof editing pre-confirmation.
- File uploads: there is a working uploads directory served at `/uploads/` (see `registerUploadRoutes` in router.go). Reuse the same flow for receipt uploads — do **not** introduce a new storage system.

### Conventions to honor (from auto-memory)
- Stdlib `net/http` only, no chi. No nginx proxy.
- Keep it simple — add only what the spec needs, no premature abstraction.
- Three-layer separation is non-negotiable.
- Frontend must be friendly for non-technical Bangladeshi sellers and buyers; bilingual labels where existing pages already use them; mobile-first.

---

## Data Model Plan

### New table: `shop_payment_methods`
One row per seller-configured payment method (bank or mobile banking). Plural rows allowed; surface all to the buyer.

```
id                uuid PK
shop_id           uuid FK -> shops(id) ON DELETE CASCADE
method_type       text CHECK IN ('bank', 'mobile_banking')
display_order     int NOT NULL DEFAULT 0
is_active         bool NOT NULL DEFAULT true

-- Bank fields (NULL when method_type='mobile_banking')
bank_name         text
account_number    text
account_name      text
branch            text
routing_number    text

-- Mobile banking fields (NULL when method_type='bank')
mb_provider       text         -- 'bkash' | 'nagad' | 'rocket' | other
mb_phone          text
mb_number_type    text         -- 'personal' | 'agent' | 'merchant'

created_at        timestamptz NOT NULL DEFAULT now()
updated_at        timestamptz NOT NULL DEFAULT now()
```

Index: `(shop_id, is_active, display_order)`.
CHECK constraint: enforce that the right field-set is populated for each `method_type`.

### Order extensions
Either extend `orders` with proof columns or add a 1:1 child table. **Decision: extend `orders`** — proof is always at most one record per order and we read it together with the order.

```
ALTER TABLE orders ADD COLUMN advance_payment_method_id  uuid NULL REFERENCES shop_payment_methods(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN advance_payment_txn_ref    text NULL;
ALTER TABLE orders ADD COLUMN advance_payment_receipt    text NULL;  -- relative path under /uploads/
ALTER TABLE orders ADD COLUMN advance_payment_submitted_at timestamptz NULL;
```

`advance_payment_received` (already present) becomes seller-controlled confirmation.

### Editable-pre-confirmation rule
Buyer may edit delivery address, phone, note, and advance-payment fields **only while `orders.status = 'pending'` and `advance_payment_received = false`**. Service layer enforces this; do not trust the client.

---

## Backend Plan (handler / service / repo for each capability)

### B1. Migration `000016_payment_methods_and_order_proof`
- `up.sql`: create `shop_payment_methods`, alter `orders` with proof columns + index on `advance_payment_method_id`.
- `down.sql`: reverse, dropping FK first.
- Acceptance: `make migrate-up && make migrate-down && make migrate-up` succeeds clean.

### B2. Domain types
File: `backend/internal/domain/payment_method.go`
- `PaymentMethod` struct with all fields above + `MethodType` enum constants.
- `ErrInvalidPaymentMethod`, `ErrPaymentMethodNotFound`, plus validation helpers (`(p PaymentMethod) Validate() error` checks the right field set is populated).

Extend `backend/internal/domain/order.go`:
- Add `AdvancePaymentMethodID *string`, `AdvancePaymentTxnRef string`, `AdvancePaymentReceipt string`, `AdvancePaymentSubmittedAt *time.Time` to `Order`.
- Add `ErrOrderLocked` (returned when buyer tries to edit after seller confirmation) and `ErrAdvancePaymentRequired` (returned when buyer skips proof on a shop that requires it).

### B3. Repository layer
File: `backend/internal/repository/payment_method_repository.go` — interface only.
- `List(ctx, shopID) ([]PaymentMethod, error)`
- `ListPublic(ctx, shopID) ([]PaymentMethod, error)` — `is_active=true`, ordered.
- `Get(ctx, id) (*PaymentMethod, error)`
- `Create(ctx, *PaymentMethod) error`
- `Update(ctx, *PaymentMethod) error`
- `Delete(ctx, id) error`

File: `backend/internal/repository/postgres/payment_method_repository.go` — concrete pgx impl mirroring sibling repos.

Extend `OrderRepository`:
- `UpdateAdvancePaymentProof(ctx, orderID, methodID, txnRef, receipt) error`
- `UpdateBuyerEditableFields(ctx, orderID, addr, division, district, area, phone, note) error`
- `MarkAdvanceReceived(ctx, orderID, received bool) error`
- All existing order Get queries must SELECT the new columns.

### B4. Service layer
File: `backend/internal/service/payment_method_service.go`
- Owner-scoped CRUD: every method takes the authenticated `shopID` and verifies the `PaymentMethod.ShopID` matches.
- Validates per-type field requirements.

Extend `OrderService`:
- On checkout: when `DeliverySettings.AdvancePaymentRequired = true`, require `methodID + txnRef + receipt` in input; persist them and set `advance_payment_required = true` on the order. Otherwise ignore proof fields.
- `SubmitAdvancePaymentProof(ctx, lookupToken, orderID, methodID, txnRef, receipt)` — buyer-facing edit; rejects if order not `pending` or `advance_payment_received = true`.
- `UpdateBuyerEditableFields(...)` — same lock rule.
- `MarkAdvancePaymentReceived(ctx, sellerShopID, orderID, received)` — seller flips confirmation.

### B5. Handler layer
New package `backend/internal/handler/http/paymentmethod/`:
- `GET    /api/dashboard/payment-methods`
- `POST   /api/dashboard/payment-methods`
- `PATCH  /api/dashboard/payment-methods/{id}`
- `DELETE /api/dashboard/payment-methods/{id}`
- `GET    /api/storefront/{slug}/payment-methods` (public, for buyer checkout)

Extend `backend/internal/handler/http/order/`:
- Existing `POST /api/storefront/{slug}/orders` accepts new optional fields `payment_method_id`, `txn_ref`, plus a separate `POST /api/storefront/{slug}/orders/{id}/receipt` multipart upload for the file (or accept multipart on the create route — pick ONE pattern; recommend a separate upload route returning a path to include in the order create body).
- `PATCH /api/storefront/{slug}/orders/{id}` — buyer edit (gated by lookup token + status).
- `POST /api/dashboard/orders/{id}/advance-payment-received` — seller confirms.

Wire new handler in [router.go](backend/internal/handler/http/router.go) and `RouterDeps`; wire service+repo in `backend/internal/app/`.

### B6. Tests
- `payment_method_service_test.go` — validation, owner scoping, CRUD round-trips (sqlmock or testdb pattern matching siblings).
- Extend `order_service_test.go` — checkout requires proof when shop demands it; rejects edits after confirm; allows edits while pending.

---

## Frontend Plan

All pages must be mobile-first and use existing component idioms. Reuse `components/ui/` primitives.

### F1. Seller — Delivery Settings page
[frontend/src/app/dashboard/settings/delivery/page.tsx](frontend/src/app/dashboard/settings/delivery/page.tsx)
- The "advance payment required" toggle already wires to `AdvancePaymentRequired`. Below it, when enabled, render a **Payment Methods** section.
- Section: list configured methods as cards with edit/delete; "Add bank" / "Add mobile banking" buttons open a modal with the right fields.
- Inline validation, friendly error messages, Bangla copy alongside English where surrounding code does.
- Empty-state hint: "Buyers won't see anything until you add at least one method."

### F2. Buyer — Checkout
[frontend/src/app/s/\[slug\]/checkout/page.tsx](frontend/src/app/s/%5Bslug%5D/checkout/page.tsx)
- Fetch shop delivery settings + public payment methods when shop's `advance_payment_required` is true.
- Add a step **before** "Place Order":
  1. Read-only panel listing each accepted method (cards: bank details copyable, bkash number copyable with one-tap copy button).
  2. Form: choose which method was used (radio), txn id input, receipt upload (image/pdf, max ~5 MB, client-side preview).
  3. Confirmation checkbox: "I have paid the delivery fee."
- "Place Order" button is disabled until all three are present. Show clear inline errors.
- After submission, route to existing `order-confirmed` page; mention proof is pending seller verification.

### F3. Seller — Order detail
[frontend/src/app/dashboard/orders/\[id\]/](frontend/src/app/dashboard/orders/%5Bid%5D/)
- New "Advance Payment" panel showing: chosen method, txn ref, receipt thumbnail (click to enlarge / open).
- Toggle "Mark advance payment received" (calls `POST /advance-payment-received`).
- Confirm-order button blocked with tooltip "Mark advance payment received first" when shop requires advance and not yet received.

### F4. Buyer — Order tracking + edit
[frontend/src/app/order-lookup/](frontend/src/app/order-lookup/) and [frontend/src/app/s/\[slug\]/order-lookup/](frontend/src/app/s/%5Bslug%5D/order-lookup/)
- Show full status timeline (already partially present — verify all statuses render).
- While order status is `pending` and `advance_payment_received` is false: show **Edit** controls for delivery address/phone/note and the advance-payment proof. Hide once locked.
- Show explainer banner: "You can edit until the seller confirms your order."

---

## Execution Order (each step = one PR / commit)

1. **B1** migration + run locally → verify schema.
2. **B2** domain types (no behavior yet).
3. **B3** repository interfaces + postgres impls.
4. **B4** service layer + unit tests.
5. **B5** handlers + router/app wiring.
6. **F1** seller settings UI (uses B5 dashboard endpoints).
7. **F2** buyer checkout flow (uses B5 storefront endpoints).
8. **F3** seller order detail panel.
9. **F4** buyer tracking + pre-confirmation edit.
10. End-to-end smoke test in the browser (toggle on, configure two methods, place order with proof, seller confirms, buyer tries to edit before/after confirm).

---

## Progress Log

| # | Step | Status | Notes |
|---|------|--------|-------|
| B1 | Migration 000016 | ✅ done | `shop_payment_methods` table + 4 proof cols on `orders`; ON DELETE SET NULL |
| B2 | Domain types | ✅ done | `ShopPaymentMethod` (renamed to avoid collision with billing `PaymentMethod`); order extended with proof fields + `ErrOrderLocked`, `ErrAdvancePaymentRequired`, etc. |
| B3 | Repositories | ✅ done | `PaymentMethodRepository` + pg impl; OrderRepository gains `SubmitAdvanceProof`, `UpdateBuyerEditableFields`, `MarkAdvanceReceived(received bool)` |
| B4 | Services + tests | ✅ done | `PaymentMethodService` + new `OrderService` paths; tests updated, `go test ./...` green |
| B5 | Handlers + wiring | ✅ done | New `paymentmethod` HTTP package; order handler gains advance-proof / buyer-edit / receipt-upload; router + app DI wired |
| F1 | Seller settings UI | ✅ done | New `PaymentMethods` component embedded in delivery settings page when advance toggle is on |
| F2 | Buyer checkout UI | ✅ done | New `AdvancePaymentSection`: pick method, enter txn id, upload receipt, confirm — with copy-to-clipboard for account/phone |
| F3 | Seller order detail panel | ✅ done | Payment card now shows full proof + open-receipt link + Mark received / Undo toggle; banner when proof pending |
| F4 | Buyer tracking + edit | ✅ done | New `EditDeliveryDetails` and `EditAdvancePayment` cards on storefront order-lookup; gated on `pending && !advance_received` |
| QA | End-to-end smoke | ⬜ Not started | Run via `make up` once you're ready to click through |

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⚠️ blocked

---

## Open Questions / Decisions to Confirm
- Receipt upload: accept image + PDF? Max size? Suggest **5 MB**, types `image/jpeg image/png image/webp application/pdf`.
- Should buyers be allowed to switch payment-method-id after submitting (before seller confirms)? Spec says yes — "Delivery payment info" is editable pre-confirmation.
- When seller deletes a payment method that historic orders reference, keep `ON DELETE SET NULL` so orders remain readable.
- Do we need a buyer-facing audit/log of edits? Out of scope unless requested.
