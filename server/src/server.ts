import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import { errorHandler } from '@/middleware/errorHandler.js';
import { authMiddleware } from '@/middleware/auth.js';
import veeamRoutes from '@/routes/veeam.js';
import authRoutes from '@/routes/auth.js';
import dashboardRoutes, { setServices } from '@/routes/dashboard.js';
import settingsRoutes from '@/routes/settings.js';
import databaseRoutes from '@/routes/database.js';
import reportsRoutes, { setReportServices } from '@/routes/reports.js';
import scheduledReportsRoutes, { setScheduledReportService } from '@/routes/scheduled-reports.js';
import whatsappRoutes from '@/routes/whatsapp.js';
import { VeeamService } from '@/services/VeeamService.js';
import { MockVeeamService } from '@/services/MockVeeamService.js';
import { WebSocketService } from '@/services/WebSocketService.js';
import { CacheService } from '@/services/CacheService.js';
import { AlertService } from '@/services/AlertService.js';
import { MonitoringService } from '@/services/MonitoringService.js';
import { ScheduledReportService } from '@/services/ScheduledReportService.js';
import { initializeDatabase, checkDatabaseHealth } from '@/services/database.js';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - try .env first, then .env.production
const envPath = path.resolve(__dirname, '..', '.env');
const envProductionPath = path.resolve(__dirname, '..', '.env.production');

try {
  dotenv.config({ path: envPath });
} catch (error) {
  dotenv.config({ path: envProductionPath });
}

const app = express();
const server = createServer(app);

// Trust proxy for nginx reverse proxy
app.set('trust proxy', true);

// Rate limiting - temporarily disabled due to proxy configuration issues
// const limiter = rateLimit({
//   windowMs: config.rateLimitWindowMs,
//   max: config.rateLimitMaxRequests,
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   validate: false, // Disable all validations
// });

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// app.use(limiter); // Temporarily disabled

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API Health endpoint for nginx proxy
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/veeam', authMiddleware, veeamRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/scheduled-reports', authMiddleware, scheduledReportsRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize services
const veeamService = (!config.veeamPassword || config.veeamPassword === 'your_veeam_password_here') 
  ? new MockVeeamService() 
  : new VeeamService();

if (veeamService instanceof MockVeeamService) {
  logger.info('Using MockVeeamService for development');
}

const wsService = new WebSocketService(server);
const cacheService = new CacheService();
const alertService = new AlertService(wsService, cacheService);
const monitoringService = new MonitoringService(veeamService, wsService, cacheService, alertService);
const scheduledReportService = new ScheduledReportService(alertService);

// Set services for dashboard routes
setServices(alertService, monitoringService);

// Set services for reports routes
setReportServices(veeamService, monitoringService);

// Set services for scheduled reports routes
setScheduledReportService(scheduledReportService);

// Initialize database connection
try {
  await initializeDatabase();
  const dbHealthy = await checkDatabaseHealth();
  if (dbHealthy) {
    logger.info('Database connection established successfully');
  } else {
    logger.warn('Database health check failed');
  }
} catch (error) {
  logger.error('Failed to initialize database:', error);
  logger.warn('Application will continue with environment variable fallback');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    await wsService.shutdown();
    
    // Stop monitoring service
    await monitoringService.stop();
    
    // Stop scheduled report service
    scheduledReportService.stop();
    
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close WebSocket connections
    await wsService.shutdown();
    
    // Stop monitoring service
    await monitoringService.stop();
    
    // Stop scheduled report service
    scheduledReportService.stop();
    
    process.exit(0);
  });
});

// Start server
server.listen(config.port, () => {
  logger.info(`🚀 Server running on port ${config.port}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 CORS Origin: ${config.corsOrigin}`);
  
  // Initialize monitoring
  monitoringService.start();
  
  // Initialize scheduled reports
  scheduledReportService.start();
  
  logger.info('✅ Veeam Insight Dashboard Backend Started Successfully');
});

export { app, server };