CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    price NUMERIC(10, 2)
);

CREATE TABLE IF NOT EXISTS orders (
    user_id INT,
    product_id INT,
    PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id INT,
    followee_id INT,
    PRIMARY KEY (follower_id, followee_id)
);
