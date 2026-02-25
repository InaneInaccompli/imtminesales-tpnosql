/**
 * Générateur de données pour alimenter les bases de données.
 * Optimisé pour supporter jusqu'à 1M utilisateurs.
 *
 * Volumétrie cible :
 * - 1 000 000 utilisateurs
 * - 10 000 produits
 * - Chaque utilisateur : 0 – 5 commandes (produits distincts)
 * - Chaque utilisateur : 0 – 20 followers directs
 * - Quelques produits « viraux » dont les commandes se propagent
 *   le long du graphe de followers (simulation de viralité).
 */

const firstNames = [
    'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hector',
    'Ivy', 'Jack', 'Karen', 'Leo', 'Mona', 'Nathan', 'Olivia', 'Paul',
    'Quinn', 'Rachel', 'Steve', 'Tina', 'Umar', 'Vera', 'Walter', 'Xena',
    'Yves', 'Zara', 'Hugo', 'Lina', 'Omar', 'Sophie', 'Lucas', 'Emma',
    'Noah', 'Jade', 'Louis', 'Chloé', 'Raphaël', 'Léa', 'Arthur', 'Manon'
];

const lastNames = [
    'Dupont', 'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard',
    'Durand', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre',
    'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Garcia',
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis',
    'Wilson', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'White', 'Harris'
];

const productAdjectives = [
    'Ultra', 'Super', 'Mega', 'Pro', 'Elite', 'Premium', 'Eco', 'Smart',
    'Classic', 'Modern', 'Vintage', 'Mini', 'Max', 'Turbo', 'Nano'
];

