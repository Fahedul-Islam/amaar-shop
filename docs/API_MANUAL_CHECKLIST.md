# Amaar Shop Backend Manual API Checklist

This file covers the HTTP routes currently mounted by the backend router. Use it as a manual smoke-test guide after starting the backend.

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
    "delivery_areas": ["Dhaka", "Chittagong"],
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
  "delivery_areas": ["Dhaka", "Chittagong"]
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
    "delivery_areas": ["Dhaka", "Chittagong"]
  }
}
```

## Static Uploads

### `GET /uploads/{filename}`

Purpose: Serve uploaded logo and banner image files from the configured upload directory.

Request body: None.

Expected output: Raw image bytes with a binary content type such as `image/png` or `image/jpeg`.
