# Amaar Shop Backend Manual API Checklist

This file covers the HTTP routes currently mounted by the backend router. Use it as a manual smoke-test guide after starting the backend.

Only routes that are actually registered in the Go router are listed here.

## Shared Rules

- All `/api/*` success responses are wrapped as `{ "data": ... }`.
- Error responses follow `{ "error": { "code": "...", "message": "..." } }`.
- Seller routes require `Authorization: Bearer <access_token>`.
- `POST /api/auth/refresh` and `POST /api/auth/logout` use the `refresh_token` cookie.
- Upload routes use `multipart/form-data` with a `file` field.
- Health routes are plain JSON and do not use the `data` envelope.
- Uploaded files are served publicly from `/uploads/<filename>`.

## Health

### `GET /health`

Purpose: Check whether the backend process is alive.

Request body: None.

Expected output:

```json
{ "status": "ok" }
```

### `GET /ready`

Purpose: Check whether the backend can reach the database.

Request body: None.

Expected output:

Success:

```json
{ "status": "ready" }
```

Failure:

```json
{ "status": "not_ready", "reason": "database unreachable" }
```

## Auth

### `POST /api/auth/signup`

Purpose: Create a new seller account and return access and refresh tokens.

Request body:

```json
{
  "email": "seller@example.com",
  "password": "securepassword"
}
```

Expected output:

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

Notes: Sets the `refresh_token` cookie.

### `POST /api/auth/login`

Purpose: Authenticate an existing user and return tokens.

Request body:

```json
{
  "email": "seller@example.com",
  "password": "securepassword"
}
```

Expected output:

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

Notes: Sets the `refresh_token` cookie.

### `POST /api/auth/refresh`

Purpose: Exchange a valid refresh cookie for a new access token.

Request body: None. Requires `refresh_token` cookie.

Expected output:

```json
{
  "data": {
    "access_token": "eyJhbG..."
  }
}
```

### `POST /api/auth/logout`

Purpose: Clear the refresh token cookie.

Request body: None. Requires `refresh_token` cookie.

Expected output:

```json
{
  "data": {
    "message": "logged out"
  }
}
```

### `GET /api/auth/me`

Purpose: Return the currently authenticated user.

Request body: None.

Expected output:

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

## Shops

### `POST /api/shops`

Purpose: Create the authenticated user's shop.

Request body:

```json
{
  "name": "My Shop",
  "slug": "my-shop",
  "description": "Best shop in town",
  "contact_phone": "+8801712345678"
}
```

Expected output:

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

### `GET /api/shops/me`

Purpose: Fetch the authenticated user's shop.

Request body: None.

Expected output:

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

### `PATCH /api/shops/me`

Purpose: Update the authenticated user's shop details.

Request body:

```json
{
  "name": "Updated Shop Name",
  "description": "Updated description",
  "contact_phone": "+8801700000000"
}
```

Expected output: Same shape as `GET /api/shops/me`.

### `POST /api/shops/me/logo`

Purpose: Upload or replace the shop logo image.

Request body: `multipart/form-data` with one field:

```text
file = <image file>
```

Expected output:

```json
{
  "data": {
    "url": "/uploads/logo-abc123.png"
  }
}
```

### `POST /api/shops/me/banner`

Purpose: Upload or replace the shop banner image.

Request body: `multipart/form-data` with one field:

```text
file = <image file>
```

Expected output:

```json
{
  "data": {
    "url": "/uploads/banner-abc123.png"
  }
}
```

### `GET /api/shops/check-slug?slug=my-shop`

Purpose: Check whether a shop slug is available.

Request body: None. Query parameter: `slug`.

Expected output:

```json
{
  "data": {
    "available": true
  }
}
```

### `GET /api/shops/me/delivery-settings`

Purpose: Fetch the authenticated user's delivery settings.

Request body: None.

Expected output:

