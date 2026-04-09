# Amaar Shop — Database Schema

## Tenant Isolation Rule

Every query for tenant-scoped data (categories, products, orders, order_items, product_images, product_variants) **must** include `shop_id` in the WHERE clause. Repository implementations enforce this; reviewers should reject any query that doesn't.

> **Note:** Row-level security (RLS) was considered but not used to keep the MVP simple. Tenant isolation is enforced at the application layer via repository interfaces that always require a shop_id parameter.

## Shared Conventions

- All `id` columns are `uuid` with `DEFAULT gen_random_uuid()` (pgcrypto extension).
- All tables have `created_at timestamptz NOT NULL DEFAULT now()`.
- Tables that can be updated also have `updated_at timestamptz NOT NULL DEFAULT now()` managed by a shared `set_updated_at()` trigger.
- Money fields use `numeric(10,2)` — never float.
- Extensions enabled: `pgcrypto`, `citext`, `pg_trgm`.
- Every foreign key has an explicit ON DELETE action documented below.

---

## Tables

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| email | citext | UNIQUE NOT NULL |
| password_hash | text | NOT NULL |
| is_admin | boolean | DEFAULT false |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Sample row:**
```json
{"id": "a1b2c3...", "email": "seller@example.com", "is_admin": false}
```

---

### shops

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| owner_user_id | uuid | UNIQUE NOT NULL, FK → users ON DELETE CASCADE |
| slug | citext | UNIQUE NOT NULL, CHECK (length 3-40, lowercase alphanumeric + hyphens) |
| name | text | NOT NULL |
| description | text | |
| logo_url | text | |
| banner_url | text | |
| contact_phone | text | |
| is_suspended | boolean | DEFAULT false |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Indexes:** UNIQUE on `owner_user_id` (one shop per user in MVP), UNIQUE on `slug`.

**Sample row:**
```json
{"id": "...", "slug": "demo-shop", "name": "Demo Shop", "is_suspended": false}
```

---

### shop_delivery_settings

| Column | Type | Constraints |
|--------|------|-------------|
| shop_id | uuid | PK, FK → shops ON DELETE CASCADE |
| cod_enabled | boolean | DEFAULT true |
| delivery_charge | numeric(10,2) | DEFAULT 0, CHECK >= 0 |
| free_delivery_threshold | numeric(10,2) | NULLABLE, CHECK > delivery_charge when not null |
| advance_payment_required | boolean | DEFAULT false |
| advance_payment_instructions | text | |
| delivery_areas | text[] | DEFAULT '{}' |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

One row per shop. Created automatically on shop creation.

---

### categories

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| shop_id | uuid | NOT NULL, FK → shops ON DELETE CASCADE |
| name | text | NOT NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |

**Indexes:** UNIQUE on `(shop_id, lower(name))`. Index on `shop_id`.

---

### products

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| shop_id | uuid | NOT NULL, FK → shops ON DELETE CASCADE |
| category_id | uuid | NULLABLE, FK → categories ON DELETE SET NULL |
| name | text | NOT NULL |
| description | text | |
| price_bdt | numeric(10,2) | NOT NULL, CHECK > 0 |
| stock | integer | NOT NULL DEFAULT 0, CHECK >= 0 |
| is_active | boolean | DEFAULT true |
| is_archived | boolean | DEFAULT false |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Indexes:**
- `(shop_id, is_active, is_archived)`
- `(shop_id, category_id)`
- `(shop_id)` WHERE `is_archived = false`
- GIN index on `name` using `pg_trgm` for text search

---

### product_images

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| product_id | uuid | NOT NULL, FK → products ON DELETE CASCADE |
| url | text | NOT NULL |
| sort_order | integer | DEFAULT 0 |
| created_at | timestamptz | NOT NULL DEFAULT now() |

**Indexes:** `(product_id, sort_order)`.
Max 5 images per product — enforced at app level.

---

### product_variants

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| product_id | uuid | NOT NULL, FK → products ON DELETE CASCADE |
| name | text | NOT NULL |
| sku | text | |
| price_override | numeric(10,2) | NULLABLE, CHECK >= 0 |
| stock | integer | NOT NULL DEFAULT 0, CHECK >= 0 |
| created_at | timestamptz | NOT NULL DEFAULT now() |

