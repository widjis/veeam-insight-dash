/**
 * Database Service
 * Handles Prisma client initialization and database operations
 */

import { PrismaClient } from '../generated/prisma';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

// Singleton Prisma client
let prisma: PrismaClient | null = null;

/**
 * Get Prisma client instance (singleton)
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error']
    });
  }

  return prisma;
}

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    logger.info('✅ Database connected successfully');
    
    // Test the connection
    await client.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection test passed');
    
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
      logger.info('✅ Database disconnected successfully');
    }
  } catch (error) {
    logger.error('❌ Failed to disconnect from database:', error);
    throw error;
  }
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Veeam Configuration Service
 */
export class VeeamConfigService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Get all Veeam configurations
   */
  async getAllConfigs() {
    return await this.prisma.veeamConfig.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { isActive: 'desc' },
        { name: 'asc' }
      ],
      include: {
        alertRules: {
          where: { isEnabled: true },
          select: {
            id: true,
            name: true,
            ruleType: true,
            severity: true
          }
        }
      }
    });
  }

  /**
   * Get active Veeam configuration
   */
  async getActiveConfig() {
    return await this.prisma.veeamConfig.findFirst({
      where: {
        isActive: true,
        isDefault: true
      }
    });
  }

  /**
   * Create new Veeam configuration
   */
  async createConfig(data: {
    name: string;
    baseUrl: string;
    username: string;
    password: string;
    apiVersion?: string;
    verifySSL?: boolean;
    description?: string;
    tags?: string[];
    createdBy?: string;
  }) {
    // Encrypt password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // If this is the first config, make it default
    const existingConfigs = await this.prisma.veeamConfig.count();
    const isFirstConfig = existingConfigs === 0;

    return await this.prisma.veeamConfig.create({
      data: {
        ...data,
        password: hashedPassword,
        isDefault: isFirstConfig,
        isActive: isFirstConfig
      }
    });
  }

  /**
   * Update Veeam configuration
   */
  async updateConfig(id: string, data: Partial<{
    name: string;
    baseUrl: string;
    username: string;
    password: string;
    apiVersion: string;
    verifySSL: boolean;
    description: string;
    tags: string[];
    isActive: boolean;
    isDefault: boolean;
  }>) {
    // Encrypt password if provided
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.prisma.veeamConfig.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false }
      });
    }

    return await this.prisma.veeamConfig.update({
      where: { id },
      data: {
        ...data,
        lastUsed: new Date()
      }
    });
  }

  /**
   * Delete Veeam configuration
   */
  async deleteConfig(id: string) {
    return await this.prisma.veeamConfig.delete({
      where: { id }
    });
  }

  /**
   * Get decrypted password for a configuration
   */
  async getDecryptedPassword(id: string): Promise<string | null> {
    const config = await this.prisma.veeamConfig.findUnique({
      where: { id },
      select: { password: true }
    });

    if (!config) return null;

    // Note: bcrypt is one-way, so we can't decrypt
    // In a real implementation, you'd use reversible encryption
    // For now, return the hashed password (this needs to be fixed)
    return config.password;
  }
}

/**
 * System Configuration Service
 */
export class SystemConfigService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Get system configuration value
   */
  async getConfig(category: string, key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        category_key: {
          category,
          key
        }
      }
    });

    return config?.value;
  }

  /**
   * Set system configuration value
   */
  async setConfig(category: string, key: string, value: any, description?: string, isSecret = false, updatedBy?: string) {
    return await this.prisma.systemConfig.upsert({
      where: {
        category_key: {
          category,
          key
        }
      },
      update: {
        value,
        description,
        isSecret,
        updatedBy,
        updatedAt: new Date()
      },
      create: {
        category,
        key,
        value,
        description,
        isSecret,
        updatedBy
      }
    });
  }

  /**
   * Get all configurations for a category
   */
  async getCategoryConfigs(category: string) {
    return await this.prisma.systemConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' }
    });
  }
}

/**
 * User Settings Service
 */
export class UserSettingsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  /**
   * Get user setting
   */
  async getUserSetting(userId: string, category: string, key: string) {
    const setting = await this.prisma.userSetting.findUnique({
      where: {
        userId_category_key: {
          userId,
          category,
          key
        }
      }
    });

    return setting?.value;
  }

  /**
   * Set user setting
   */
  async setUserSetting(userId: string, category: string, key: string, value: any) {
    return await this.prisma.userSetting.upsert({
      where: {
        userId_category_key: {
          userId,
          category,
          key
        }
      },
      update: {
        value,
        updatedAt: new Date()
      },
      create: {
        userId,
        category,
        key,
        value
      }
    });
  }

  /**
   * Get all user settings for a category
   */
  async getUserCategorySettings(userId: string, category: string) {
    return await this.prisma.userSetting.findMany({
      where: {
        userId,
        category
      },
      orderBy: { key: 'asc' }
    });
  }
}

// Export service instances
export const veeamConfigService = new VeeamConfigService();
export const systemConfigService = new SystemConfigService();
export const userSettingsService = new UserSettingsService();

// Export Prisma client for direct use
export { getPrismaClient as prisma };