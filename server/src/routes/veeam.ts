import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { VeeamService } from '@/services/VeeamService.js';
import { MockVeeamService } from '@/services/MockVeeamService.js';
import { CacheService } from '@/services/CacheService.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/environment.js';
import {
  ApiResponse,
  VeeamJobState,
  VeeamRepositoryState,
  VeeamSession,
  VeeamInfrastructureServer
} from '@/types/index.js';

const router = Router();

// Rate limiting for Veeam API endpoints
const veeamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per minute
  message: {
    success: false,
    error: 'Too many Veeam API requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize services
// Use mock service if Veeam password is not configured
const veeamService = config.veeamPassword === 'your_veeam_password_here' || !config.veeamPassword 
  ? new MockVeeamService() 
  : new VeeamService();
const cacheService = new CacheService();

if (config.veeamPassword === 'your_veeam_password_here' || !config.veeamPassword) {
  logger.info('Using MockVeeamService - configure VEEAM_PASSWORD in .env for real Veeam API');
}

// Cache TTL in seconds
const CACHE_TTL = {
  jobs: 30, // 30 seconds
  repositories: 60, // 1 minute
  sessions: 30, // 30 seconds
  infrastructure: 300, // 5 minutes
  health: 60, // 1 minute
};

// Helper function to handle cached responses
async function getCachedOrFetch<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheService.get<T>(cacheKey);
  if (cached !== null) {
    logger.debug(`Cache hit for key: ${cacheKey}`);
    return cached as T;
  }

  // Fetch fresh data
  logger.debug(`Cache miss for key: ${cacheKey}, fetching fresh data`);
  const data = await fetchFunction();
  
  // Store in cache
  await cacheService.set(cacheKey, data, ttl);
  
  return data;
}

// GET /api/veeam/health - Check Veeam API health
router.get('/health', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const health = await getCachedOrFetch(
      'veeam:health',
      () => veeamService.healthCheck(),
      CACHE_TTL.health
    );

    const response: ApiResponse<typeof health> = {
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to check Veeam health:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to check Veeam API health',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// GET /api/veeam/jobs - Get all backup jobs
router.get('/jobs', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const jobsResponse = await getCachedOrFetch(
      'veeam:jobs',
      () => veeamService.getJobStates(),
      CACHE_TTL.jobs
    );

    // jobsResponse is already an ApiResponse, so return it directly
    if (jobsResponse.success) {
      res.json(jobsResponse);
    } else {
      res.status(500).json(jobsResponse);
    }
  } catch (error) {
    logger.error('Failed to fetch Veeam jobs:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch backup jobs',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/veeam/jobs/:id - Get specific job details
router.get('/jobs/:id', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobsResponse = await getCachedOrFetch(
      'veeam:jobs',
      () => veeamService.getJobStates(),
      CACHE_TTL.jobs
    );

    if (!jobsResponse.success) {
      return res.status(500).json(jobsResponse);
    }

    const job = (jobsResponse.data || []).find((j: VeeamJobState) => j.id === id);
    if (!job) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Job with ID ${id} not found`,
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<VeeamJobState> = {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to fetch job details:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch job details',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// GET /api/veeam/jobs/:id/sessions - Get job sessions
router.get('/jobs/:id/sessions', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '10', offset = '0' } = req.query;

    const sessionsResponse = await getCachedOrFetch(
      `veeam:job:${id}:sessions:${limit}:${offset}`,
      () => veeamService.getJobSessions(id),
      CACHE_TTL.sessions
    );

    const response: ApiResponse<VeeamSession[]> = {
      success: true,
      data: sessionsResponse.data,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error(`Failed to fetch sessions for job ${req.params.id}:`, error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch job sessions',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/veeam/repositories - Get all backup repositories
router.get('/repositories', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const repositoriesResponse = await getCachedOrFetch(
      'veeam:repositories',
      () => veeamService.getRepositoryStates(),
      CACHE_TTL.repositories
    );

    const response: ApiResponse<VeeamRepositoryState[]> = {
      success: true,
      data: repositoriesResponse.data,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch Veeam repositories:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch backup repositories',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/veeam/repositories/:id - Get specific repository details
router.get('/repositories/:id', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const repositoriesResponse = await getCachedOrFetch(
      'veeam:repositories',
      () => veeamService.getRepositoryStates(),
      CACHE_TTL.repositories
    );

    const repository = repositoriesResponse.data?.find((r: VeeamRepositoryState) => r.id === id);
    if (!repository) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Repository with ID ${id} not found`,
        timestamp: new Date().toISOString(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<VeeamRepositoryState> = {
      success: true,
      data: repository,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error(`Failed to fetch repository ${req.params.id}:`, error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch repository details',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

// GET /api/veeam/sessions - Get all sessions
router.get('/sessions', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const sessionsResponse = await getCachedOrFetch(
      `veeam:sessions:${limit}:${offset}`,
      () => veeamService.getSessions(),
      CACHE_TTL.sessions
    );

    const response: ApiResponse<VeeamSession[]> = {
      success: true,
      data: sessionsResponse.data,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch Veeam sessions:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch sessions',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/veeam/infrastructure - Get infrastructure servers
router.get('/infrastructure', veeamLimiter, async (req: Request, res: Response) => {
  try {
    const infrastructureResponse = await getCachedOrFetch(
      'veeam:infrastructure',
      () => veeamService.getInfrastructureServers(),
      CACHE_TTL.infrastructure
    );

    const response: ApiResponse<VeeamInfrastructureServer[]> = {
      success: true,
      data: infrastructureResponse.data,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch Veeam infrastructure:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch infrastructure servers',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// POST /api/veeam/cache/clear - Clear cache (admin only)
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    // In a real implementation, you'd check for admin role here
    // For now, we'll just clear the cache
    
    const { pattern } = req.body;
    
    if (pattern) {
      // Clear specific cache pattern
      const keys = Object.keys(cacheService['cache']).filter((key: string) => key.includes(pattern));
      keys.forEach((key: string) => cacheService.delete(key));
      
      logger.info(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
      
      const response: ApiResponse<{ cleared: number; pattern: string }> = {
        success: true,
        data: { cleared: keys.length, pattern },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } else {
      // Clear all cache
      cacheService.clear();
      
      logger.info('Cleared all cache entries');
      
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'All cache cleared' },
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    }
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// GET /api/veeam/cache/stats - Get cache statistics
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

export default router;