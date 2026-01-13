const NodeCache = require("node-cache");

/**
 * Centralized cache manager with invalidation strategies
 * Provides consistent caching across the application
 */
class CacheManager {
  constructor() {
    // Different cache stores with appropriate TTLs
    this.caches = {
      // Product data cache - 5 minutes
      products: new NodeCache({ stdTTL: 300, checkperiod: 60 }),
      
      // Profile data cache - 1 minute (frequently updated)
      profiles: new NodeCache({ stdTTL: 60, checkperiod: 30 }),
      
      // Relation ID mapping cache - 6 hours (rarely changes)
      relations: new NodeCache({ stdTTL: 6 * 60 * 60, checkperiod: 600 }),
      
      // Anti-replay cache - 10 minutes
      antiReplay: new NodeCache({ stdTTL: 10 * 60, checkperiod: 60 }),
      
      // Page data cache - 3 minutes
      pages: new NodeCache({ stdTTL: 3 * 60, checkperiod: 60 }),
      
      // Shuffle order cache - 15 minutes
      shuffle: new NodeCache({ stdTTL: 15 * 60, checkperiod: 120 }),
      
      // PocketBase snapshot cache - 5 minutes
      pbSnapshot: new NodeCache({ stdTTL: 5 * 60, checkperiod: 60 }),
    };

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };

    // Setup event listeners for monitoring
    this._setupEventListeners();
  }

  _setupEventListeners() {
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.on("expired", (key, value) => {
        console.log(`[Cache:${name}] Expired: ${key}`);
      });
      
      cache.on("del", (key, value) => {
        this.stats.deletes++;
      });
    });
  }

  /**
   * Get value from cache
   */
  get(cacheName, key) {
    const cache = this.caches[cacheName];
    if (!cache) {
      console.warn(`[CacheManager] Unknown cache: ${cacheName}`);
      return undefined;
    }

    const value = cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  /**
   * Set value in cache
   */
  set(cacheName, key, value, ttl) {
    const cache = this.caches[cacheName];
    if (!cache) {
      console.warn(`[CacheManager] Unknown cache: ${cacheName}`);
      return false;
    }

    this.stats.sets++;
    return cache.set(key, value, ttl);
  }

  /**
   * Delete specific key from cache
   */
  del(cacheName, key) {
    const cache = this.caches[cacheName];
    if (!cache) {
      console.warn(`[CacheManager] Unknown cache: ${cacheName}`);
      return 0;
    }

    return cache.del(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(cacheName, pattern) {
    const cache = this.caches[cacheName];
    if (!cache) {
      console.warn(`[CacheManager] Unknown cache: ${cacheName}`);
      return 0;
    }

    const keys = cache.keys();
    const regex = new RegExp(pattern);
    const matchingKeys = keys.filter((key) => regex.test(key));
    
    if (matchingKeys.length > 0) {
      console.log(`[CacheManager] Invalidating ${matchingKeys.length} keys matching: ${pattern}`);
      cache.del(matchingKeys);
    }
    
    return matchingKeys.length;
  }

  /**
   * Invalidate all product-related caches
   */
  invalidateProducts() {
    console.log("[CacheManager] Invalidating all product caches");
    this.caches.products.flushAll();
    this.caches.pages.flushAll();
    this.caches.pbSnapshot.flushAll();
    this.caches.shuffle.flushAll();
  }

  /**
   * Invalidate profile cache for specific user
   */
  invalidateProfile(telegramId) {
    console.log(`[CacheManager] Invalidating profile cache for user: ${telegramId}`);
    this.invalidatePattern("profiles", `.*${telegramId}.*`);
  }

  /**
   * Invalidate relation cache (brands/categories)
   */
  invalidateRelations() {
    console.log("[CacheManager] Invalidating relation caches");
    this.caches.relations.flushAll();
  }

  /**
   * Flush all caches
   */
  flushAll() {
    console.log("[CacheManager] Flushing all caches");
    Object.values(this.caches).forEach((cache) => cache.flushAll());
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    return {
      ...this.stats,
      hitRate: (hitRate * 100).toFixed(2) + "%",
      cacheStats: Object.entries(this.caches).reduce((acc, [name, cache]) => {
        acc[name] = {
          keys: cache.keys().length,
          stats: cache.getStats(),
        };
        return acc;
      }, {}),
    };
  }

  /**
   * Get cache health status
   */
  getHealth() {
    const stats = this.getStats();
    const totalKeys = Object.values(stats.cacheStats).reduce(
      (sum, cache) => sum + cache.keys,
      0
    );

    return {
      healthy: true,
      totalKeys,
      hitRate: stats.hitRate,
      caches: Object.keys(this.caches).length,
    };
  }
}

// Singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
