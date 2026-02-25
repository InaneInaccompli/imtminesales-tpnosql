import PostgresDAO from '../dao/PostgresDAO.js';
import Neo4jDAO from '../dao/Neo4jDAO.js';
import ResultsDAO from '../dao/ResultsDAO.js';
import { generateUsers, generateProducts, generateOrders, generateFollows, generateViralOrders } from '../utils/dataGenerator.js';

const sqlDAO = new PostgresDAO();
const nosqlDAO = new Neo4jDAO();

/**
 * Envoie un evenement SSE au client.
 */
function sendSSE(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Génère toutes les données une seule fois.
 * Renvoie { users, products, orders, follows, viralProductIds, seedUserIds, times }.
 */
function generateAllData(counts, res, dbLabel) {
    const times = {};
    const progress = (step, detail, pct) => {
        console.log(`[Generation] ${step}: ${detail}`);
        if (res) sendSSE(res, 'progress', { db: dbLabel || 'Generation', step, detail, pct });
    };

    progress('generateUsers', `Generation de ${counts.users} utilisateurs...`, 0);
    let start = performance.now();
    const users = generateUsers(counts.users);
    times.generateUsers = performance.now() - start;
    progress('generateUsers', `${users.length} utilisateurs generes en ${times.generateUsers.toFixed(0)}ms`, 3);

    progress('generateProducts', `Generation de ${counts.products} produits...`, 3);
    start = performance.now();
    const products = generateProducts(counts.products);
    times.generateProducts = performance.now() - start;
    progress('generateProducts', `${products.length} produits generes en ${times.generateProducts.toFixed(0)}ms`, 5);

    progress('generateFollows', `Generation des follows (max ${counts.maxFollowersPerUser}/user)...`, 5);
    start = performance.now();
    const follows = generateFollows(counts.users, counts.maxFollowersPerUser || 20);
    times.generateFollows = performance.now() - start;
    progress('generateFollows', `${follows.length} follows generes en ${times.generateFollows.toFixed(0)}ms`, 8);

    progress('generateOrders', `Generation des commandes aleatoires (max ${counts.maxOrdersPerUser}/user)...`, 8);
    start = performance.now();
    const randomOrders = generateOrders(counts.users, counts.products, counts.maxOrdersPerUser || 5);
    times.generateOrders = performance.now() - start;
    progress('generateOrders', `${randomOrders.length} commandes aleatoires generees en ${times.generateOrders.toFixed(0)}ms`, 11);

    // Générer des commandes virales qui se propagent le long du graphe de followers
    progress('generateViralOrders', `Generation des commandes virales...`, 11);
    start = performance.now();
    const viral = generateViralOrders(follows, counts.users, counts.products);
    times.generateViralOrders = performance.now() - start;
    progress('generateViralOrders', `${viral.orders.length} commandes virales generees pour ${viral.viralProductIds.length} produits (seeds: [${viral.seedUserIds.join(', ')}]) en ${times.generateViralOrders.toFixed(0)}ms`, 15);

    // Fusionner les commandes en dédupliquant
    const orderSet = new Set(randomOrders.map(o => `${o.user_id}_${o.product_id}`));
    const mergedOrders = [...randomOrders];
    for (const vo of viral.orders) {
        const key = `${vo.user_id}_${vo.product_id}`;
        if (!orderSet.has(key)) {
            orderSet.add(key);
            mergedOrders.push(vo);
        }
    }
    console.log(`[Generation] Total commandes apres fusion: ${mergedOrders.length} (${randomOrders.length} random + ${viral.orders.length} virales)`);

    return {
        users, products, orders: mergedOrders, follows,
        viralProductIds: viral.viralProductIds,
        seedUserIds: viral.seedUserIds,
        times,
    };
}

/**
 * Importe des données pré-générées dans un DAO donné.
 * Envoie la progression via SSE si `res` est fourni.
 * @param {object} data - { users, products, orders, follows }
 * @param {number} pctBase - pourcentage de départ (pour décaler la barre de progression)
 * @param {number} pctRange - plage de pourcentage allouée à cet import
 */
const runImportForDAO = async (dao, data, res, dbLabel, pctBase = 0, pctRange = 100) => {
    const { users, products, orders, follows } = data;
    const times = {};
    const totalStart = performance.now();
    const isNeo4j = dao.constructor.name === 'Neo4jDAO';
    const nodeBatchSize = isNeo4j ? 20000 : 20000;
    const relBatchSize = isNeo4j ? 20000 : 20000;

    const pct = (fraction) => Math.round(pctBase + fraction * pctRange);

    const progress = (step, detail, p) => {
        console.log(`[${dbLabel}] ${step}: ${detail}`);
        if (res) sendSSE(res, 'progress', { db: dbLabel, step, detail, pct: p });
    };

    // 1. Clear
    progress('clear', 'Nettoyage de la base...', pct(0));
    let start = performance.now();
    await dao.clearDatabase();
    times.clear = performance.now() - start;
    progress('clear', `Termine en ${times.clear.toFixed(0)}ms`, pct(0.05));

    // 2. Import users
    progress('importUsers', `Import de ${users.length} utilisateurs (batch ${nodeBatchSize})...`, pct(0.05));
    start = performance.now();
    const userBatches = Math.ceil(users.length / nodeBatchSize);
    for (let i = 0; i < users.length; i += nodeBatchSize) {
        const batchNum = Math.floor(i / nodeBatchSize) + 1;
        await dao.importUsers(users.slice(i, i + nodeBatchSize));
        if (batchNum % 10 === 0 || batchNum === userBatches) {
            progress('importUsers', `Batch ${batchNum}/${userBatches} (${Math.min(i + nodeBatchSize, users.length)}/${users.length})`, pct(0.05 + (batchNum / userBatches) * 0.2));
        }
    }
    times.importUsers = performance.now() - start;
    progress('importUsers', `Termine en ${times.importUsers.toFixed(0)}ms`, pct(0.25));

    // 3. Import products
    progress('importProducts', `Import de ${products.length} produits...`, pct(0.25));
    start = performance.now();
    for (let i = 0; i < products.length; i += nodeBatchSize) {
        await dao.importProducts(products.slice(i, i + nodeBatchSize));
    }
    times.importProducts = performance.now() - start;
    progress('importProducts', `Termine en ${times.importProducts.toFixed(0)}ms`, pct(0.30));

    // 4. Import orders
    progress('importOrders', `Import de ${orders.length} commandes (batch ${relBatchSize})...`, pct(0.30));
    start = performance.now();
    const orderBatches = Math.ceil(orders.length / relBatchSize);
    for (let i = 0; i < orders.length; i += relBatchSize) {
        const batchNum = Math.floor(i / relBatchSize) + 1;
        await dao.importOrders(orders.slice(i, i + relBatchSize));
        if (batchNum % 50 === 0 || batchNum === orderBatches) {
            progress('importOrders', `Batch ${batchNum}/${orderBatches} (${Math.min(i + relBatchSize, orders.length)}/${orders.length})`, pct(0.30 + (batchNum / orderBatches) * 0.30));
        }
    }
    times.importOrders = performance.now() - start;
    progress('importOrders', `Termine en ${times.importOrders.toFixed(0)}ms`, pct(0.60));

    // 5. Import follows
    progress('importFollows', `Import de ${follows.length} follows (batch ${relBatchSize})...`, pct(0.60));
    start = performance.now();
    const followBatches = Math.ceil(follows.length / relBatchSize);
    for (let i = 0; i < follows.length; i += relBatchSize) {
        const batchNum = Math.floor(i / relBatchSize) + 1;
        await dao.importFollows(follows.slice(i, i + relBatchSize));
        if (batchNum % 50 === 0 || batchNum === followBatches) {
            progress('importFollows', `Batch ${batchNum}/${followBatches} (${Math.min(i + relBatchSize, follows.length)}/${follows.length})`, pct(0.60 + (batchNum / followBatches) * 0.40));
        }
    }
    times.importFollows = performance.now() - start;
    progress('importFollows', `Termine en ${times.importFollows.toFixed(0)}ms`, pct(1));

    times.total = performance.now() - totalStart;
    progress('done', `Import termine en ${times.total.toFixed(0)}ms`, pct(1));

    return {
        times,
        counts: {
            users: users.length,
            products: products.length,
            orders: orders.length,
            follows: follows.length
        }
    };
};

/**
 * GET /api/import/progress (SSE)
 * Query: mode, users, products, maxOrdersPerUser, maxFollowersPerUser
 */
export async function importDataSSE(req, res) {
    const { mode, users, products, maxOrdersPerUser, maxFollowersPerUser } = req.query;

    const safeCounts = {
        users: parseInt(users) || 1000000,
        products: parseInt(products) || 10000,
        maxOrdersPerUser: parseInt(maxOrdersPerUser) || 5,
        maxFollowersPerUser: parseInt(maxFollowersPerUser) || 20
    };

    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const results = { sql: null, neo4j: null };

    try {
        // Générer les données une seule fois pour garantir que les deux bases
        // contiennent exactement les mêmes données
        const data = generateAllData(safeCounts, res, 'Generation');
        results.generation = { times: data.times };
        results.viralInfo = {
            viralProductIds: data.viralProductIds,
            seedUserIds: data.seedUserIds,
        };

        const bothMode = mode === 'both';

        if (mode === 'sql' || bothMode) {
            console.log(`[SQL] Starting import: ${JSON.stringify(safeCounts)}`);
            results.sql = await runImportForDAO(sqlDAO, data, res, 'PostgreSQL', bothMode ? 15 : 15, bothMode ? 40 : 85);
            results.sql.times = { ...data.times, ...results.sql.times };
            console.log(`[SQL] Import finished in ${results.sql.times.total.toFixed(0)}ms`);
        }

        if (mode === 'nosql' || bothMode) {
            console.log(`[Neo4j] Starting import: ${JSON.stringify(safeCounts)}`);
            results.neo4j = await runImportForDAO(nosqlDAO, data, res, 'Neo4j', bothMode ? 55 : 15, bothMode ? 40 : 85);
            results.neo4j.times = { ...data.times, ...results.neo4j.times };
            console.log(`[Neo4j] Import finished in ${results.neo4j.times.total.toFixed(0)}ms`);
        }

        ResultsDAO.save('import', { mode, ...safeCounts }, results);
        sendSSE(res, 'complete', { message: 'Import reussi', results });
    } catch (error) {
        console.error('Import error:', error);
        sendSSE(res, 'error', { error: error.message });
    } finally {
        res.end();
    }
}

/**
 * POST /api/import (fallback classique)
 */
export async function importData(req, res) {
    const { mode, counts } = req.body;

    const safeCounts = {
        users: counts?.users || 1000000,
        products: counts?.products || 10000,
        maxOrdersPerUser: counts?.maxOrdersPerUser || 5,
        maxFollowersPerUser: counts?.maxFollowersPerUser || 20
    };

    const results = { sql: null, neo4j: null };

    try {
        // Générer les données une seule fois pour garantir que les deux bases
        // contiennent exactement les mêmes données
        const data = generateAllData(safeCounts, null, null);
        results.generation = { times: data.times };
        results.viralInfo = {
            viralProductIds: data.viralProductIds,
            seedUserIds: data.seedUserIds,
        };

        if (mode === 'sql' || mode === 'both') {
            console.log(`[SQL] Starting import: ${JSON.stringify(safeCounts)}`);
            results.sql = await runImportForDAO(sqlDAO, data, null, 'PostgreSQL');
            results.sql.times = { ...data.times, ...results.sql.times };
            console.log(`[SQL] Import finished in ${results.sql.times.total.toFixed(0)}ms`);
        }

        if (mode === 'nosql' || mode === 'both') {
            console.log(`[Neo4j] Starting import: ${JSON.stringify(safeCounts)}`);
            results.neo4j = await runImportForDAO(nosqlDAO, data, null, 'Neo4j');
            results.neo4j.times = { ...data.times, ...results.neo4j.times };
            console.log(`[Neo4j] Import finished in ${results.neo4j.times.total.toFixed(0)}ms`);
        }

        ResultsDAO.save('import', { mode, ...safeCounts }, results);
        res.json({ message: 'Import reussi', results });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/products/recommended
 */
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
        ResultsDAO.save('recommended', { userId, level, mode }, results);
        res.json(results);
    } catch (e) {
        console.error('getRecommendedProducts error:', e);
        res.status(500).json({ error: e.message });
    }
}

/**
 * POST /api/products/adoption
 */
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
        ResultsDAO.save('adoption', { userId, productId, level, mode }, results);
        res.json(results);
    } catch (e) {
        console.error('getProductAdoptionDepth error:', e);
        res.status(500).json({ error: e.message });
    }
}