const productNouns = [
    'Phone', 'Laptop', 'Tablet', 'Watch', 'Speaker', 'Camera', 'Headphones',
    'Keyboard', 'Mouse', 'Monitor', 'Printer', 'Router', 'Drone', 'Console',
    'TV', 'Charger', 'Cable', 'Case', 'Stand', 'Light', 'Sensor', 'Battery',
    'Adapter', 'Hub', 'Drive', 'Card', 'Chip', 'Board', 'Module', 'Kit'
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Tire N valeurs distinctes aléatoires dans [1..max].
 */
function randomDistinctInts(n, max, exclude) {
    const result = [];
    const seen = new Set();
    if (exclude !== undefined) seen.add(exclude);
    let attempts = 0;
    while (result.length < n && attempts < n * 4) {
        const v = randomInt(1, max);
        if (!seen.has(v)) {
            seen.add(v);
            result.push(v);
        }
        attempts++;
    }
    return result;
}

/**
 * Génère un tableau d'utilisateurs.
 */
export function generateUsers(count) {
    const users = [];
    for (let i = 1; i <= count; i++) {
        const first = randomElement(firstNames);
        const last = randomElement(lastNames);
        users.push({
            id: i,
            name: `${first} ${last}`,
            email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`
        });
    }
    return users;
}

/**
 * Génère un tableau de produits.
 */
export function generateProducts(count) {
    const products = [];
    for (let i = 1; i <= count; i++) {
        const adj = randomElement(productAdjectives);
        const noun = randomElement(productNouns);
        const price = (Math.random() * 999 + 1).toFixed(2);
        products.push({
            id: i,
            name: `${adj} ${noun} ${i}`,
            price: parseFloat(price)
        });
    }
    return products;
}

/**
 * Génère des commandes aléatoires (non virales).
 */
export function generateOrders(userCount, productCount, maxPerUser = 5) {
    const orders = [];
    for (let userId = 1; userId <= userCount; userId++) {
        const nbOrders = randomInt(0, maxPerUser);
        const productIds = randomDistinctInts(nbOrders, productCount);
        for (const pid of productIds) {
            orders.push({ user_id: userId, product_id: pid });
        }
    }
    return orders;
}

/**
 * Génère des relations follow.
 */
export function generateFollows(userCount, maxFollowers = 20) {
    const follows = [];
    for (let userId = 1; userId <= userCount; userId++) {
        const nbFollowers = randomInt(0, maxFollowers);
        const followerIds = randomDistinctInts(nbFollowers, userCount, userId);
        for (const fid of followerIds) {
            follows.push({ follower_id: fid, followee_id: userId });
        }
    }
    return follows;
}

/**
 * Construit un index des followers (followee -> [follower_ids]) à partir
 * du tableau de follows pour accélérer la traversée BFS.
 */
function buildFollowersIndex(follows) {
    const index = new Map();
    for (const { follower_id, followee_id } of follows) {
        if (!index.has(followee_id)) index.set(followee_id, []);
        index.get(followee_id).push(follower_id);
    }
    return index;
}

/**
 * Génère des commandes « virales » qui se propagent le long du graphe de followers.
 *
 * Pour chaque produit viral :
 *   1. On choisit un utilisateur « influenceur » comme racine.
 *   2. On lui fait acheter le produit.
 *   3. On parcourt ses followers en BFS. À chaque niveau, chaque follower a
 *      une probabilité `spreadProb` d'acheter le produit.
 *   4. Si un follower N'ACHÈTE PAS, on NE PROPAGE PAS vers ses propres followers
 *      (la branche est coupée).
 *   5. La probabilité décroit à chaque niveau (spreadProb *= decay).
 *
 * @param {Array} follows        - le tableau de relations follow déjà généré
 * @param {number} userCount     - nombre total d'utilisateurs
 * @param {number} productCount  - nombre total de produits
 * @param {object} opts
 * @param {number} opts.viralProductCount - nombre de produits viraux à simuler (défaut: 5)
 * @param {number} opts.maxSeedUsers      - nombre d'influenceurs racines par produit (défaut: 3)
 * @param {number} opts.spreadProb        - probabilité de base qu'un follower achète (défaut: 0.7)
 * @param {number} opts.decay             - facteur de décroissance par niveau (défaut: 0.85)
 * @param {number} opts.maxDepth          - profondeur max de propagation (défaut: 6)
 * @returns {{ orders: Array<{user_id, product_id}>, viralProductIds: number[], seedUserIds: number[] }}
 */
export function generateViralOrders(follows, userCount, productCount, opts = {}) {
    const {
        viralProductCount = 5,
        maxSeedUsers = 3,
        spreadProb = 0.7,
        decay = 0.85,
        maxDepth = 6,
    } = opts;

    const followersIndex = buildFollowersIndex(follows);
    const orders = [];
    const orderSet = new Set(); // pour dédupliquer (user_id, product_id)

    const addOrder = (userId, productId) => {
        const key = `${userId}_${productId}`;
        if (!orderSet.has(key)) {
            orderSet.add(key);
            orders.push({ user_id: userId, product_id: productId });
        }
    };

    // Choisir les produits viraux (les premiers IDs pour qu'ils soient faciles à trouver)
    const viralProductIds = [];
    for (let i = 0; i < Math.min(viralProductCount, productCount); i++) {
        viralProductIds.push(i + 1);
    }

    // Choisir des utilisateurs « influenceurs » qui ont beaucoup de followers
    // On trie par nombre de followers décroissant et on prend les tops
    const usersByFollowerCount = [];
    for (const [userId, followers] of followersIndex.entries()) {
        usersByFollowerCount.push({ userId, count: followers.length });
    }
    usersByFollowerCount.sort((a, b) => b.count - a.count);
    const topInfluencers = usersByFollowerCount.slice(0, maxSeedUsers * viralProductCount * 2);

    const seedUserIds = [];

    for (const productId of viralProductIds) {
        // Prendre maxSeedUsers influenceurs distincts pour ce produit
        const seeds = [];
        for (const inf of topInfluencers) {
            if (seeds.length >= maxSeedUsers) break;
            if (!seeds.includes(inf.userId)) {
                seeds.push(inf.userId);
            }
        }

        for (const seedUserId of seeds) {
            if (!seedUserIds.includes(seedUserId)) seedUserIds.push(seedUserId);

            // L'influenceur achète le produit
            addOrder(seedUserId, productId);

            // BFS orienté : propager le long des followers
            let currentLevel = [seedUserId];
            const visited = new Set([seedUserId]);
            let prob = spreadProb;

            for (let depth = 0; depth < maxDepth; depth++) {
                const nextLevel = [];
                for (const uid of currentLevel) {
                    const followers = followersIndex.get(uid) || [];
                    for (const fid of followers) {
                        if (visited.has(fid)) continue;
                        visited.add(fid);

                        if (Math.random() < prob) {
                            // Ce follower achète → on continue la propagation
                            addOrder(fid, productId);
                            nextLevel.push(fid);
                        }
                        // Sinon : branche coupée, on ne propage pas via ce follower
                    }
                }
                if (nextLevel.length === 0) break;
                currentLevel = nextLevel;
                prob *= decay; // la probabilité décroit avec la profondeur
            }
        }
    }

    console.log(`[DataGen] ${viralProductIds.length} produits viraux generés, ${orders.length} commandes virales, seeds: [${seedUserIds.join(', ')}]`);

    return { orders, viralProductIds, seedUserIds };
}
