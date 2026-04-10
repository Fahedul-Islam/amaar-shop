# Amaar Shop — API Contract

This is the canonical API reference for the Amaar Shop MVP. Every later sub-prompt consults this file when implementing handlers. If a feature requires a new endpoint, update this document first, then implement.

---

## Conventions

### Base URL

All API endpoints are prefixed with `/api` except health checks.

### Authentication

- **Access token:** Sent as `Authorization: Bearer <access_token>` header.
- **Refresh token:** Stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- Auth levels per endpoint:
  - **Public** — no token required.
  - **Seller** — valid access token required; user must own the shop being accessed.
  - **Admin** — valid access token required; user must have `is_admin = true`.

### JSON Envelope

All responses use a consistent envelope:

**Success:**
```json
{ "data": { ... } }
```

**Success (list with pagination):**
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 57,
    "total_pages": 3
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "not_found",
    "message": "Product not found"
  }
}
```

### Pagination

Paginated endpoints accept `page` (default 1) and `page_size` (default 20, max 100) as query parameters.

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `validation_error` | 400 | Request body or query param failed validation |
| `unauthorized` | 401 | Missing or invalid access token |
| `forbidden` | 403 | Authenticated but not allowed (not owner / not admin) |
| `not_found` | 404 | Resource does not exist (or shop is suspended for public endpoints) |
| `slug_taken` | 409 | Slug is already in use by another shop |
| `email_already_exists` | 409 | Email is already registered |
| `shop_already_exists` | 409 | User already owns a shop |
| `insufficient_stock` | 409 | One or more products lack sufficient stock for the order |
| `invalid_status_transition` | 422 | Order status change is not allowed |
| `checkout_disabled` | 422 | Shop has COD disabled and cannot accept orders |
| `too_many_images` | 422 | Product already has the maximum 5 images |
| `category_not_in_shop` | 422 | Category does not belong to the seller's shop |
| `rate_limited` | 429 | Too many requests — try again later |

### Suspended-Shop Rule

Every public `by-slug` endpoint returns `404` if the shop's `is_suspended` flag is `true`. This is enforced by a shop-loader helper, not per-handler logic.

### Image Uploads

- Max file size: 2 MB.
- Allowed types: JPEG, PNG, WebP.
- Uploaded via `multipart/form-data`.
- Server returns the URL of the stored file.

### Phone Normalization

Customer phone lookups normalize the input before comparing: strip spaces, handle leading `+88` / `0` prefix variations. Comparison uses constant-time logic to prevent timing attacks.

---

## Health

### `GET /health`

> Returns service liveness status. No auth required.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `GET /ready`

> Returns service readiness status including database connectivity. No auth required.

**Response `200`:**
```json
{ "status": "ready" }
```

**Response `503`:**
```json
{ "status": "not_ready", "reason": "database unreachable" }
```

---

## Auth (Sub-Prompt 4)

### `POST /api/auth/signup`

> Register a new seller account. Rate limited.

**Auth:** Public

**Request body:**
```json
{
  "email": "seller@example.com",
  "password": "securepassword"
}
```

| Field | Type | Validation |
|-------|------|------------|
| email | string | Required, valid email format |
| password | string | Required, min 8 characters |

**Response `201`:**
```json
{
  "data": {
    "access_token": "eyJhbG...",
    "user": {
      "id": "uuid",
      "email": "seller@example.com",
      "is_admin": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```
Refresh token is set as an httpOnly cookie.

**Errors:** `validation_error`, `email_already_exists`, `rate_limited`

---

### `POST /api/auth/login`

> Authenticate an existing user and receive tokens. Rate limited.

**Auth:** Public

**Request body:**
```json
{
  "email": "seller@example.com",
  "password": "securepassword"
}
```

**Response `200`:**
```json
{
  "data": {
    "access_token": "eyJhbG...",
    "user": {
      "id": "uuid",
      "email": "seller@example.com",
      "is_admin": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```
Refresh token is set as an httpOnly cookie.

**Errors:** `validation_error`, `unauthorized`, `rate_limited`

---

### `POST /api/auth/refresh`

> Exchange a valid refresh token cookie for a new access token.

**Auth:** Public (refresh token cookie required)

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "access_token": "eyJhbG..."
  }
}
```

**Errors:** `unauthorized`

---

### `POST /api/auth/logout`

> Clear the refresh token cookie.

**Auth:** Public (refresh token cookie required)

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "message": "logged out"
  }
}
```

---

### `GET /api/auth/me`

> Return the currently authenticated user's profile.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "seller@example.com",
    "is_admin": false,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`

---

## Shops (Sub-Prompt 5)

### `POST /api/shops`

> Create a new shop for the authenticated user. Each user can own only one shop. A default `shop_delivery_settings` row is created automatically.

**Auth:** Seller

**Request body:**
```json
{
  "name": "My Shop",
  "slug": "my-shop",
  "description": "Best shop in town",
  "contact_phone": "+8801712345678"
}
```

| Field | Type | Validation |
|-------|------|------------|
| name | string | Required |
| slug | string | Required, 3-40 chars, lowercase alphanumeric + hyphens |
| description | string | Optional |
| contact_phone | string | Optional |

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "slug": "my-shop",
    "name": "My Shop",
    "description": "Best shop in town",
    "logo_url": null,
    "banner_url": null,
    "contact_phone": "+8801712345678",
    "is_suspended": false,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `slug_taken`, `shop_already_exists`

---

### `GET /api/shops/me`

> Get the authenticated user's own shop.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "slug": "my-shop",
    "name": "My Shop",
    "description": "Best shop in town",
    "logo_url": "/uploads/logo-abc.png",
    "banner_url": "/uploads/banner-xyz.png",
    "contact_phone": "+8801712345678",
    "is_suspended": false,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `PATCH /api/shops/me`

> Update the authenticated user's shop branding fields.

**Auth:** Seller

**Request body (all fields optional):**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "contact_phone": "+8801700000000"
}
```

**Response `200`:** Same shape as `GET /api/shops/me`.

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `POST /api/shops/me/logo`

> Upload or replace the shop logo image.

**Auth:** Seller

**Content-Type:** `multipart/form-data`

| Field | Type | Validation |
|-------|------|------------|
| file | file | Required, JPEG/PNG/WebP, max 2 MB |

**Response `200`:**
```json
{
  "data": {
    "logo_url": "/uploads/logo-abc.png"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `POST /api/shops/me/banner`

> Upload or replace the shop banner image.

**Auth:** Seller

**Content-Type:** `multipart/form-data`

| Field | Type | Validation |
|-------|------|------------|
| file | file | Required, JPEG/PNG/WebP, max 2 MB |

**Response `200`:**
```json
{
  "data": {
    "banner_url": "/uploads/banner-xyz.png"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `GET /api/shops/check-slug`

> Check whether a slug is available for use.

**Auth:** Seller

**Query params:**

| Param | Type | Validation |
|-------|------|------------|
| slug | string | Required, 3-40 chars, lowercase alphanumeric + hyphens |

**Response `200`:**
```json
{
  "data": {
    "available": true
  }
}
```

**Errors:** `validation_error`, `unauthorized`

---

### `GET /api/shops/me/delivery-settings`

> Get delivery and COD settings for the authenticated user's shop.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": {
    "shop_id": "uuid",
    "cod_enabled": true,
    "delivery_charge": "60.00",
    "free_delivery_threshold": "500.00",
    "advance_payment_required": false,
    "advance_payment_instructions": "",
    "delivery_areas": ["Dhaka", "Chittagong", "Sylhet"],
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `PUT /api/shops/me/delivery-settings`

> Replace delivery settings for the authenticated user's shop.

**Auth:** Seller

**Request body:**
```json
{
  "cod_enabled": true,
  "delivery_charge": "60.00",
  "free_delivery_threshold": "500.00",
  "advance_payment_required": false,
  "advance_payment_instructions": "Pay via bKash to 01712345678",
  "delivery_areas": ["Dhaka", "Chittagong"]
}
```

| Field | Type | Validation |
|-------|------|------------|
| cod_enabled | boolean | Required |
| delivery_charge | string (decimal) | Required, >= 0 |
| free_delivery_threshold | string (decimal) or null | Optional, must be > delivery_charge when set |
| advance_payment_required | boolean | Required |
| advance_payment_instructions | string | Optional |
| delivery_areas | string[] | Required when cod_enabled is true, non-empty |

**Response `200`:** Same shape as `GET /api/shops/me/delivery-settings`.

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `GET /api/shops/by-slug/{slug}`

> Get a shop's public profile by its slug. Returns 404 if shop is suspended.

**Auth:** Public

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "slug": "my-shop",
    "name": "My Shop",
    "description": "Best shop in town",
    "logo_url": "/uploads/logo-abc.png",
    "banner_url": "/uploads/banner-xyz.png",
    "contact_phone": "+8801712345678"
  }
}
```

Note: `owner_user_id`, `is_suspended`, and admin-only fields are not exposed.

**Errors:** `not_found`

---

### `GET /api/shops/by-slug/{slug}/delivery-settings`

> Get a shop's delivery settings publicly (needed by storefront checkout). Returns 404 if shop is suspended.

**Auth:** Public

**Response `200`:**
```json
{
  "data": {
    "cod_enabled": true,
    "delivery_charge": "60.00",
    "free_delivery_threshold": "500.00",
    "advance_payment_required": false,
    "advance_payment_instructions": "",
    "delivery_areas": ["Dhaka", "Chittagong"]
  }
}
```

**Errors:** `not_found`

---

## Products & Categories (Sub-Prompt 6)

### `GET /api/shops/me/categories`

> List all categories for the seller's shop.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "shop_id": "uuid",
      "name": "Electronics",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Errors:** `unauthorized`, `not_found`

---

### `POST /api/shops/me/categories`

> Create a new category in the seller's shop.

**Auth:** Seller

**Request body:**
```json
{
  "name": "Electronics"
}
```

| Field | Type | Validation |
|-------|------|------------|
| name | string | Required, unique per shop (case-insensitive) |

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "name": "Electronics",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `PATCH /api/shops/me/categories/{id}`

> Rename a category in the seller's shop.

**Auth:** Seller

**Request body:**
```json
{
  "name": "Updated Name"
}
```

**Response `200`:** Same shape as single category.

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `DELETE /api/shops/me/categories/{id}`

> Delete a category. Products in this category will have their `category_id` set to null.

**Auth:** Seller

**Response `204`:** No content.

**Errors:** `unauthorized`, `not_found`

---

### `GET /api/shops/me/products`

> List products in the seller's shop with optional filters and pagination.

**Auth:** Seller

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| q | string | Text search on product name (uses pg_trgm) |
| category_id | uuid | Filter by category |
| is_active | boolean | Filter by active status |
| is_archived | boolean | Filter by archived status (default: false) |
| page | integer | Page number (default: 1) |
| page_size | integer | Items per page (default: 20, max: 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "shop_id": "uuid",
      "category_id": "uuid",
      "name": "T-Shirt",
      "description": "Cotton t-shirt",
      "price_bdt": "450.00",
      "stock": 25,
      "is_active": true,
      "is_archived": false,
      "images": [
        { "id": "uuid", "url": "/uploads/img1.png", "sort_order": 0 }
      ],
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `POST /api/shops/me/products`

> Create a new product in the seller's shop.

**Auth:** Seller

**Request body:**
```json
{
  "name": "T-Shirt",
  "description": "Cotton t-shirt",
  "price_bdt": "450.00",
  "stock": 25,
  "category_id": "uuid-or-null",
  "is_active": true
}
```

| Field | Type | Validation |
|-------|------|------------|
| name | string | Required |
| description | string | Optional |
| price_bdt | string (decimal) | Required, > 0 |
| stock | integer | Required, >= 0 |
| category_id | uuid or null | Optional, must belong to same shop |
| is_active | boolean | Optional, default true |

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "category_id": "uuid",
    "name": "T-Shirt",
    "description": "Cotton t-shirt",
    "price_bdt": "450.00",
    "stock": 25,
    "is_active": true,
    "is_archived": false,
    "images": [],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`, `category_not_in_shop`

---

### `GET /api/shops/me/products/{id}`

> Get a single product by ID from the seller's shop.

**Auth:** Seller

**Response `200`:** Same shape as single product in list (with images array).

**Errors:** `unauthorized`, `not_found`

---

### `PATCH /api/shops/me/products/{id}`

> Update a product's fields. Only provided fields are updated.

**Auth:** Seller

**Request body (all fields optional):**
```json
{
  "name": "Updated T-Shirt",
  "description": "Premium cotton",
  "price_bdt": "550.00",
  "stock": 30,
  "category_id": "uuid-or-null",
  "is_active": false
}
```

**Response `200`:** Same shape as single product.

**Errors:** `validation_error`, `unauthorized`, `not_found`, `category_not_in_shop`

---

### `DELETE /api/shops/me/products/{id}`

> Permanently delete a product. Prefer archiving instead for products with order history.

**Auth:** Seller

**Response `204`:** No content.

**Errors:** `unauthorized`, `not_found`

---

### `POST /api/shops/me/products/{id}/archive`

> Archive a product, removing it from public listings while preserving order history.

**Auth:** Seller

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "is_archived": true
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `POST /api/shops/me/products/{id}/images`

> Upload an image for a product. Max 5 images per product.

**Auth:** Seller

**Content-Type:** `multipart/form-data`

| Field | Type | Validation |
|-------|------|------------|
| file | file | Required, JPEG/PNG/WebP, max 2 MB |

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "url": "/uploads/product-img-abc.png",
    "sort_order": 0,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`, `too_many_images`

---

### `DELETE /api/shops/me/products/{id}/images/{imageID}`

> Delete a specific image from a product.

**Auth:** Seller

**Response `204`:** No content.

**Errors:** `unauthorized`, `not_found`

---

### `PATCH /api/shops/me/products/{id}/images/reorder`

> Reorder images for a product by providing the image IDs in the desired order.

**Auth:** Seller

**Request body:**
```json
{
  "image_ids": ["uuid-3", "uuid-1", "uuid-2"]
}
```

| Field | Type | Validation |
|-------|------|------------|
| image_ids | uuid[] | Required, must include all image IDs for this product |

**Response `200`:**
```json
{
  "data": [
    { "id": "uuid-3", "url": "/uploads/img3.png", "sort_order": 0 },
    { "id": "uuid-1", "url": "/uploads/img1.png", "sort_order": 1 },
    { "id": "uuid-2", "url": "/uploads/img2.png", "sort_order": 2 }
  ]
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `GET /api/shops/by-slug/{slug}/products`

> List active, non-archived products from a public shop. Returns 404 if shop is suspended.

**Auth:** Public

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| q | string | Text search on product name |
| category_id | uuid | Filter by category |
| page | integer | Page number (default: 1) |
| page_size | integer | Items per page (default: 20, max: 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "T-Shirt",
      "description": "Cotton t-shirt",
      "price_bdt": "450.00",
      "stock": 25,
      "category_id": "uuid",
      "images": [
        { "id": "uuid", "url": "/uploads/img1.png", "sort_order": 0 }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 12,
    "total_pages": 1
  }
}
```

Only `is_active = true` and `is_archived = false` products are returned.

**Errors:** `not_found`

---

### `GET /api/shops/by-slug/{slug}/products/{id}`

> Get a single public product by ID. Returns 404 if shop is suspended or product is inactive/archived.

**Auth:** Public

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "name": "T-Shirt",
    "description": "Cotton t-shirt",
    "price_bdt": "450.00",
    "stock": 25,
    "category_id": "uuid",
    "images": [
      { "id": "uuid", "url": "/uploads/img1.png", "sort_order": 0 }
    ]
  }
}
```

**Errors:** `not_found`

---

### `GET /api/shops/by-slug/{slug}/categories`

> List all categories for a public shop. Returns 404 if shop is suspended.

**Auth:** Public

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Electronics"
    }
  ]
}
```

**Errors:** `not_found`

---

## Orders (Sub-Prompt 7)

### `POST /api/shops/by-slug/{slug}/orders`

> Place a new order on a public shop. Server recalculates all prices — never trusts client totals. Decrements stock in the same transaction. Returns 404 if shop is suspended.

**Auth:** Public

**Request body:**
```json
{
  "customer_name": "Rahim Ahmed",
  "customer_phone": "01712345678",
  "delivery_address": "House 12, Road 5, Dhanmondi",
  "delivery_area": "Dhaka",
  "note": "Please call before delivery",
  "items": [
    { "product_id": "uuid", "quantity": 2 },
    { "product_id": "uuid", "quantity": 1 }
  ]
}
```

| Field | Type | Validation |
|-------|------|------------|
| customer_name | string | Required |
| customer_phone | string | Required, valid BD phone format |
| delivery_address | string | Required |
| delivery_area | string | Required, must be in shop's delivery_areas |
| note | string | Optional |
| items | array | Required, non-empty |
| items[].product_id | uuid | Required, must be active in this shop |
| items[].quantity | integer | Required, > 0 |

**Response `201`:**
```json
{
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "customer_name": "Rahim Ahmed",
    "customer_phone": "01712345678",
    "delivery_address": "House 12, Road 5, Dhanmondi",
    "delivery_area": "Dhaka",
    "note": "Please call before delivery",
    "subtotal_bdt": "1350.00",
    "delivery_charge_bdt": "60.00",
    "total_bdt": "1410.00",
    "status": "pending",
    "advance_payment_required": false,
    "advance_payment_received": false,
    "items": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "product_name_snapshot": "T-Shirt",
        "unit_price_snapshot_bdt": "450.00",
        "quantity": 2,
        "line_total_bdt": "900.00"
      },
      {
        "id": "uuid",
        "product_id": "uuid",
        "product_name_snapshot": "Cap",
        "unit_price_snapshot_bdt": "450.00",
        "quantity": 1,
        "line_total_bdt": "450.00"
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `not_found`, `insufficient_stock`, `checkout_disabled`

---

### `GET /api/orders/{id}/lookup`

> Look up an order by ID and customer phone. Used by customers to check their order status without authentication.

**Auth:** Public

**Query params:**

| Param | Type | Validation |
|-------|------|------------|
| phone | string | Required, matched using constant-time comparison after normalization |

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "customer_name": "Rahim Ahmed",
    "subtotal_bdt": "1350.00",
    "delivery_charge_bdt": "60.00",
    "total_bdt": "1410.00",
    "advance_payment_required": false,
    "advance_payment_received": false,
    "items": [
      {
        "product_name_snapshot": "T-Shirt",
        "unit_price_snapshot_bdt": "450.00",
        "quantity": 2,
        "line_total_bdt": "900.00"
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `not_found`

---

### `GET /api/shops/me/orders`

> List orders for the seller's shop with filters and pagination.

**Auth:** Seller

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by order status |
| from | string (ISO date) | Orders created on or after this date |
| to | string (ISO date) | Orders created on or before this date |
| q | string | Search by customer phone |
| page | integer | Page number (default: 1) |
| page_size | integer | Items per page (default: 20, max: 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "customer_name": "Rahim Ahmed",
      "customer_phone": "01712345678",
      "delivery_area": "Dhaka",
      "subtotal_bdt": "1350.00",
      "delivery_charge_bdt": "60.00",
      "total_bdt": "1410.00",
      "status": "pending",
      "advance_payment_required": false,
      "advance_payment_received": false,
      "items_count": 2,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 57,
    "total_pages": 3
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `GET /api/shops/me/orders/{id}`

> Get full details of a single order including items.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "customer_name": "Rahim Ahmed",
    "customer_phone": "01712345678",
    "delivery_address": "House 12, Road 5, Dhanmondi",
    "delivery_area": "Dhaka",
    "note": "Please call before delivery",
    "subtotal_bdt": "1350.00",
    "delivery_charge_bdt": "60.00",
    "total_bdt": "1410.00",
    "status": "pending",
    "advance_payment_required": false,
    "advance_payment_received": false,
    "cancelled_reason": null,
    "items": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "product_name_snapshot": "T-Shirt",
        "unit_price_snapshot_bdt": "450.00",
        "quantity": 2,
        "line_total_bdt": "900.00"
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `PATCH /api/shops/me/orders/{id}/status`

> Update an order's status. Enforces valid transitions: pending -> confirmed -> shipped -> delivered, any non-delivered -> cancelled. Cancelling a non-delivered order restores stock in the same transaction.

**Auth:** Seller

**Request body:**
```json
{
  "status": "confirmed",
  "cancelled_reason": "Customer requested cancellation"
}
```

| Field | Type | Validation |
|-------|------|------------|
| status | string | Required, must be a valid next status |
| cancelled_reason | string | Required when status is "cancelled" |

**Valid status transitions:**
```
pending     -> confirmed
confirmed   -> shipped
shipped     -> delivered
pending     -> cancelled
confirmed   -> cancelled
shipped     -> cancelled
```

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`, `invalid_status_transition`

---

### `POST /api/shops/me/orders/{id}/mark-advance-received`

> Mark that advance payment has been received for an order.

**Auth:** Seller

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "advance_payment_received": true,
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

## Analytics (Sub-Prompt 8)

### `GET /api/shops/me/stats/today`

> Get today's order and revenue statistics for the seller's shop.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": {
    "total_orders": 12,
    "pending_orders": 3,
    "revenue_bdt": "15400.00",
    "date": "2025-06-15"
  }
}
```

**Errors:** `unauthorized`, `not_found`

---

### `GET /api/shops/me/stats/range`

> Get daily order and revenue statistics for a date range (for charts).

**Auth:** Seller

**Query params:**

| Param | Type | Validation |
|-------|------|------------|
| from | string (ISO date) | Required |
| to | string (ISO date) | Required, max 90-day range |

**Response `200`:**
```json
{
  "data": [
    {
      "date": "2025-06-01",
      "orders": 5,
      "revenue_bdt": "6800.00"
    },
    {
      "date": "2025-06-02",
      "orders": 8,
      "revenue_bdt": "10200.00"
    }
  ]
}
```

**Errors:** `validation_error`, `unauthorized`, `not_found`

---

### `GET /api/shops/me/stats/top-products`

> Get the top-selling products for the seller's shop this month.

**Auth:** Seller

**Response `200`:**
```json
{
  "data": [
    {
      "product_id": "uuid",
      "product_name": "T-Shirt",
      "total_quantity": 45,
      "total_revenue_bdt": "20250.00"
    }
  ]
}
```

**Errors:** `unauthorized`, `not_found`

---

## Facebook / QR (Sub-Prompt 9)

### `GET /api/shops/me/qr`

> Generate and return a PNG QR code image containing the shop's public storefront URL. Result is cached per shop.

**Auth:** Seller

**Response `200`:**
- **Content-Type:** `image/png`
- Body: PNG binary data

**Errors:** `unauthorized`, `not_found`

---

## Admin (Sub-Prompt 10)

### `GET /api/admin/shops`

> List all shops on the platform with pagination.

**Auth:** Admin

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| page | integer | Page number (default: 1) |
| page_size | integer | Items per page (default: 20, max: 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "owner_user_id": "uuid",
      "owner_email": "seller@example.com",
      "slug": "my-shop",
      "name": "My Shop",
      "is_suspended": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 15,
    "total_pages": 1
  }
}
```

**Errors:** `unauthorized`, `forbidden`

---

### `GET /api/admin/shops/{id}`

> Get detailed information about a specific shop (admin view).

**Auth:** Admin

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "owner_email": "seller@example.com",
    "slug": "my-shop",
    "name": "My Shop",
    "description": "Best shop",
    "logo_url": "/uploads/logo.png",
    "banner_url": "/uploads/banner.png",
    "contact_phone": "+8801712345678",
    "is_suspended": false,
    "total_products": 42,
    "total_orders": 120,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `forbidden`, `not_found`

---

### `POST /api/admin/shops/{id}/suspend`

> Suspend a shop. All public by-slug endpoints will return 404 immediately.

**Auth:** Admin

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "is_suspended": true,
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `forbidden`, `not_found`

---

### `POST /api/admin/shops/{id}/unsuspend`

> Unsuspend a shop, restoring public access.

**Auth:** Admin

**Request body:** None

**Response `200`:**
```json
{
  "data": {
    "id": "uuid",
    "is_suspended": false,
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

**Errors:** `unauthorized`, `forbidden`, `not_found`

---

### `GET /api/admin/stats`

> Get platform-wide statistics.

**Auth:** Admin

**Response `200`:**
```json
{
  "data": {
    "total_shops": 15,
    "total_users": 18,
    "total_orders": 340,
    "total_revenue_bdt": "523400.00",
    "suspended_shops": 1
  }
}
```

**Errors:** `unauthorized`, `forbidden`