/**
 * POST /api/products/viral-network
 * Entrée : { productId, maxLevel, mode }
 * Explore toute la base pour trouver le réseau viral le plus étendu
 * d'un produit donné (traversée orientée, branches coupées).
 */
export async function getViralNetwork(req, res) {
    const { productId, maxLevel, mode } = req.body;
    const safeProductId = parseInt(productId);
    const safeMaxLevel = parseInt(maxLevel) || 6;
    const results = { sql: null, neo4j: null };

    try {
        if (mode === 'sql' || mode === 'both') {
            const start = performance.now();
            const data = await sqlDAO.findViralNetwork(safeProductId, safeMaxLevel);
            results.sql = { time: performance.now() - start, ...data };
        }
        if (mode === 'nosql' || mode === 'both') {
            const start = performance.now();
            const data = await nosqlDAO.findViralNetwork(safeProductId, safeMaxLevel);
            results.neo4j = { time: performance.now() - start, ...data };
        }
        ResultsDAO.save('viral', { productId, maxLevel, mode }, results);
        res.json(results);
    } catch (e) {
        console.error('getViralNetwork error:', e);
        res.status(500).json({ error: e.message });
    }
}

/**
 * GET /api/results
 * Récupère tous les résultats sauvegardés, ou filtrés par type.
 * Query: ?type=recommended|adoption|viral|import
 */
export function getSavedResults(req, res) {
    try {
        const { type } = req.query;
        const data = type ? ResultsDAO.getByType(type) : ResultsDAO.getAll();
        res.json(data);
    } catch (e) {
        console.error('getSavedResults error:', e);
        res.status(500).json({ error: e.message });
    }
}

/**
 * DELETE /api/results
 * Supprime tous les résultats sauvegardés.
 */
export function deleteAllResults(req, res) {
    try {
        ResultsDAO.deleteAll();
        res.json({ message: 'Tous les résultats ont été supprimés' });
    } catch (e) {
        console.error('deleteAllResults error:', e);
        res.status(500).json({ error: e.message });
    }
}
