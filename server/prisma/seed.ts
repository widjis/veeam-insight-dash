import { PrismaClient } from '../src/generated/prisma';
import { configService } from '../src/services/configService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Initialize default configurations
    console.log('📝 Creating default configurations...');
    await configService.initializeDefaultConfigs();

    // Create default system settings
    console.log('⚙️ Creating system settings...');
    const systemSettings = [
      {
        category: 'general',
        key: 'app_name',
        value: 'Veeam Insight Dashboard',
        description: 'Application name displayed in the UI'
      },
      {
        category: 'general',
        key: 'app_version',
        value: '1.0.0',
        description: 'Current application version'
      },
      {
        category: 'general',
        key: 'maintenance_mode',
        value: 'false',
        description: 'Enable/disable maintenance mode'
      },
      {
        category: 'monitoring',
        key: 'refresh_interval',
        value: '30',
        description: 'Data refresh interval in seconds'
      },
      {
        category: 'monitoring',
        key: 'alert_threshold',
        value: '85',
        description: 'Alert threshold percentage for resource usage'
      },
      {
        category: 'ui',
        key: 'theme',
        value: 'light',
        description: 'Default UI theme (light/dark)'
      },
      {
        category: 'ui',
        key: 'items_per_page',
        value: '25',
        description: 'Default number of items per page in tables'
      },
      {
        category: 'security',
        key: 'session_timeout',
        value: '3600',
        description: 'Session timeout in seconds'
      },
      {
        category: 'security',
        key: 'max_login_attempts',
        value: '5',
        description: 'Maximum login attempts before account lockout'
      },
      {
        category: 'backup',
        key: 'retention_days',
        value: '30',
        description: 'Default backup retention period in days'
      }
    ];

    for (const setting of systemSettings) {
      await prisma.systemConfig.upsert({
        where: {
          category_key: {
            category: setting.category,
            key: setting.key
          }
        },
        update: {
          value: setting.value,
          description: setting.description
        },
        create: setting
      });
    }

    // Create sample Veeam configurations
    console.log('🔧 Creating sample Veeam configurations...');
    const veeamConfigs = [
      {
        name: 'Production Veeam Server',
        baseUrl: 'https://veeam-prod.company.com:9419',
        username: 'admin',
        password: 'encrypted_password_here',
        isActive: true,
        description: 'Main production Veeam Backup & Replication server'
      },
      {
        name: 'DR Veeam Server',
        baseUrl: 'https://veeam-dr.company.com:9419',
        username: 'admin',
        password: 'encrypted_password_here',
        isActive: false,
        description: 'Disaster recovery Veeam server'
      }
    ];

    for (const config of veeamConfigs) {
      await prisma.veeamConfig.upsert({
        where: { name: config.name },
        update: config,
        create: config
      });
    }

    // Create admin user if it doesn't exist
    console.log('👤 Creating admin user...');
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@company.com' },
      update: {},
      create: {
        email: 'admin@company.com',
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        isActive: true,
        passwordHash: '$2b$10$placeholder_hash_replace_in_production'
      }
    });

    // Create default user settings for admin
    console.log('🎨 Creating default user settings...');
    const userSettings = [
      {
        userId: adminUser.id,
        category: 'preferences',
        key: 'theme',
        value: 'dark'
      },
      {
        userId: adminUser.id,
        category: 'preferences',
        key: 'language',
        value: 'en'
      },
      {
        userId: adminUser.id,
        category: 'dashboard',
        key: 'default_view',
        value: 'overview'
      },
      {
        userId: adminUser.id,
        category: 'notifications',
        key: 'email_alerts',
        value: 'true'
      }
    ];

    for (const setting of userSettings) {
      await prisma.userSetting.upsert({
        where: {
          userId_category_key: {
            userId: setting.userId,
            category: setting.category,
            key: setting.key
          }
        },
        update: {
          value: setting.value
        },
        create: setting
      });
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - System settings: ${systemSettings.length}`);
    console.log(`   - Veeam configurations: ${veeamConfigs.length}`);
    console.log(`   - Users: 1 (admin)`);
    console.log(`   - User settings: ${userSettings.length}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });