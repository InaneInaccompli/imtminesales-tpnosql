import { Pool } from 'pg';
import AbstractDAO from './AbstractDAO';

class PostgresDAO extends AbstractDAO {
    constructor() {
        super();
        this.pool = new Pool({
            user: process.env.POSTGRES_USER || 'postgres',
            host: process.env.DB_SQL_HOST || 'database_sql',
            database: process.env.POSTGRES_DB || 'postgres',
            password: process.env.POSTGRES_PASSWORD || 'postgres',
            port: process.env.DB_SQL_PORT || 5432,
        });
    }

    async connect() {
      // Pool handles connections automatically
    }

    async close() {
        await this.pool.end();
    }

    async query(text, params) {
        return this.pool.query(text, params);
    }

    async clearDatabase() {
        await this.query('TRUNCATE users, products, orders, follows RESTART IDENTITY CASCADE');
    }

    async _bulkInsert(table, columns, rows) {
        if (rows.length === 0) return;
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
             // Naive bulk insert for simplicity in this environment
             // For very large datasets in production, COPY FROM STDIN is better
            const values = rows.map(r => `(${columns.map(c => {
                const val = r[c];
                return isNaN(val) ? `'${val.replace(/'/g, "''")}'` : val;
            }).join(',')})`).join(',');
            
            await client.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${values}`);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async importUsers(users) {
        await this._bulkInsert('users', ['id', 'name', 'email'], users);
    }

    async importProducts(products) {
        await this._bulkInsert('products', ['id', 'name', 'price'], products);
    }

    async importOrders(orders) {
        await this._bulkInsert('orders', ['user_id', 'product_id'], orders);
    }

    async importFollows(follows) {
        await this._bulkInsert('follows', ['follower_id', 'followee_id'], follows);
    }

    // --- Queries ---

    async getTopProductsByFollowers(userId, level) {
         const query = `
            WITH RECURSIVE followers_cte AS (
                SELECT follower_id, 1 as depth
                FROM follows
                WHERE followee_id = $1
                UNION
                SELECT f.follower_id, cte.depth + 1
                FROM follows f
                JOIN followers_cte cte ON f.followee_id = cte.follower_id
                WHERE cte.depth < $2
            )
            SELECT p.name, COUNT(*) as count
            FROM followers_cte fc
            JOIN orders o ON fc.follower_id = o.user_id
            JOIN products p ON o.product_id = p.id
            WHERE fc.depth <= $2
            GROUP BY p.name
            ORDER BY count DESC
            LIMIT 50;
         `;
         const res = await this.query(query, [userId, level]);
         return res.rows;
    }

    async getProductFollowerCount(userId, productId, level) {
        const query = `
            WITH RECURSIVE followers_cte AS (
                SELECT follower_id, 1 as depth
                FROM follows
                WHERE followee_id = $1
                UNION
                SELECT f.follower_id, cte.depth + 1
                FROM follows f
                JOIN followers_cte cte ON f.followee_id = cte.follower_id
                WHERE cte.depth < $2
            )
            SELECT COUNT(*) as count
            FROM followers_cte fc
            JOIN orders o ON fc.follower_id = o.user_id
            WHERE o.product_id = $3
        `;
         const res = await this.query(query, [userId, level, productId]);
         return parseInt(res.rows[0].count);
    }

    async getViralProductCount(userId, productId, level) {
        const query = `
            WITH RECURSIVE followers_cte AS (
                SELECT follower_id, 1 as depth
                FROM follows
                WHERE followee_id = $1
                UNION
                SELECT f.follower_id, cte.depth + 1
                FROM follows f
                JOIN followers_cte cte ON f.followee_id = cte.follower_id
                WHERE cte.depth < $2
            )
            SELECT COUNT(*) as count
            FROM followers_cte fc
            JOIN orders o ON fc.follower_id = o.user_id
            WHERE o.product_id = $3 AND fc.depth = $2
        `;
         const res = await this.query(query, [userId, level, productId]);
         return parseInt(res.rows[0]?.count || 0);
    }
}

export default PostgresDAO;
