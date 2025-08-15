/**
 * Database Routes
 * API endpoints for managing database-stored configurations
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { veeamConfigService, systemConfigService, userSettingsService } from '../services/database';
import { configService } from '../services/configService';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/api';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authMiddleware);

// ============================================================================
// VEEAM CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/database/veeam-configs
 * Get all Veeam configurations
 */
router.get('/veeam-configs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const configs = await veeamConfigService.getAllConfigs();
    
    // Remove sensitive data from response
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      password: '[HIDDEN]'
    }));

    const response: ApiResponse<typeof sanitizedConfigs> = {
      success: true,
      data: sanitizedConfigs,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get Veeam configurations:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve Veeam configurations',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/database/veeam-configs/active
 * Get active Veeam configuration
 */
router.get('/veeam-configs/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await veeamConfigService.getActiveConfig();
    
    if (!config) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No active Veeam configuration found',
        timestamp: new Date().toISOString()
      };
      return res.status(404).json(response);
    }

    // Remove sensitive data
    const sanitizedConfig = {
      ...config,
      password: '[HIDDEN]'
    };

    const response: ApiResponse<typeof sanitizedConfig> = {
      success: true,
      data: sanitizedConfig,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get active Veeam configuration:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve active Veeam configuration',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/database/veeam-configs
 * Create new Veeam configuration
 */
router.post('/veeam-configs', [
  body('name').notEmpty().withMessage('Name is required'),
  body('baseUrl').isURL().withMessage('Valid base URL is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('apiVersion').optional().isString(),
  body('verifySSL').optional().isBoolean(),
  body('description').optional().isString(),
  body('tags').optional().isArray()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const { name, baseUrl, username, password, apiVersion, verifySSL, description, tags } = req.body;
    const userId = req.user?.id || 'unknown';

    const config = await veeamConfigService.createConfig({
      name,
      baseUrl,
      username,
      password,
      apiVersion,
      verifySSL,
      description,
      tags,
      createdBy: userId
    });

    // Remove sensitive data
    const sanitizedConfig = {
      ...config,
      password: '[HIDDEN]'
    };

    const response: ApiResponse<typeof sanitizedConfig> = {
      success: true,
      data: sanitizedConfig,
      message: 'Veeam configuration created successfully',
      timestamp: new Date().toISOString()
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to create Veeam configuration:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create Veeam configuration',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * PUT /api/database/veeam-configs/:id
 * Update Veeam configuration
 */
router.put('/veeam-configs/:id', [
  param('id').notEmpty().withMessage('Configuration ID is required'),
  body('name').optional().notEmpty(),
  body('baseUrl').optional().isURL(),
  body('username').optional().notEmpty(),
  body('password').optional().notEmpty(),
  body('apiVersion').optional().isString(),
  body('verifySSL').optional().isBoolean(),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  body('isActive').optional().isBoolean(),
  body('isDefault').optional().isBoolean()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const updateData = req.body;

    const config = await veeamConfigService.updateConfig(id, updateData);
    
    // Clear configuration cache to ensure immediate effect
    configService.clearCache();
    logger.info('Veeam configuration updated successfully and cache cleared');

    // Remove sensitive data
    const sanitizedConfig = {
      ...config,
      password: '[HIDDEN]'
    };

    const response: ApiResponse<typeof sanitizedConfig> = {
      success: true,
      data: sanitizedConfig,
      message: 'Veeam configuration updated successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to update Veeam configuration:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update Veeam configuration',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/database/veeam-configs/:id
 * Delete Veeam configuration
 */
router.delete('/veeam-configs/:id', [
  param('id').notEmpty().withMessage('Configuration ID is required')
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const { id } = req.params;
    await veeamConfigService.deleteConfig(id);

    const response: ApiResponse<null> = {
      success: true,
      message: 'Veeam configuration deleted successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to delete Veeam configuration:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete Veeam configuration',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

// ============================================================================
// SYSTEM CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/database/system-config
 * Get system configurations by category
 */
router.get('/system-config', [
  query('category').optional().isString()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.query;

    let configs: any[] = [];
    if (category) {
      configs = await systemConfigService.getCategoryConfigs(category as string);
    }

    // Filter out secret values for non-admin users
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      value: config.isSecret ? '[HIDDEN]' : config.value
    }));

    const response: ApiResponse<typeof sanitizedConfigs> = {
      success: true,
      data: sanitizedConfigs,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get system configurations:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve system configurations',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * PUT /api/database/system-config
 * Update system configuration
 */
router.put('/system-config', [
  body('category').notEmpty().withMessage('Category is required'),
  body('key').notEmpty().withMessage('Key is required'),
  body('value').exists().withMessage('Value is required'),
  body('description').optional().isString(),
  body('isSecret').optional().isBoolean()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const { category, key, value, description, isSecret } = req.body;
    const userId = req.user?.id || 'unknown';

    await configService.setConfig(category, key, value, description, isSecret, userId);
    
    // Clear configuration cache to ensure immediate effect
    configService.clearCache();
    logger.info('System configuration updated successfully and cache cleared');

    const response: ApiResponse<null> = {
      success: true,
      message: 'System configuration updated successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to update system configuration:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update system configuration',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

// ============================================================================
// USER SETTINGS ROUTES
// ============================================================================

/**
 * GET /api/database/user-settings
 * Get user settings by category
 */
router.get('/user-settings', [
  query('category').optional().isString()
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.query;
    const userId = req.user?.id || 'unknown';

    let settings: any[] = [];
    if (category) {
      settings = await userSettingsService.getUserCategorySettings(userId, category as string);
    }

    const response: ApiResponse<typeof settings> = {
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get user settings:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to retrieve user settings',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * PUT /api/database/user-settings
 * Update user setting
 */
router.put('/user-settings', [
  body('category').notEmpty().withMessage('Category is required'),
  body('key').notEmpty().withMessage('Key is required'),
  body('value').exists().withMessage('Value is required')
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      };
      return res.status(400).json(response);
    }

    const { category, key, value } = req.body;
    const userId = req.user?.id || 'unknown';

    await userSettingsService.setUserSetting(userId, category, key, value);

    const response: ApiResponse<null> = {
      success: true,
      message: 'User setting updated successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to update user setting:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update user setting',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

// ============================================================================
// CONFIGURATION MANAGEMENT ROUTES
// ============================================================================

/**
 * POST /api/database/initialize
 * Initialize default configurations
 */
router.post('/initialize', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await configService.initializeDefaultConfigs();

    const response: ApiResponse<null> = {
      success: true,
      message: 'Default configurations initialized successfully',
      timestamp: new Date().toISOString()
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to initialize configurations:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to initialize configurations',
      timestamp: new Date().toISOString()
    };
    return res.status(500).json(response);
  }
});

/**
 * DELETE /api/database/cache
 * Clear configuration cache
 */
router.delete('/cache', async (req: AuthenticatedRequest, res: Response) => {
  try {
    configService.clearCache();

    const response: ApiResponse<null> = {
      success: true,
      message: 'Configuration cache cleared successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to clear configuration cache:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to clear configuration cache',
      timestamp: new Date().toISOString()
    };
    res.status(500).json(response);
  }
});

export default router;