/**
 * Configuration Service
 * Provides configuration management with database storage and environment variable fallback
 */

import { systemConfigService, veeamConfigService } from './database';
import { logger } from '../utils/logger';
import config from '../config/environment';

export interface VeeamConnectionConfig {
  baseUrl: string;
  username: string;
  password: string;
  apiVersion: string;
  verifySSL: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface NotificationConfig {
  whatsapp: {
    enabled: boolean;
    apiUrl?: string;
    apiToken?: string;
    chatId?: string;
    defaultRecipients?: string[];
  };
  email: {
    enabled: boolean;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
  webhook: {
    enabled: boolean;
    defaultUrl?: string;
  };
}

export interface MonitoringConfig {
  interval: number;
  alertCheckInterval: number;
  healthCheckInterval: number;
  metricsInterval: number;
}

class ConfigService {
  private cache = new Map<string, { value: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get configuration value with database fallback to environment variables
   */
  private async getConfigValue(category: string, key: string, envKey?: string, defaultValue?: any): Promise<any> {
    const cacheKey = `${category}:${key}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached value if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    try {
      // Try to get from database first
      const dbValue = await systemConfigService.getConfig(category, key);
      
      if (dbValue !== undefined && dbValue !== null) {
        this.cache.set(cacheKey, { value: dbValue, timestamp: Date.now() });
        return dbValue;
      }
    } catch (error) {
      logger.warn(`Failed to get config from database for ${category}:${key}:`, error);
    }

    // Fallback to environment variable
    const envValue = envKey ? process.env[envKey] : undefined;
    if (envValue !== undefined) {
      const parsedValue = this.parseEnvValue(envValue);
      this.cache.set(cacheKey, { value: parsedValue, timestamp: Date.now() });
      return parsedValue;
    }

    // Return default value
    if (defaultValue !== undefined) {
      this.cache.set(cacheKey, { value: defaultValue, timestamp: Date.now() });
      return defaultValue;
    }

    return null;
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): any {
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Number values
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    
    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim());
    }
    
    // JSON values
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        // If JSON parsing fails, return as string
      }
    }
    
    return value;
  }

  /**
   * Set configuration value in database
   */
  async setConfig(category: string, key: string, value: any, description?: string, isSecret = false, updatedBy?: string): Promise<void> {
    try {
      await systemConfigService.setConfig(category, key, value, description, isSecret, updatedBy);
      
      // Update cache
      const cacheKey = `${category}:${key}`;
      this.cache.set(cacheKey, { value, timestamp: Date.now() });
      
      logger.info(`Configuration updated: ${category}:${key}`);
    } catch (error) {
      logger.error(`Failed to set config ${category}:${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Configuration cache cleared');
  }

  /**
   * Get Veeam connection configuration
   */
  async getVeeamConfig(): Promise<VeeamConnectionConfig> {
    try {
      // Try to get active configuration from database
      const dbConfig = await veeamConfigService.getActiveConfig();
      
      if (dbConfig) {
        logger.info(`Using Veeam configuration from database: ${dbConfig.name}`);
        
        return {
          baseUrl: dbConfig.baseUrl,
          username: dbConfig.username,
          password: dbConfig.password, // Note: This is hashed, needs proper decryption
          apiVersion: dbConfig.apiVersion,
          verifySSL: dbConfig.verifySSL,
          timeout: dbConfig.timeout,
          retryAttempts: dbConfig.retryAttempts,
          retryDelay: dbConfig.retryDelay
        };
      }
    } catch (error) {
      logger.warn('Failed to get Veeam config from database, falling back to environment variables:', error);
    }

    // Fallback to environment variables
    logger.info('Using Veeam configuration from environment variables');
    
    return {
      baseUrl: config.veeamBaseUrl,
      username: config.veeamUsername,
      password: config.veeamPassword,
      apiVersion: config.veeamApiVersion,
      verifySSL: config.veeamVerifySSL,
      timeout: await this.getConfigValue('veeam', 'timeout', 'VEEAM_TIMEOUT', 30000),
      retryAttempts: await this.getConfigValue('veeam', 'retryAttempts', 'VEEAM_RETRY_ATTEMPTS', 3),
      retryDelay: await this.getConfigValue('veeam', 'retryDelay', 'VEEAM_RETRY_DELAY', 5000)
    };
  }

  /**
   * Get notification configuration
   */
  async getNotificationConfig(): Promise<NotificationConfig> {
    return {
      whatsapp: {
        enabled: await this.getConfigValue('notifications', 'whatsappEnabled', 'WHATSAPP_ENABLED', false),
        apiUrl: await this.getConfigValue('notifications', 'whatsappApiUrl', 'WHATSAPP_API_URL'),
        apiToken: await this.getConfigValue('notifications', 'whatsappApiToken', 'WHATSAPP_API_TOKEN'),
        chatId: await this.getConfigValue('notifications', 'whatsappChatId', 'WHATSAPP_CHAT_ID'),
        defaultRecipients: await this.getConfigValue('notifications', 'whatsappDefaultRecipients', 'WHATSAPP_DEFAULT_RECIPIENTS', [])
      },
      email: {
        enabled: await this.getConfigValue('notifications', 'emailEnabled', 'EMAIL_ENABLED', false),
        host: await this.getConfigValue('notifications', 'emailHost', 'EMAIL_HOST'),
        port: await this.getConfigValue('notifications', 'emailPort', 'EMAIL_PORT', 587),
        user: await this.getConfigValue('notifications', 'emailUser', 'EMAIL_USER'),
        password: await this.getConfigValue('notifications', 'emailPassword', 'EMAIL_PASS')
      },
      webhook: {
        enabled: await this.getConfigValue('notifications', 'webhookEnabled', 'WEBHOOK_ENABLED', false),
        defaultUrl: await this.getConfigValue('notifications', 'webhookDefaultUrl', 'WEBHOOK_DEFAULT_URL')
      }
    };
  }

  /**
   * Get monitoring configuration
   */
  async getMonitoringConfig(): Promise<MonitoringConfig> {
    return {
      interval: await this.getConfigValue('monitoring', 'interval', 'MONITORING_INTERVAL', 30000),
      alertCheckInterval: await this.getConfigValue('monitoring', 'alertCheckInterval', 'ALERT_CHECK_INTERVAL', 60000),
      healthCheckInterval: await this.getConfigValue('monitoring', 'healthCheckInterval', 'HEALTH_CHECK_INTERVAL', 30000),
      metricsInterval: await this.getConfigValue('monitoring', 'metricsInterval', 'METRICS_INTERVAL', 60000)
    };
  }

  /**
   * Initialize default configurations in database
   */
  async initializeDefaultConfigs(): Promise<void> {
    try {
      logger.info('Initializing default configurations in database...');

      // Initialize Veeam configuration if none exists
      const existingVeeamConfigs = await veeamConfigService.getAllConfigs();
      
      if (existingVeeamConfigs.length === 0 && config.veeamBaseUrl && config.veeamUsername) {
        logger.info('Creating default Veeam configuration from environment variables');
        
        await veeamConfigService.createConfig({
          name: 'Default Veeam Server',
          baseUrl: config.veeamBaseUrl,
          username: config.veeamUsername,
          password: config.veeamPassword,
          apiVersion: config.veeamApiVersion,
          verifySSL: config.veeamVerifySSL,
          description: 'Default configuration created from environment variables',
          tags: ['default', 'environment'],
          createdBy: 'system'
        });
      }

      // Initialize system configurations
      const defaultConfigs = [
        // Monitoring settings
        { category: 'monitoring', key: 'interval', value: 30000, description: 'Monitoring interval in milliseconds' },
        { category: 'monitoring', key: 'alertCheckInterval', value: 60000, description: 'Alert check interval in milliseconds' },
        { category: 'monitoring', key: 'healthCheckInterval', value: 30000, description: 'Health check interval in milliseconds' },
        { category: 'monitoring', key: 'metricsInterval', value: 60000, description: 'Metrics collection interval in milliseconds' },
        
        // Notification settings
        { category: 'notifications', key: 'whatsappEnabled', value: false, description: 'Enable WhatsApp notifications' },
        { category: 'notifications', key: 'emailEnabled', value: false, description: 'Enable email notifications' },
        { category: 'notifications', key: 'webhookEnabled', value: false, description: 'Enable webhook notifications' },
        
        // Cache settings
        { category: 'cache', key: 'ttl', value: 300, description: 'Default cache TTL in seconds' },
        { category: 'cache', key: 'checkPeriod', value: 600, description: 'Cache check period in seconds' },
        
        // Security settings
        { category: 'security', key: 'maxLoginAttempts', value: 5, description: 'Maximum login attempts before lockout' },
        { category: 'security', key: 'lockoutDuration', value: 900, description: 'Account lockout duration in seconds' },
        
        // UI settings
        { category: 'ui', key: 'refreshInterval', value: 30, description: 'Dashboard refresh interval in seconds' },
        { category: 'ui', key: 'theme', value: 'light', description: 'Default UI theme' },
        { category: 'ui', key: 'itemsPerPage', value: 20, description: 'Default items per page in tables' }
      ];

      for (const configItem of defaultConfigs) {
        try {
          const existing = await systemConfigService.getConfig(configItem.category, configItem.key);
          if (existing === undefined || existing === null) {
            await systemConfigService.setConfig(
              configItem.category,
              configItem.key,
              configItem.value,
              configItem.description,
              false,
              'system'
            );
          }
        } catch (error) {
          logger.warn(`Failed to initialize config ${configItem.category}:${configItem.key}:`, error);
        }
      }

      logger.info('✅ Default configurations initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize default configurations:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const configService = new ConfigService();
export default configService;