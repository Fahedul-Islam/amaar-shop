# To-implement APIs

APIs the new design surface needs that the backend does not yet expose. Everything in the current design that is *not* on this list is wired through an existing endpoint — see `frontend-next/src/lib/*.ts` for the mapping.

The frontend currently fakes these (empty states, defaults) or omits them until the backend ships them.

## Social / discovery

### Shop follow / unfollow
- `POST /api/shops/by-slug/:slug/follow` — auth required (buyer). Creates a follow edge.
- `DELETE /api/shops/by-slug/:slug/follow` — auth required. Removes it.
- `GET /api/shops/by-slug/:slug/follow` — auth required. Returns `{ following: bool, follower_count: int }`.
- Used by: storefront header "Follow" button (design shows count next to the shop hero).

### Shop verified flag
- Needs a field on `PublicShop`: `is_verified bool`. Currently hard-coded as `true` in the storefront UI ("Verified" badge).
- No new endpoint, just a schema/migration + DTO addition to the existing shop endpoints.

### Shop metrics (hero stats)
- Extend `GET /api/shops/by-slug/:slug` response with:
  - `total_sold int`
  - `follower_count int`
  - `review_count int`, `rating_avg decimal(2,1)`
  - `since_year int` (derive from `created_at` year, OK to compute server-side).
- Used by: storefront hero ("4.9 ★ · 312 reviews · 1,840 sold · 3,200 followers · since 2019").

### Wishlist / favourites
- `POST /api/wishlist/:product_id` — auth required.
- `DELETE /api/wishlist/:product_id`.
- `GET /api/wishlist` — list.
- Used by: heart icon on product cards (design hints at it; currently omitted in Next port).

### Product reviews
- `GET /api/shops/by-slug/:slug/products/:product_id/reviews` — list, paginated.
- `POST /api/shops/by-slug/:slug/products/:product_id/reviews` — auth or order-gated (see below). Body: `{ rating int 1-5, body string }`.
- `GET /api/shops/by-slug/:slug/reviews` — shop-level aggregate.
- Used by: storefront product detail + shop hero rating.
- Server must enforce one review per `(user_id, product_id)` and ideally restrict writes to users with a delivered order for that product.

## Order placement & tracking

### Order tracking timeline
- Design shows 4-step tracker (Placed → Confirmed → Shipped → Delivered) with timestamps per step.
- Existing `GET /api/shops/by-slug/:slug/orders/:order_id/lookup` returns current status only.
- Option A (preferred): extend the existing response with a `status_history` array:
  ```json
  [{ "status": "confirmed", "at": "2026-04-24T12:30:00Z" }]
  ```
- Option B: new `GET /api/shops/by-slug/:slug/orders/:order_id/timeline`.
- Used by: storefront `/s/:slug/order-lookup` tracker view — the design for it is present in the brief but the Next version only shows current status for now.

### Short / human-friendly order reference
- Design references orders as `#AS-1048`. Current API uses UUIDs.
- Options:
  - Add a `reference` column populated on create (`AS-` + monotonically increasing per shop).
  - Or return it alongside the existing `id`: `{ id: uuid, reference: "AS-1048" }`.
- Used by: dashboard orders list, order detail, confirmation, lookup — everywhere an order id is shown.

### Marketplace order by reference
- `POST /api/marketplace/orders/lookup` currently takes `{ phone }`. Design lookup form on `/order-lookup` wants `{ reference, phone }` for pinpointing a single order.
- Add optional `reference` to the existing request.

## Seller dashboard

### Dashboard deltas (up/down vs previous period)
- `GET /api/shops/me/stats/today` currently returns raw counters. Design shows `↑ 12% vs last week` on each card.
- Extend with `_delta_pct` / `_delta_dir` fields, or add `GET /api/shops/me/stats/summary?window=7d` that returns current+previous.

### Shop visitors / conversion
- Design dashboard shows "Visitors · 7d" and "Conversion" stats.
- Requires page-view tracking on storefront + a new endpoint:
  - `GET /api/shops/me/stats/visitors?window=7d` → `{ visitors, previous, sessions }`.
  - `GET /api/shops/me/stats/conversion?window=7d` → `{ rate, previous }`.

