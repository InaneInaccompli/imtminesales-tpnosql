CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    price NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS orders (
    user_id INT REFERENCES users(id),
    product_id INT REFERENCES products(id),
    PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id INT REFERENCES users(id),
    followee_id INT REFERENCES users(id),
    PRIMARY KEY (follower_id, followee_id)
);

-- Index critiques pour les requêtes récursives sur gros volume (1M users)
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
