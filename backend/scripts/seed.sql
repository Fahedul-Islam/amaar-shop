-- Seed data for Amaar Shop development
-- Run via: make seed
-- NEVER run in production

-- Demo seller (password: seller123)
INSERT INTO users (id, email, password_hash, is_admin)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'seller@demo.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    false
) ON CONFLICT (email) DO NOTHING;

-- Demo shop
INSERT INTO shops (id, owner_user_id, slug, name, description, contact_phone)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'demo-shop',
    'Demo Shop',
    'A demo shop for testing Amaar Shop',
    '+8801700000000'
) ON CONFLICT (slug) DO NOTHING;

-- Delivery settings
INSERT INTO shop_delivery_settings (shop_id, cod_enabled, delivery_charge, delivery_areas)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    true,
    60.00,
    ARRAY['Dhaka', 'Chittagong', 'Sylhet']
) ON CONFLICT (shop_id) DO NOTHING;

-- Three categories
INSERT INTO categories (id, shop_id, name) VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Clothing'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Accessories'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Home Decor')
ON CONFLICT DO NOTHING;

-- Six products
INSERT INTO products (id, shop_id, category_id, name, description, price_bdt, stock) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Cotton Panjabi', 'Premium cotton panjabi for everyday wear', 1200.00, 25),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Silk Saree', 'Beautiful Rajshahi silk saree', 3500.00, 10),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Lungi', 'Traditional cotton lungi', 450.00, 50),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Leather Wallet', 'Handcrafted leather wallet', 800.00, 30),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Jute Bag', 'Eco-friendly jute tote bag', 350.00, 40),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Nakshi Kantha', 'Hand-stitched Nakshi Kantha throw', 2800.00, 5)
ON CONFLICT DO NOTHING;

-- Product images
INSERT INTO product_images (product_id, url, sort_order) VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', '/uploads/seed/panjabi-1.jpg', 0),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', '/uploads/seed/saree-1.jpg', 0),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', '/uploads/seed/lungi-1.jpg', 0),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', '/uploads/seed/wallet-1.jpg', 0),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', '/uploads/seed/jutebag-1.jpg', 0),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', '/uploads/seed/kantha-1.jpg', 0)
ON CONFLICT DO NOTHING;

-- Three sample orders in different statuses
INSERT INTO orders (id, shop_id, customer_name, customer_phone, delivery_address, delivery_area, subtotal_bdt, delivery_charge_bdt, total_bdt, status) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Rahim Uddin', '+8801711111111', '123 Dhanmondi, Road 5', 'Dhaka', 1650.00, 60.00, 1710.00, 'pending'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Fatima Begum', '+8801722222222', '45 Agrabad C/A', 'Chittagong', 3500.00, 60.00, 3560.00, 'confirmed'),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Karim Ahmed', '+8801733333333', '78 Zindabazar', 'Sylhet', 800.00, 60.00, 860.00, 'delivered')
ON CONFLICT DO NOTHING;

-- Order items
INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_snapshot_bdt, quantity, line_total_bdt) VALUES
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Cotton Panjabi', 1200.00, 1, 1200.00),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Lungi', 450.00, 1, 450.00),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Silk Saree', 3500.00, 1, 3500.00),
    ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'Leather Wallet', 800.00, 1, 800.00)
ON CONFLICT DO NOTHING;
