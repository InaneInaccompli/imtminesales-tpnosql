import pg from 'pg';
const { Pool } = pg;
import AbstractDAO from './AbstractDAO.js';

class PostgresDAO extends AbstractDAO {
    constructor() {
        super();
        this.pool = new Pool({
            user: process.env.POSTGRES_USER || 'postgres',
            host: process.env.DB_SQL_HOST || 'database_sql',
            database: process.env.POSTGRES_DB || 'socialnetwork',
            password: process.env.POSTGRES_PASSWORD || 'password',
            port: parseInt(process.env.DB_SQL_PORT) || 5432,
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
            const values = rows.map(r => `(${columns.map(c => {
                const val = r[c];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'number') return val;
                return `'${String(val).replace(/'/g, "''")}'`;
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

    // --- Requêtes d'analyse ---
    // Note : toutes les CTE récursives utilisent UNION (pas UNION ALL)
    // pour éviter les cycles. De plus on fait un DISTINCT sur follower_id
    // car un même user peut apparaître à des profondeurs différentes.

    async getTopProductsByFollowers(userId, level) {
        const query = `
            WITH RECURSIVE followers_cte AS (
                SELECT follower_id, 1 as depth
                FROM follows
                WHERE followee_id = $1
                  AND follower_id <> $1
                UNION
                SELECT f.follower_id, cte.depth + 1
                FROM follows f
                JOIN followers_cte cte ON f.followee_id = cte.follower_id
                WHERE cte.depth < $2
                  AND f.follower_id <> $1
            ),
            distinct_followers AS (
                SELECT DISTINCT follower_id FROM followers_cte
            )
            SELECT p.name, COUNT(DISTINCT df.follower_id)::int as count
            FROM distinct_followers df
            JOIN orders o ON df.follower_id = o.user_id
            JOIN products p ON o.product_id = p.id
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
                  AND follower_id <> $1
                UNION
                SELECT f.follower_id, cte.depth + 1
                FROM follows f
                JOIN followers_cte cte ON f.followee_id = cte.follower_id
                WHERE cte.depth < $2
                  AND f.follower_id <> $1
            ),
            distinct_followers AS (
                SELECT DISTINCT follower_id FROM followers_cte
            )
            SELECT COUNT(DISTINCT df.follower_id)::int as count
            FROM distinct_followers df
            JOIN orders o ON df.follower_id = o.user_id
            WHERE o.product_id = $3
        `;
        const res = await this.query(query, [userId, level, productId]);
        return parseInt(res.rows[0].count);
    }

    async findViralNetwork(productId, maxLevel) {
        const lvl = parseInt(maxLevel);

        // UNE SEULE REQUÊTE :
        // 1. On identifie tous les acheteurs du produit (buyers).
        // 2. On identifie les « racines pures » = acheteurs qui ne SUIVENT aucun
        //    autre acheteur (= sommets de chaînes de propagation).
        // 3. On fait un BFS orienté depuis TOUTES les racines en parallèle via
        //    une CTE récursive, en ne traversant que les followers qui ont acheté.
        // 4. Pour chaque nœud atteint, on garde la racine + profondeur min.
        // 5. On agrège par racine et par profondeur, puis on prend la meilleure racine.
        const query = `
            WITH RECURSIVE buyers AS (
                SELECT DISTINCT user_id FROM orders WHERE product_id = $1
            ),
            pure_roots AS (
                SELECT b.user_id AS root_id
                FROM buyers b
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM follows f
                    JOIN buyers b2 ON b2.user_id = f.followee_id
                    WHERE f.follower_id = b.user_id
                )
            ),
            viral_bfs AS (
                -- Niveau 1 : followers directs de chaque racine ayant acheté le produit
                SELECT pr.root_id,
                       f.follower_id,
                       1 AS depth
                FROM pure_roots pr
                JOIN follows f ON f.followee_id = pr.root_id
                JOIN buyers b ON b.user_id = f.follower_id
                WHERE f.follower_id <> pr.root_id

                UNION

                -- Niveaux suivants : on propage uniquement via les acheteurs
                SELECT cte.root_id,
                       f.follower_id,
                       cte.depth + 1
                FROM viral_bfs cte
                JOIN follows f ON f.followee_id = cte.follower_id
                JOIN buyers b ON b.user_id = f.follower_id
                WHERE cte.depth < $2
                  AND f.follower_id <> cte.root_id
            ),
            first_seen AS (
                SELECT root_id, follower_id, MIN(depth) AS first_depth
                FROM viral_bfs
                GROUP BY root_id, follower_id
            ),
            per_root AS (
                SELECT root_id,
                       first_depth AS level,
                       COUNT(*)::int AS count
                FROM first_seen
                GROUP BY root_id, first_depth
            ),
            root_totals AS (
                SELECT root_id, SUM(count)::int AS total
                FROM per_root
                GROUP BY root_id
            ),
            best_root AS (
                SELECT root_id FROM root_totals ORDER BY total DESC LIMIT 1
            )
            SELECT pr.root_id::int AS root_user_id,
                   pr.level::int AS level,
                   pr.count::int AS count,
                   rt.total::int AS total
            FROM per_root pr
            JOIN best_root br ON br.root_id = pr.root_id
            JOIN root_totals rt ON rt.root_id = pr.root_id
            ORDER BY pr.level
        `;

        const res = await this.query(query, [productId, lvl]);

        if (res.rows.length === 0) {
            return { rootUserId: null, circles: [], total: 0 };
        }

        return {
            rootUserId: res.rows[0].root_user_id,
            circles: res.rows.map(r => ({ level: r.level, count: r.count })),
            total: res.rows[0].total,
        };
    }
}

export default PostgresDAO;
