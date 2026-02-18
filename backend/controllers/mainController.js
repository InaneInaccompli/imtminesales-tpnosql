import { join } from 'path';
import { parseCSV } from '../utils/csvParser';
import PostgresDAO from '../dao/PostgresDAO';
import Neo4jDAO from '../dao/Neo4jDAO';

// Initialize DAOs
const sqlDAO = new PostgresDAO();
const nosqlDAO = new Neo4jDAO();

const CSV_PATH = '/app/data';

const runImportForDAO = async (dao, dataPath, limits) => {
    const start = performance.now();
    await dao.clearDatabase();
    
    const users = await parseCSV(join(dataPath, 'users.csv'), ['id', 'name', 'email'], limits.users);
    // Split into chunks if too big (simple loop)
    for(let i=0; i<users.length; i+=1000) await dao.importUsers(users.slice(i, i+1000));
    
    const products = await parseCSV(join(dataPath, 'products.csv'), ['id', 'name', 'price'], limits.products);
    for(let i=0; i<products.length; i+=1000) await dao.importProducts(products.slice(i, i+1000));
    
    const orders = await parseCSV(join(dataPath, 'orders.csv'), ['user_id', 'product_id'], limits.orders);
    for(let i=0; i<orders.length; i+=1000) await dao.importOrders(orders.slice(i, i+1000));

    const follows = await parseCSV(join(dataPath, 'follows.csv'), ['follower_id', 'followee_id'], limits.follows);
    for(let i=0; i<follows.length; i+=1000) await dao.importFollows(follows.slice(i, i+1000));

    return performance.now() - start;
};

export async function importData(req, res) {
    const { mode, limits } = req.body; 
    // mode: 'sql', 'nosql', 'both'
    // limits: { users: 1000, products: 100, orders: 5000, follows: 5000 } (optional)

    const safeLimits = limits || {};
    const times = { sql: null, neo4j: null };

    try {
        if (mode === 'sql' || mode === 'both') {
            console.log("Starting SQL Import...");
            times.sql = await runImportForDAO(sqlDAO, CSV_PATH, safeLimits);
        }
        
        if (mode === 'nosql' || mode === 'both') {
            console.log("Starting NoSQL Import...");
            times.neo4j = await runImportForDAO(nosqlDAO, CSV_PATH, safeLimits);
        }

        res.json({ message: 'Import Successful', times });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}

export async function getRecommendedProducts(req, res) {
    const { userId, level, mode } = req.body;
    const results = { sql: null, neo4j: null };

    try {
        if (mode === 'sql' || mode === 'both') {
            const start = performance.now();
            const data = await sqlDAO.getTopProductsByFollowers(userId, level);
            results.sql = { time: performance.now() - start, data };
        }
        if (mode === 'nosql' || mode === 'both') {
             const start = performance.now();
             const data = await nosqlDAO.getTopProductsByFollowers(userId, level);
             results.neo4j = { time: performance.now() - start, data };
        }
        res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({error: e.message});
    }
}

export async function getProductAdoptionDepth(req, res) {
    const { userId, productId, level, mode } = req.body;
    const results = { sql: null, neo4j: null };

    try {
        if (mode === 'sql' || mode === 'both') {
            const start = performance.now();
            const count = await sqlDAO.getProductFollowerCount(userId, productId, level);
            results.sql = { time: performance.now() - start, count };
        }
        if (mode === 'nosql' || mode === 'both') {
             const start = performance.now();
             const count = await nosqlDAO.getProductFollowerCount(userId, productId, level);
             results.neo4j = { time: performance.now() - start, count };
        }
        res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({error: e.message});
    }
}

export async function getProductViralScore(req, res) {
    const { userId, productId, level, mode } = req.body;
    const results = { sql: null, neo4j: null };

    try {
        if (mode === 'sql' || mode === 'both') {
            const start = performance.now();
            const count = await sqlDAO.getViralProductCount(userId, productId, level);
            results.sql = { time: performance.now() - start, count };
        }
        if (mode === 'nosql' || mode === 'both') {
             const start = performance.now();
             const count = await nosqlDAO.getViralProductCount(userId, productId, level);
             results.neo4j = { time: performance.now() - start, count };
        }
        res.json(results);
    } catch (e) {
         console.error(e);
        res.status(500).json({error: e.message});
    }
}
