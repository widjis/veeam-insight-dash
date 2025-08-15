import { PrismaClient } from '@prisma/client';
import { config } from '../config/environment.js';
import { SystemConfigService } from '../services/database.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

async function migrateSettingsToDatabase() {
  try {
    logger.info('Starting migration of settings from environment variables to database...');

    const migrations = [];

    // Migrate WhatsApp settings
    if (config.whatsappApiUrl) {
      migrations.push(
        systemConfigService.setConfig(
          'notifications',
          'whatsappApiUrl',
          config.whatsappApiUrl,
          'WhatsApp API URL',
          false,
          'migration'
        )
      );
    }
    
    // Migrate WhatsApp base URL configuration
    if (config.whatsappApiUrl) {
      migrations.push(
        systemConfigService.setConfig(
          'notifications',
          'whatsappApiUrl',
          config.whatsappApiUrl,
          'WhatsApp API URL',
          false,
          'migration'
        )
      );
    }

    if (config.whatsappApiToken) {
      migrations.push(
        systemConfigService.setConfig(
          'notifications',
          'whatsappApiToken',
          config.whatsappApiToken,
          'WhatsApp API Token',
          true,
          'migration'
        )
      );
    }

    if (config.whatsappChatId) {
      migrations.push(
        systemConfigService.setConfig(
          'notifications',
          'whatsappChatId',
          config.whatsappChatId,
          'WhatsApp Chat/Group ID',
          false,
          'migration'
        )
      );
    }

    migrations.push(
      systemConfigService.setConfig(
        'notifications',
        'whatsappEnabled',
        config.whatsappEnabled || false,
        'Enable WhatsApp notifications',
        false,
        'migration'
      )
    );

    if (config.whatsappDefaultRecipients && config.whatsappDefaultRecipients.length > 0) {
      migrations.push(
        systemConfigService.setConfig(
          'notifications',
          'whatsappDefaultRecipients',
          config.whatsappDefaultRecipients,
          'Default WhatsApp recipients',
          false,
          'migration'
        )
      );
    }

    // Migrate Veeam settings
    if (config.veeamBaseUrl) {
      migrations.push(
        systemConfigService.setConfig(
          'veeam',
          'baseUrl',
          config.veeamBaseUrl,
          'Veeam server base URL',
          false,
          'migration'
        )
      );
    }

    if (config.veeamUsername) {
      migrations.push(
        systemConfigService.setConfig(
          'veeam',
          'username',
          config.veeamUsername,
          'Veeam username',
          false,
          'migration'
        )
      );
    }

    if (config.veeamPassword) {
      migrations.push(
        systemConfigService.setConfig(
          'veeam',
          'password',
          config.veeamPassword,
          'Veeam password',
          true,
          'migration'
        )
      );
    }

    migrations.push(
      systemConfigService.setConfig(
        'veeam',
        'verifySSL',
        config.veeamVerifySSL,
        'Verify SSL certificates for Veeam connections',
        false,
        'migration'
      )
    );

    // Execute all migrations
    const results = await Promise.allSettled(migrations);
    
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        logger.error(`Migration ${index} failed:`, result.reason);
      }
    });

    logger.info(`Migration completed: ${successCount} successful, ${failureCount} failed`);
    
    if (failureCount > 0) {
      logger.warn('Some settings failed to migrate. Check logs for details.');
    } else {
      logger.info('All settings successfully migrated to database!');
    }

  } catch (error) {
    logger.error('Error during settings migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateSettingsToDatabase()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateSettingsToDatabase };