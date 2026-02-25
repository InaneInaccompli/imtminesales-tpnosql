/**
 * Classe abstraite définissant l'interface DAO.
 * Chaque implémentation (Postgres, Neo4j) doit implémenter toutes ces méthodes.
 */
class AbstractDAO {
    constructor() {
        if (this.constructor === AbstractDAO) {
            throw new Error("La classe abstraite AbstractDAO ne peut pas être instanciée directement.");
        }
    }

    // --- Connexion / Fermeture ---
    async connect() { throw new Error("Method 'connect()' must be implemented."); }
    async close() { throw new Error("Method 'close()' must be implemented."); }

    // --- Import de données ---
    async clearDatabase() { throw new Error("Method 'clearDatabase()' must be implemented."); }
    async importUsers(users) { throw new Error("Method 'importUsers()' must be implemented."); }
    async importProducts(products) { throw new Error("Method 'importProducts()' must be implemented."); }
    async importOrders(orders) { throw new Error("Method 'importOrders()' must be implemented."); }
    async importFollows(follows) { throw new Error("Method 'importFollows()' must be implemented."); }

    // --- Requêtes d'analyse ---

    /**
     * Obtenir la liste et le nombre des produits commandés par les cercles de followers
     * d'un individu (niveau 1 à N). Permet d'observer le rôle d'influenceur.
     * @param {number} userId
     * @param {number} level - Profondeur max du réseau social
     * @returns {Promise<Array<{name: string, count: number}>>}
     */
    async getTopProductsByFollowers(userId, level) {
        throw new Error("Method 'getTopProductsByFollowers()' must be implemented.");
    }

    /**
     * Même requête mais filtrée sur un produit spécifique.
     * Permet d'observer l'influence d'un individu suite à un "post" mentionnant un article.
     * @param {number} userId
     * @param {number} productId
     * @param {number} level - Profondeur max du réseau social
     * @returns {Promise<number>} Nombre de followers ayant commandé ce produit
     */
    async getProductFollowerCount(userId, productId, level) {
        throw new Error("Method 'getProductFollowerCount()' must be implemented.");
    }

    /**
     * Pour un produit donné, explorer toute la base afin de trouver le réseau
     * viral le plus étendu. La propagation est « orientée » : on ne traverse
     * un lien FOLLOWS que si le follower a lui-même commandé le produit ;
     * si un follower n'a pas commandé, la branche est coupée.
     *
     * La requête doit :
     *  1. Identifier les « racines » (acheteurs du produit qui ne sont followees
     *     d'aucun autre acheteur, ou tous les acheteurs comme candidats).
     *  2. Pour chaque racine, faire un BFS orienté sur le graphe de followers
     *     et compter les acheteurs par cercle (depth).
     *  3. Renvoyer la racine ayant le plus grand réseau viral, avec le détail
     *     par cercle.
     *
     * @param {number} productId
     * @param {number} maxLevel - Profondeur max de propagation
     * @returns {Promise<{rootUserId: number, circles: Array<{level: number, count: number}>, total: number}>}
     */
    async findViralNetwork(productId, maxLevel) {
        throw new Error("Method 'findViralNetwork()' must be implemented.");
    }
}

export default AbstractDAO;
