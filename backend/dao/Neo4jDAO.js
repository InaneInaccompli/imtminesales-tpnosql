import { driver, auth } from 'neo4j-driver';
import AbstractDAO from './AbstractDAO';

class Neo4jDAO extends AbstractDAO {
    constructor() {
        super();
        this.driver = driver(
            'bolt://database_nosql:7687',
            auth.basic('neo4j', process.env.NEO4J_AUTH_PASSWORD || 'password123')
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
            await session.run('MATCH (n) DETACH DELETE n');
            // Re-create constraints
            await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE');
            await session.run('CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE');
        } finally {
            await session.close();
        }
    }

    async _bulkRun(query, dataKey, data) {
         const session = this.driver.session();
         try {
             await session.run(query, { [dataKey]: data });
         } finally {
             await session.close();
         }
    }

    async importUsers(users) {
        // Convert IDs to integers for Neo4j consistency
        const cleanUsers = users.map(u => ({...u, id: parseInt(u.id)}));
        await this._bulkRun(
            'UNWIND $batch AS row CREATE (u:User {id: row.id, name: row.name, email: row.email})',
            'batch', cleanUsers
        );
    }

    async importProducts(products) {
        const cleanProducts = products.map(p => ({...p, id: parseInt(p.id), price: parseFloat(p.price)}));
        await this._bulkRun(
            'UNWIND $batch AS row CREATE (p:Product {id: row.id, name: row.name, price: row.price})',
            'batch', cleanProducts
        );
    }

    async importOrders(orders) {
        const cleanOrders = orders.map(o => ({user_id: parseInt(o.user_id), product_id: parseInt(o.product_id)}));
        await this._bulkRun(
            'UNWIND $batch AS row MATCH (u:User {id: row.user_id}), (p:Product {id: row.product_id}) CREATE (u)-[:ORDERED]->(p)',
            'batch', cleanOrders
        );
    }

    async importFollows(follows) {
        const cleanFollows = follows.map(f => ({follower_id: parseInt(f.follower_id), followee_id: parseInt(f.followee_id)}));
        await this._bulkRun(
            'UNWIND $batch AS row MATCH (f1:User {id: row.follower_id}), (f2:User {id: row.followee_id}) CREATE (f1)-[:FOLLOWS]->(f2)',
            'batch', cleanFollows
        );
    }

    // --- Queries ---

    async getTopProductsByFollowers(userId, level) {
        const session = this.driver.session();
        try {
            const query = `
                MATCH (u:User {id: $userId})<-[:FOLLOWS*1..${level}]-(follower)-[:ORDERED]->(p:Product)
                RETURN p.name as name, COUNT(*) as count
                ORDER BY count DESC
                LIMIT 50
            `;
            const res = await session.run(query, { userId: parseInt(userId) });
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
                MATCH (u:User {id: $userId})<-[:FOLLOWS*1..${level}]-(follower)-[:ORDERED]->(p:Product {id: $productId})
                RETURN COUNT(follower) as count
            `;
            const res = await session.run(query, { userId: parseInt(userId), productId: parseInt(productId) });
            return res.records[0].get('count').toInt();
         } finally {
             await session.close();
         }
    }

    async getViralProductCount(userId, productId, level) {
        const session = this.driver.session();
        try {
             // Exact hop count
             const query = `
                MATCH (u:User {id: $userId})<-[:FOLLOWS*${level}]-(follower)-[:ORDERED]->(p:Product {id: $productId})
                RETURN COUNT(follower) as count
            `;
            const res = await session.run(query, { userId: parseInt(userId), productId: parseInt(productId) });
            return res.records[0].get('count').toInt();
        } finally {
            await session.close();
        }
    }
}

export default Neo4jDAO;