```json
{
  "data": {
    "shop_id": "uuid",
    "cod_enabled": true,
    "delivery_charge": "60.00",
    "free_delivery_threshold": "500.00",
    "advance_payment_required": false,
    "advance_payment_instructions": "",
    "delivery_zones": [
      { "id": "uuid", "division": "Dhaka", "delivery_charge": "60.00" },
      { "id": "uuid", "division": "Chattogram", "delivery_charge": "80.00" }
    ],
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

### `PUT /api/shops/me/delivery-settings`

Purpose: Replace the authenticated user's delivery settings.

Request body:

```json
{
  "cod_enabled": true,
  "delivery_charge": "60.00",
  "free_delivery_threshold": "500.00",
  "advance_payment_required": false,
  "advance_payment_instructions": "Pay via bKash to 01712345678",
  "delivery_zones": [
    { "division": "Dhaka", "delivery_charge": "60.00" },
    { "division": "Chattogram", "delivery_charge": "80.00" }
  ]
}
```

Expected output: Same shape as `GET /api/shops/me/delivery-settings`.

### `GET /api/shops/by-slug/{slug}`

Purpose: Fetch a shop's public profile by slug.

Request body: None. Path parameter: `slug`.

Expected output:

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

### `GET /api/shops/by-slug/{slug}/delivery-settings`

Purpose: Fetch a shop's public delivery settings by slug.

Request body: None. Path parameter: `slug`.

Expected output:

```json
{
  "data": {
    "cod_enabled": true,
    "delivery_charge": "60.00",
    "free_delivery_threshold": "500.00",
    "advance_payment_required": false,
    "advance_payment_instructions": "",
    "delivery_zones": [
      { "id": "uuid", "division": "Dhaka", "delivery_charge": "60.00" },
      { "id": "uuid", "division": "Chattogram", "delivery_charge": "80.00" }
    ]
  }
}
```

## Categories

### `GET /api/shops/me/categories`

Purpose: List the authenticated seller's categories.

Request body: None.

Expected output:

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

### `POST /api/shops/me/categories`

Purpose: Create a category for the authenticated seller's shop.

Request body:

```json
{
  "name": "Electronics"
}
```

Expected output:

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

### `PATCH /api/shops/me/categories/{id}`

Purpose: Rename an existing category.

Request body:

```json
{
  "name": "Updated Name"
}
```

Expected output:

```json
{
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "name": "Updated Name",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

### `DELETE /api/shops/me/categories/{id}`

Purpose: Delete a category from the seller's shop.

Request body: None.

Expected output: No content (`204`).

### `GET /api/shops/by-slug/{slug}/categories`

Purpose: List public categories for a shop.

Request body: None.

Expected output:

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

## Products

### `GET /api/shops/me/products`

Purpose: List the authenticated seller's products with optional filters.

Request body: None.

Query params: `q`, `category_id`, `is_active`, `is_archived`, `page`, `page_size`.

Expected output:

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
        {
          "id": "uuid",
          "product_id": "uuid",
          "url": "/uploads/img1.png",
          "sort_order": 0,
          "created_at": "2025-01-01T00:00:00Z"
        }
      ],
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### `POST /api/shops/me/products`

Purpose: Create a product in the authenticated seller's shop.

Request body:

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

Expected output:

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

### `GET /api/shops/me/products/{id}`

Purpose: Fetch one product from the authenticated seller's shop.

Request body: None.

Expected output: Same shape as `POST /api/shops/me/products`, with the full product data and images.

### `PATCH /api/shops/me/products/{id}`

Purpose: Update product fields. Omitted fields remain unchanged; `category_id: null` clears the category.

Request body:

```json
{
  "name": "Updated T-Shirt",
  "description": "Premium cotton",
  "price_bdt": "550.00",
  "stock": 30,
  "category_id": null,
  "is_active": false
}
```

Expected output: Same shape as `GET /api/shops/me/products/{id}`.

### `DELETE /api/shops/me/products/{id}`

Purpose: Permanently delete a product.

Request body: None.

Expected output: No content (`204`).

### `POST /api/shops/me/products/{id}/archive`

Purpose: Archive a product instead of deleting it.

Request body: None.

Expected output:

```json
{
  "data": {
    "id": "uuid",
    "is_archived": true
  }
}
```

### `POST /api/shops/me/products/{id}/images`

Purpose: Upload a product image.

Request body: `multipart/form-data` with a `file` field.

Expected output:

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

### `PATCH /api/shops/me/products/{id}/images/reorder`

Purpose: Reorder the images attached to a product.

Request body:

```json
{
  "image_ids": ["uuid-3", "uuid-1", "uuid-2"]
}
```

Expected output:

```json
{
  "data": [
    {
      "id": "uuid-3",
      "product_id": "uuid",
      "url": "/uploads/img3.png",
      "sort_order": 0,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid-1",
      "product_id": "uuid",
      "url": "/uploads/img1.png",
      "sort_order": 1,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### `DELETE /api/shops/me/products/{id}/images/{imageID}`

Purpose: Delete one image from a product.

Request body: None.

Expected output: No content (`204`).

### `GET /api/shops/by-slug/{slug}/products`

Purpose: List public products for a shop.

Request body: None.

Query params: `q`, `category_id`, `page`, `page_size`.

Expected output:

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
        {
          "id": "uuid",
          "product_id": "uuid",
          "url": "/uploads/img1.png",
          "sort_order": 0,
          "created_at": "2025-01-01T00:00:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### `GET /api/shops/by-slug/{slug}/products/{id}`

Purpose: Fetch one public product by ID.

Request body: None.

Expected output:

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
      {
        "id": "uuid",
        "product_id": "uuid",
        "url": "/uploads/img1.png",
        "sort_order": 0,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

## Static Uploads

### `GET /uploads/{filename}`

Purpose: Serve uploaded logo and banner image files from the configured upload directory.

Request body: None.

Expected output: Raw image bytes with a binary content type such as `image/png` or `image/jpeg`.
