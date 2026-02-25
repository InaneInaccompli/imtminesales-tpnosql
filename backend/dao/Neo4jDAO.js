import neo4j from 'neo4j-driver';
import AbstractDAO from './AbstractDAO.js';

class Neo4jDAO extends AbstractDAO {
    constructor() {
        super();
        this.driver = neo4j.driver(
            process.env.NEO4J_URI || 'bolt://database_nosql:7687',
            neo4j.auth.basic(
                process.env.NEO4J_USER || 'neo4j',
                process.env.NEO4J_PASSWORD || 'password'
            )
        );
    }

    async connect() {
        // Driver manages connection pool
    }

    async close() {
        await this.driver.close();
    }

    async clearDatabase() {
        const session = this.driver.session();
        try {
            // Supprimer par batch pour éviter les OOM
            let deleted;
            do {
                const res = await session.run(
                    'MATCH (n) WITH n LIMIT 5000 DETACH DELETE n RETURN count(*) AS deleted'
                );
                deleted = res.records[0].get('deleted').toInt();
            } while (deleted > 0);
            // Recréer les contraintes d'unicité (ignorer si déjà existantes)
            try {
                await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
            } catch (_) { /* constraint or index already exists */ }
            try {
                await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE');
            } catch (_) { /* constraint or index already exists */ }
        } finally {
            await session.close();
        }
    }

