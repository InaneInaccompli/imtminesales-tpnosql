class AbstractDAO {
  constructor() {
    if (this.constructor === AbstractDAO) {
      throw new Error("Abstract class cannot be instantiated");
    }
  }

  async connect() { throw new Error("Method 'connect()' must be implemented."); }
  async close() { throw new Error("Method 'close()' must be implemented."); }
  async clearDatabase() { throw new Error("Method 'clearDatabase()' must be implemented."); }
  async importUsers(users) { throw new Error("Method 'importUsers()' must be implemented."); }
  async importProducts(products) { throw new Error("Method 'importProducts()' must be implemented."); }
  async importOrders(orders) { throw new Error("Method 'importOrders()' must be implemented."); }
  async importFollows(follows) { throw new Error("Method 'importFollows()' must be implemented."); }
  
  // Analyses
  async getTopProductsByFollowers(userId, level) { throw new Error("Method implemented."); }
  async getProductFollowerCount(userId, productId, level) { throw new Error("Method implemented."); }
  async getViralProductCount(userId, productId, level) { throw new Error("Method implemented."); }
}

export default AbstractDAO;