Table exists from day one even though UI doesn't expose variants in MVP — prevents schema churn later.

---

### orders

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| shop_id | uuid | NOT NULL, FK → shops ON DELETE RESTRICT |
| customer_name | text | NOT NULL |
| customer_phone | text | NOT NULL |
| delivery_address | text | NOT NULL |
| delivery_area | text | NOT NULL |
| note | text | |
| subtotal_bdt | numeric(10,2) | NOT NULL |
| delivery_charge_bdt | numeric(10,2) | NOT NULL DEFAULT 0 |
| total_bdt | numeric(10,2) | NOT NULL |
| status | text | NOT NULL, CHECK IN ('pending','confirmed','shipped','delivered','cancelled'), DEFAULT 'pending' |
| advance_payment_required | boolean | DEFAULT false |
| advance_payment_received | boolean | DEFAULT false |
| cancelled_reason | text | |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Indexes:**
- `(shop_id, status, created_at DESC)`
- `(shop_id, customer_phone)`
- `(created_at DESC)`

---

### order_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() |
| order_id | uuid | NOT NULL, FK → orders ON DELETE CASCADE |
| product_id | uuid | NOT NULL, FK → products ON DELETE RESTRICT |
| product_name_snapshot | text | NOT NULL |
| unit_price_snapshot_bdt | numeric(10,2) | NOT NULL |
| quantity | integer | NOT NULL, CHECK > 0 |
| line_total_bdt | numeric(10,2) | NOT NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |

Product name and price are **snapshotted** at order time so future edits don't mutate history.

**Indexes:** `order_id`.

---

## ER Diagram

```mermaid
erDiagram
    users ||--o| shops : "owns (1:1)"
    shops ||--|| shop_delivery_settings : "has settings"
    shops ||--o{ categories : "has"
    shops ||--o{ products : "has"
    shops ||--o{ orders : "receives"
    categories ||--o{ products : "groups"
    products ||--o{ product_images : "has"
    products ||--o{ product_variants : "has"
    orders ||--|{ order_items : "contains"
    products ||--o{ order_items : "referenced by"

    users {
        uuid id PK
        citext email UK
        text password_hash
        bool is_admin
        timestamptz created_at
        timestamptz updated_at
    }

    shops {
        uuid id PK
        uuid owner_user_id FK_UK
        citext slug UK
        text name
        text description
        text logo_url
        text banner_url
        text contact_phone
        bool is_suspended
        timestamptz created_at
        timestamptz updated_at
    }

    shop_delivery_settings {
        uuid shop_id PK_FK
        bool cod_enabled
        numeric delivery_charge
        numeric free_delivery_threshold
        bool advance_payment_required
        text advance_payment_instructions
        text_arr delivery_areas
        timestamptz updated_at
    }

    categories {
        uuid id PK
        uuid shop_id FK
        text name
        timestamptz created_at
    }

    products {
        uuid id PK
        uuid shop_id FK
        uuid category_id FK
        text name
        text description
        numeric price_bdt
        int stock
        bool is_active
        bool is_archived
        timestamptz created_at
        timestamptz updated_at
    }

    product_images {
        uuid id PK
        uuid product_id FK
        text url
        int sort_order
        timestamptz created_at
    }

    product_variants {
        uuid id PK
        uuid product_id FK
        text name
        text sku
        numeric price_override
        int stock
        timestamptz created_at
    }

    orders {
        uuid id PK
        uuid shop_id FK
        text customer_name
        text customer_phone
        text delivery_address
        text delivery_area
        text note
        numeric subtotal_bdt
        numeric delivery_charge_bdt
        numeric total_bdt
        text status
        bool advance_payment_required
        bool advance_payment_received
        text cancelled_reason
        timestamptz created_at
        timestamptz updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        text product_name_snapshot
        numeric unit_price_snapshot_bdt
        int quantity
        numeric line_total_bdt
        timestamptz created_at
    }
```
