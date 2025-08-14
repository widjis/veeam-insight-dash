import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env.production file (fallback to .env)
const envPath = path.resolve(__dirname, '..', '..', '.env');
const envProductionPath = path.resolve(__dirname, '..', '..', '.env.production');

// Try to load .env first, then fallback to .env.production
let envLoaded = false;
try {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log('✅ Loaded environment from .env file');
    envLoaded = true;
  }
} catch (error) {
  console.log('⚠️  .env file not found, trying .env.production');
}

if (!envLoaded) {
  try {
    const result = dotenv.config({ path: envProductionPath });
    if (!result.error) {
      console.log('✅ Loaded environment from .env.production file');
    } else {
      console.warn('⚠️  Failed to load .env.production:', result.error);
    }
  } catch (error) {
    console.error('❌ Failed to load any environment file:', error);
  }
}

// Debug: Check if VEEAM_PASSWORD is loaded
console.log('🔍 VEEAM_PASSWORD loaded:', process.env.VEEAM_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('🔍 Environment file paths:');
console.log('   .env:', envPath);
console.log('   .env.production:', envProductionPath);

interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  veeamBaseUrl: string;
  veeamApiVersion: string;
  veeamUsername: string;
  veeamPassword: string;
  veeamVerifySSL: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  refreshTokenExpiresIn: string;
  cacheTTL: number;
  cacheCheckPeriod: number;

  logLevel: string;
  logFile: string;
  wsPort: number;
  monitoringInterval: number;
  alertCheckInterval: number;
  healthCheckInterval: number;
  metricsInterval: number;
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
  whatsappChatId?: string;
  whatsappEnabled: boolean;
  whatsappDefaultRecipients: string[];
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  
  // Veeam API Configuration
  veeamBaseUrl: process.env.VEEAM_BASE_URL || 'https://10.60.10.128:9419',
  veeamApiVersion: process.env.VEEAM_API_VERSION || '1.1-rev1',
  veeamUsername: process.env.VEEAM_USERNAME || 'admin.it',
  veeamPassword: process.env.VEEAM_PASSWORD || '',
  veeamVerifySSL: process.env.VEEAM_VERIFY_SSL === 'true',
  
  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // Cache Configuration
  cacheTTL: parseInt(process.env.CACHE_TTL || '300', 10),
  cacheCheckPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10),
  
  // Rate Limiting

  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || 'logs/app.log',
  
  // WebSocket Configuration
  wsPort: parseInt(process.env.WS_PORT || '3002', 10),
  
  // Monitoring Configuration
  monitoringInterval: parseInt(process.env.MONITORING_INTERVAL || '30000', 10),
  alertCheckInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '60000', 10),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30', 10),
  metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60', 10),
  
  // WhatsApp Integration
  whatsappApiUrl: process.env.WHATSAPP_API_URL,
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN,
  whatsappChatId: process.env.WHATSAPP_CHAT_ID,
  whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
  whatsappDefaultRecipients: process.env.WHATSAPP_DEFAULT_RECIPIENTS ? process.env.WHATSAPP_DEFAULT_RECIPIENTS.split(',').map(r => r.trim()) : [],
};

// Validate required environment variables
if (!config.veeamPassword) {
  console.warn('⚠️  VEEAM_PASSWORD not set in environment variables');
}

if (config.jwtSecret === 'your-secret-key-change-in-production') {
  console.warn('⚠️  Using default JWT_SECRET - change this in production!');
}

export default config;