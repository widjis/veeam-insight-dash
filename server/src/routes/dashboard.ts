import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { VeeamService } from '@/services/VeeamService.js';
import { CacheService } from '@/services/CacheService.js';
import { AlertService } from '@/services/AlertService.js';
import { logger } from '@/utils/logger.js';
import {
  ApiResponse,
  DashboardStats,
  Alert,
  VeeamJobState,
  VeeamRepositoryState,
  VeeamSession,
  HealthCheck,
  PaginatedResponse
} from '@/types/index.js';

const router = Router();

// Rate limiting for dashboard endpoints
const dashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: {
    success: false,
    error: 'Too many dashboard requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize services
const veeamService = new VeeamService();
const cacheService = new CacheService();
// We'll initialize AlertService later when WebSocketService is available
let alertService: AlertService;

// Cache TTL in seconds
const CACHE_TTL = {
  stats: 30, // 30 seconds
  overview: 60, // 1 minute
  alerts: 15, // 15 seconds
  health: 30, // 30 seconds
};

// Helper function to calculate dashboard statistics
async function calculateDashboardStats(): Promise<DashboardStats> {
  try {
    // Fetch all required data
    const [jobsResponse, repositoriesResponse, sessionsResponse] = await Promise.all([
      veeamService.getJobStates(),
      veeamService.getRepositoryStates(),
      veeamService.getSessions(),
    ]);

    const jobs = jobsResponse.data || [];
    const repositories = repositoriesResponse.data || [];
    const sessions = sessionsResponse.data || [];

    // Calculate job statistics
    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(job => job.lastResult === 'Success').length;
    const failedJobs = jobs.filter(job => job.lastResult === 'Failed').length;
    const warningJobs = jobs.filter(job => job.lastResult === 'Warning').length;
    const runningJobs = jobs.filter(job => job.status === 'Running').length;

    // Calculate repository statistics
    const totalRepositories = repositories.length;
    const totalCapacity = repositories.reduce((sum, repo) => sum + (repo.capacityGB || 0), 0);
    const usedSpace = repositories.reduce((sum, repo) => sum + (repo.usedSpaceGB || 0), 0);
    const freeSpace = totalCapacity - usedSpace;
    const usagePercentage = totalCapacity > 0 ? (usedSpace / totalCapacity) * 100 : 0;

    // Calculate session statistics (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(session => 
      new Date(session.creationTime) > last24Hours
    );
    const successfulSessions = recentSessions.filter(session => session.result === 'Success').length;
    const failedSessions = recentSessions.filter(session => session.result === 'Failed').length;

    // Get active alerts (simplified for now)
    const activeAlerts: Alert[] = [];
    const criticalAlerts = 0;
    const warningAlerts = 0;

    return {
      totalJobs,
      activeJobs: runningJobs,
      successfulJobs,
      failedJobs,
      warningJobs,
      totalRepositories,
      totalCapacityTB: totalCapacity / 1024, // Convert GB to TB
      usedCapacityTB: usedSpace / 1024, // Convert GB to TB
      freeCapacityTB: freeSpace / 1024, // Convert GB to TB
      capacityUsagePercent: usagePercentage,
    };
  } catch (error) {
    logger.error('Failed to calculate dashboard stats:', error);
    throw error;
  }
}

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', dashboardLimiter, async (req: Request, res: Response) => {
  try {
    const stats = await cacheService.get<DashboardStats>('dashboard:stats');
    
    if (stats !== null) {
      const response: ApiResponse<DashboardStats> = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
      return res.json(response);
    }

    // Calculate fresh stats
    const freshStats = await calculateDashboardStats();
    cacheService.set('dashboard:stats', freshStats, CACHE_TTL.stats);

    const response: ApiResponse<DashboardStats> = {
      success: true,
      data: freshStats,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get dashboard stats:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve dashboard statistics',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// GET /api/dashboard/overview - Get dashboard overview
router.get('/overview', dashboardLimiter, async (req: Request, res: Response) => {
  try {
    const cached = cacheService.get('dashboard:overview');
    
    if (cached !== null) {
      const response: ApiResponse<typeof cached> = {
        success: true,
        data: cached,
        timestamp: new Date().toISOString(),
      };
      return res.json(response);
    }

    // Fetch overview data
    const [stats, recentJobs, recentSessions, activeAlerts] = await Promise.all([
      calculateDashboardStats(),
      veeamService.getJobStates().then(response => 
        (response.data || []).slice(0, 5) // Get last 5 jobs
      ),
      veeamService.getSessions().then(response => 
        (response.data || []).slice(0, 10) // Get last 10 sessions
      ),
      Promise.resolve([]), // Placeholder for alerts
    ]);

    const overview = {
      stats,
      recentJobs,
      recentSessions,
      activeAlerts,
      systemHealth: await veeamService.healthCheck(),
    };

    cacheService.set('dashboard:overview', overview, CACHE_TTL.overview);

    const response: ApiResponse<typeof overview> = {
      success: true,
      data: overview,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get dashboard overview:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve dashboard overview',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// GET /api/dashboard/alerts - Get active alerts
router.get('/alerts', dashboardLimiter, async (req: Request, res: Response) => {
  try {
    const { severity, limit = '20', offset = '0' } = req.query;
    
    // Placeholder for alerts functionality
    let alertsResponse = await Promise.resolve({
      success: true,
      data: [] as Alert[],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
      timestamp: new Date().toISOString(),
    } as PaginatedResponse<Alert>);
    
    let alerts = alertsResponse.data || [];
     
     // Filter by severity if specified
     if (severity && typeof severity === 'string') {
       alerts = alerts.filter((alert: Alert) => alert.severity === severity);
     }
     
     // Apply pagination
     const limitNum = parseInt(limit as string);
     const offsetNum = parseInt(offset as string);
     const paginatedAlerts = alerts.slice(offsetNum, offsetNum + limitNum);

    const response: ApiResponse<{
      alerts: Alert[];
      total: number;
      hasMore: boolean;
    }> = {
      success: true,
      data: {
        alerts: paginatedAlerts,
        total: alerts.length,
        hasMore: offsetNum + limitNum < alerts.length,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get dashboard alerts:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve alerts',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/dashboard/health - Get system health check
router.get('/health', dashboardLimiter, async (req: Request, res: Response) => {
  try {
    const cachedHealth = await cacheService.get<HealthCheck>('dashboard:health');
    
    if (cachedHealth !== null) {
      const response: ApiResponse<HealthCheck> = {
        success: true,
        data: cachedHealth,
        timestamp: new Date().toISOString(),
      };
      return res.json(response);
    }

    // Perform health checks
    const veeamHealth = await veeamService.healthCheck();
    const cacheHealth = true; // Placeholder for cache health check
    
    const healthCheck: HealthCheck = {
      service: 'veeam-dashboard',
      status: veeamHealth && cacheHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        veeam: veeamHealth ? 'healthy' : 'unhealthy',
        cache: cacheHealth ? 'healthy' : 'unhealthy',
        database: 'healthy', // Placeholder for future database health check
        uptime: process.uptime(),
      },
    };

    cacheService.set('dashboard:health', healthCheck, CACHE_TTL.health);

    const response: ApiResponse<HealthCheck> = {
      success: true,
      data: healthCheck,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get system health:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve system health',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// POST /api/dashboard/refresh - Force refresh dashboard data
router.post('/refresh', dashboardLimiter, async (req: Request, res: Response) => {
  try {
    // Clear dashboard-related cache
    const dashboardKeys = Object.keys(cacheService['cache']).filter((key: string) => 
      key.startsWith('dashboard:')
    );
    
    dashboardKeys.forEach((key: string) => cacheService.delete(key));
    
    // Recalculate stats
    const freshStats = await calculateDashboardStats();
    cacheService.set('dashboard:stats', freshStats, CACHE_TTL.stats);

    logger.info('Dashboard data refreshed successfully');

    const response: ApiResponse<{ message: string; refreshedAt: string }> = {
      success: true,
      data: {
        message: 'Dashboard data refreshed successfully',
        refreshedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to refresh dashboard data:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to refresh dashboard data',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

export default router;