### CSV export of products
- Design has an "Export CSV" button on the products list.
- `GET /api/shops/me/products/export.csv` — returns `text/csv`, respects the same filters as the list endpoint.

### QR code for shop URL
- Design has "Download QR code" on the Facebook-connect screen.
- `GET /api/shops/me/qr.png?size=512` — returns a PNG of the shop URL QR. Can render client-side instead if preferred, but server-side is easier to share/print.

### Payment method config (per shop)
- Design Settings allows toggling bKash / Nagad / Rocket individually.
- Current `delivery_settings` only has `cod_enabled` + advance text.
- Add: `payment_methods string[]` (values like `cod`, `bkash`, `nagad`, `rocket`) to delivery settings.

## Marketplace

### Popular search terms / suggestions
- Hero shows "Popular: sarees · home decor · handicrafts · snacks".
- `GET /api/marketplace/popular-searches` → `string[]` (top N search queries by volume over last 7d). Falls back to categories today.

### Cross-shop checkout
- Design cart drawer shows "Each shop gets its own order" and a "Checkout all shops" button that would split into separate orders per shop.
- Current implementation uses one cart per shop (`useCart(slug)`), matching the existing API. A cross-shop cart would need:
  - A way to bulk-place orders: `POST /api/marketplace/orders` body `{ orders: PlaceOrderInput[] }` atomic multi-shop placement, or
  - Client-side loop over single-shop endpoints (fine for MVP — no backend change needed if we accept non-atomic).
- No backend change is blocking for now; the Next port keeps the per-shop checkout the existing API supports.

## Pricing & delivery (server-side enforcement gaps)

These fields are stored on the product but the order placement service does **not** apply them today, so the UI shows one price and the customer is charged the raw price.

### Apply product discount at checkout
- Schema already has `products.discount_type` (`percentage` | `flat`) and `products.discount_value`.
- Frontend (storefront grid + product detail) shows the discounted effective price.
- `internal/service/order_service.go::PlaceOrder` snapshots `p.PriceBDT` directly — discount is ignored.
- Action: compute `effective = applyDiscount(price, type, value)` in the service and snapshot the discounted unit price into `OrderItem.UnitPriceSnapshotBDT`.

### Apply per-product delivery charge
- Schema already has `products.delivery_charge_dhaka` and `products.delivery_charge_outside`.
- Frontend product detail surfaces them as informational.
- `PlaceOrder` only uses the shop-level `delivery_settings.delivery_charge` — per-product overrides are ignored.
- Action: when computing delivery charge, take the maximum (or sum, depending on policy) of the per-product charges for the chosen zone, falling back to the shop default. Confirm zone → field mapping (Dhaka vs Outside).

## Nice-to-have

- **Onboarding first-product wizard**: design's 3-step onboarding creates the shop + a first product + delivery zones in one flow. Currently the Next setup wizard only creates the shop; the user is dropped into the dashboard to add a product separately. Not blocking — no new endpoint needed.
- **Advance payment received event**: already exists (`POST /api/shops/me/orders/:id/advance-received`) — wired.
- **Buyer cancel order**: backend `POST /api/shops/by-slug/{slug}/orders/{id}/cancel` is wired in the storefront order-lookup page (cancel button shows for `pending`/`confirmed` orders).
- **Product archive**: `POST /api/shops/me/products/{id}/archive` is wired in the dashboard product edit page (Archive button).
- **Popular products**: `GET /api/shops/by-slug/{slug}/popular-products` is wired into the storefront landing as a "Popular this week" section.
- **Image reorder**: backend `PATCH /api/shops/me/products/{id}/images/reorder` exists and a client function is in `productApi.ts`, but the dashboard product form doesn't expose drag-reorder yet. Up/down buttons or a DnD library would close the gap.
- **Order list phone filter**: backend `listOrders?phone=…` works but the dashboard orders page only filters by status. Adding a phone search box would surface this.
- **Unread order indicator / notifications**: design has a bell icon in the marketplace header. Would need `GET /api/shops/me/notifications` + `POST /.../mark-read`.