    async _bulkRun(query, dataKey, data) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const session = this.driver.session();
            try {
                await session.run(query, { [dataKey]: data });
                return;
            } catch (err) {
                if (attempt < maxRetries && (
                    err.message.includes('Could not apply the transaction') ||
                    err.message.includes('transaction') ||
                    err.code === 'Neo.TransientError.Transaction.Outdated'
                )) {
                    console.warn(`[Neo4j] _bulkRun attempt ${attempt} failed (${data.length} items), retrying in ${attempt * 500}ms...`);
                    await new Promise(r => setTimeout(r, attempt * 500));
                } else {
                    throw err;
                }
            } finally {
                await session.close();
            }
        }
    }

    async importUsers(users) {
        const cleanUsers = users.map(u => ({ ...u, id: neo4j.int(u.id) }));
        await this._bulkRun(
            'UNWIND $batch AS row CREATE (u:User {id: row.id, name: row.name, email: row.email})',
            'batch', cleanUsers
        );
    }

    async importProducts(products) {
        const cleanProducts = products.map(p => ({ ...p, id: neo4j.int(p.id), price: p.price }));
        await this._bulkRun(
            'UNWIND $batch AS row CREATE (p:Product {id: row.id, name: row.name, price: row.price})',
            'batch', cleanProducts
        );
    }

    async importOrders(orders) {
        const cleanOrders = orders.map(o => ({
            user_id: neo4j.int(o.user_id),
            product_id: neo4j.int(o.product_id)
        }));
        await this._bulkRun(
            'UNWIND $batch AS row MATCH (u:User {id: row.user_id}), (p:Product {id: row.product_id}) CREATE (u)-[:ORDERED]->(p)',
            'batch', cleanOrders
        );
    }

    async importFollows(follows) {
        const cleanFollows = follows.map(f => ({
            follower_id: neo4j.int(f.follower_id),
            followee_id: neo4j.int(f.followee_id)
        }));
        await this._bulkRun(
            'UNWIND $batch AS row MATCH (f1:User {id: row.follower_id}), (f2:User {id: row.followee_id}) CREATE (f1)-[:FOLLOWS]->(f2)',
            'batch', cleanFollows
        );
    }

    // --- Requêtes d'analyse ---
    // Note : on utilise DISTINCT pour dédoublonner les followers
    // car un même nœud peut être atteint par plusieurs chemins dans le graphe.
    // On exclut aussi l'utilisateur racine (u <> follower).

    async getTopProductsByFollowers(userId, level) {
        const session = this.driver.session();
        try {
            const query = `
                MATCH (u:User {id: $userId})<-[:FOLLOWS*1..${parseInt(level)}]-(follower)
                WHERE follower <> u
                WITH DISTINCT follower
                MATCH (follower)-[:ORDERED]->(p:Product)
                RETURN p.name AS name, COUNT(DISTINCT follower) AS count
                ORDER BY count DESC
                LIMIT 50
            `;
            const res = await session.run(query, { userId: neo4j.int(userId) });
            return res.records.map(record => ({
                name: record.get('name'),
                count: record.get('count').toInt()
            }));
        } finally {
            await session.close();
        }
    }

    async getProductFollowerCount(userId, productId, level) {
        const session = this.driver.session();
        try {
            const query = `
                MATCH (u:User {id: $userId})<-[:FOLLOWS*1..${parseInt(level)}]-(follower)
                WHERE follower <> u
                WITH DISTINCT follower
                MATCH (follower)-[:ORDERED]->(p:Product {id: $productId})
                RETURN COUNT(DISTINCT follower) AS count
            `;
            const res = await session.run(query, {
                userId: neo4j.int(userId),
                productId: neo4j.int(productId)
            });
            return res.records[0].get('count').toInt();
        } finally {
            await session.close();
        }
    }

    async findViralNetwork(productId, maxLevel) {
        const session = this.driver.session();
        try {
            const lvl = parseInt(maxLevel);

            // UNE SEULE REQUÊTE Cypher :
            // 1. On part du produit (p).
            // 2. On trouve les « racines pures » = acheteurs de p qui ne SUIVENT
            //    aucun autre acheteur de p.
            // 3. Depuis chaque racine, on cherche tous les chemins de followers
            //    de longueur 1..maxLevel où CHAQUE nœud intermédiaire a acheté p,
            //    ET le nœud cible a aussi acheté p (= propagation orientée).
            // 4. On groupe par (racine, profondeur first-seen), on totalise par racine,
            //    et on garde la meilleure.
            const query = `
                MATCH (p:Product {id: $productId})

                // Racines pures : acheteurs qui ne suivent aucun autre acheteur de p
                MATCH (root:User)-[:ORDERED]->(p)
                WHERE NOT EXISTS {
                    MATCH (root)-[:FOLLOWS]->(other:User)-[:ORDERED]->(p)
                }

                // BFS orienté : chemins de 1..N hops où chaque intermédiaire a acheté p
                MATCH path = (root)<-[:FOLLOWS*1..${lvl}]-(target)
                WHERE target <> root
                  AND ALL(n IN nodes(path)[1..-1] WHERE (n)-[:ORDERED]->(p))
                  AND (target)-[:ORDERED]->(p)

                // Pour chaque (racine, cible) on garde la profondeur min
                WITH root, target, MIN(length(path)) AS firstLevel

                // Agrégation par racine et profondeur
                WITH root, firstLevel AS level, COUNT(target) AS count

                // Total par racine
                WITH root, COLLECT({level: level, count: count}) AS circles,
                     SUM(count) AS total

                // Garder la meilleure racine
                ORDER BY total DESC
                LIMIT 1

                RETURN root.id AS rootUserId, circles, total
            `;
            const res = await session.run(query, {
                productId: neo4j.int(productId)
            });

            if (res.records.length === 0) {
                return { rootUserId: null, circles: [], total: 0 };
            }

            const record = res.records[0];
            const circles = record.get('circles').map(c => ({
                level: typeof c.level === 'object' ? c.level.toInt() : c.level,
                count: typeof c.count === 'object' ? c.count.toInt() : c.count,
            })).sort((a, b) => a.level - b.level);

            return {
                rootUserId: record.get('rootUserId').toInt(),
                circles,
                total: record.get('total').toInt(),
            };
        } finally {
            await session.close();
        }
    }
}

export default Neo4jDAO;
