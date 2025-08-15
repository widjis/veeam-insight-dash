import { Router, Request, Response } from 'express';
import { ReportConfigService, CreateReportConfigData, UpdateReportConfigData } from '../services/ReportConfigService';
import { ReportConfigType, ReportFormat, WhatsAppReportFormat } from '../generated/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/report-configs
 * Get all report configurations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const configs = await ReportConfigService.getAllConfigs();
    res.json(configs);
  } catch (error) {
    logger.error('Error fetching report configurations:', error);
    res.status(500).json({ error: 'Failed to fetch report configurations' });
  }
});

/**
 * GET /api/report-configs/enabled
 * Get enabled report configurations
 */
router.get('/enabled', async (req: Request, res: Response) => {
  try {
    const configs = await ReportConfigService.getEnabledConfigs();
    res.json(configs);
  } catch (error) {
    logger.error('Error fetching enabled report configurations:', error);
    res.status(500).json({ error: 'Failed to fetch enabled report configurations' });
  }
});

/**
 * GET /api/report-configs/type/:type
 * Get report configurations by type
 */
router.get('/type/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    // Validate type
    if (!Object.values(ReportConfigType).includes(type as ReportConfigType)) {
      return res.status(400).json({ error: 'Invalid report configuration type' });
    }

    const configs = await ReportConfigService.getConfigsByType(type as ReportConfigType);
    res.json(configs);
  } catch (error) {
    logger.error('Error fetching report configurations by type:', error);
    res.status(500).json({ error: 'Failed to fetch report configurations by type' });
  }
});

/**
 * GET /api/report-configs/:id
 * Get report configuration by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await ReportConfigService.getConfigById(id);
    
    if (!config) {
      return res.status(404).json({ error: 'Report configuration not found' });
    }
    
    res.json(config);
  } catch (error) {
    logger.error('Error fetching report configuration:', error);
    res.status(500).json({ error: 'Failed to fetch report configuration' });
  }
});

/**
 * POST /api/report-configs
 * Create a new report configuration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateReportConfigData = req.body;
    
    // Validate required fields
    if (!data.name || !data.type || !data.deliveryTime) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, type, and deliveryTime are required' 
      });
    }

    // Validate type
    if (!Object.values(ReportConfigType).includes(data.type)) {
      return res.status(400).json({ error: 'Invalid report configuration type' });
    }

    // Validate email format if provided
    if (data.emailFormat && !Object.values(ReportFormat).includes(data.emailFormat)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate WhatsApp format if provided
    if (data.whatsappFormat && !Object.values(WhatsAppReportFormat).includes(data.whatsappFormat)) {
      return res.status(400).json({ error: 'Invalid WhatsApp format' });
    }

    // Validate delivery time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.deliveryTime)) {
      return res.status(400).json({ error: 'Invalid delivery time format. Use HH:MM format' });
    }

    const config = await ReportConfigService.createConfig(data);
    res.status(201).json(config);
  } catch (error) {
    logger.error('Error creating report configuration:', error);
    res.status(500).json({ error: 'Failed to create report configuration' });
  }
});

/**
 * PUT /api/report-configs/:id
 * Update a report configuration
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateReportConfigData = req.body;

    // Validate type if provided
    if (data.type && !Object.values(ReportConfigType).includes(data.type)) {
      return res.status(400).json({ error: 'Invalid report configuration type' });
    }

    // Validate email format if provided
    if (data.emailFormat && !Object.values(ReportFormat).includes(data.emailFormat)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate WhatsApp format if provided
    if (data.whatsappFormat && !Object.values(WhatsAppReportFormat).includes(data.whatsappFormat)) {
      return res.status(400).json({ error: 'Invalid WhatsApp format' });
    }

    // Validate delivery time format if provided
    if (data.deliveryTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(data.deliveryTime)) {
        return res.status(400).json({ error: 'Invalid delivery time format. Use HH:MM format' });
      }
    }

    const config = await ReportConfigService.updateConfig(id, data);
    res.json(config);
  } catch (error) {
    logger.error('Error updating report configuration:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: 'Report configuration not found' });
    } else {
      res.status(500).json({ error: 'Failed to update report configuration' });
    }
  }
});

/**
 * PATCH /api/report-configs/:id/toggle
 * Toggle enabled status of a report configuration
 */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = await ReportConfigService.toggleConfig(id);
    res.json(config);
  } catch (error) {
    logger.error('Error toggling report configuration:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: 'Report configuration not found' });
    } else {
      res.status(500).json({ error: 'Failed to toggle report configuration' });
    }
  }
});

/**
 * DELETE /api/report-configs/:id
 * Delete a report configuration
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ReportConfigService.deleteConfig(id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting report configuration:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: 'Report configuration not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete report configuration' });
    }
  }
});

export default router;