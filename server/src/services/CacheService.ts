import { logger } from '@/utils/logger.js';
import { CacheEntry } from '@/types/index.js';

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 300; // 5 minutes default TTL

  constructor() {
    // Start cleanup interval to remove expired entries
    this.startCleanupInterval();
    logger.info('Cache service initialized');
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp + (entry.ttl * 1000) < now) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cache cleanup: removed ${removedCount} expired entries`);
    }
  }

  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    const timestamp = Date.now();

    const entry: CacheEntry<T> = {
      data: value,
      timestamp,
      ttl,
    };

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
  }

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if entry has expired
    if (entry.timestamp + (entry.ttl * 1000) < Date.now()) {
      this.cache.delete(key);
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.data as T;
  }

  public async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.timestamp + (entry.ttl * 1000) < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache delete: ${key}`);
    }
    return deleted;
  }

  public async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  public async keys(): Promise<string[]> {
    // Clean up expired entries first
    this.cleanup();
    return Array.from(this.cache.keys());
  }

  public async size(): Promise<number> {
    // Clean up expired entries first
    this.cleanup();
    return this.cache.size;
  }

  public async getStats(): Promise<{
    size: number;
    totalEntries: number;
    expiredEntries: number;
    memoryUsage: string;
  }> {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp + (entry.ttl * 1000) < now) {
        expiredCount++;
      }
      // Rough estimate of memory usage
      totalSize += key.length + JSON.stringify(entry.data).length + 100; // 100 bytes overhead
    }

    return {
      size: this.cache.size - expiredCount,
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      memoryUsage: this.formatBytes(totalSize),
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Test basic cache operations
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 1);
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      return retrieved !== null;
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return false;
    }
  }

  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  public async setIfNotExists<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    const exists = await this.has(key);
    
    if (exists) {
      return false;
    }

    await this.set(key, value, ttlSeconds);
    return true;
  }

  public async extend(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.timestamp + (entry.ttl * 1000) < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    // Extend the TTL by updating timestamp
    entry.timestamp = Date.now();
    entry.ttl = ttlSeconds;
    
    logger.debug(`Cache TTL extended: ${key} (new TTL: ${ttlSeconds}s)`);
    return true;
  }

  public async getWithTTL<T>(key: string): Promise<{ value: T; ttl: number } | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (entry.timestamp + (entry.ttl * 1000) < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    const expiresAt = entry.timestamp + (entry.ttl * 1000);
    const remainingTTL = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    
    return {
      value: entry.data as T,
      ttl: remainingTTL,
    };
  }

  public shutdown(): void {
    logger.info('Shutting down cache service...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.cache.clear();
    logger.info('Cache service shutdown complete');
  }
}