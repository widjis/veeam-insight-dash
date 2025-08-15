import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { ScheduledReportService } from '../services/ScheduledReportService.js';
import { logger } from '../utils/logger.js';

const router = Router();

let scheduledReportService: ScheduledReportService;

export const setScheduledReportService = (service: ScheduledReportService) => {
  scheduledReportService = service;
};

// Get all scheduled reports
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reports = scheduledReportService.getScheduledReports();
    res.json({
      success: true,
      data: Array.from(reports.entries()).map(([reportId, config]) => ({
        ...config,
        id: reportId
      }))
    });
  } catch (error) {
    logger.error('Failed to get scheduled reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduled reports'
    });
  }
});

// Create or update a scheduled report
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      id,
      name,
      description,
      schedule,
      reportType,
      format,
      recipients,
      whatsappRecipients,
      enabled,
      includeJobs,
      includeRepositories,
      includeAlerts,
      dateRange,
      customDays,
      timezone
    } = req.body;

    if (!id || !name || !schedule || !reportType || !format) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, schedule, reportType, format'
      });
    }

    const reportConfig = {
      id,
      name,
      description: description || '',
      enabled: enabled !== false,
      schedule,
      reportType: reportType as 'summary' | 'detailed' | 'custom',
      format: format as 'html' | 'pdf' | 'csv',
      includeJobs: includeJobs !== false,
      includeRepositories: includeRepositories !== false,
      includeAlerts: includeAlerts !== false,
      dateRange: dateRange || 'daily',
      customDays: customDays || undefined,
      delivery: {
        email: {
          enabled: true,
          recipients: recipients || [],
          subject: `${name} - Scheduled Report`
        },
        whatsapp: {
          enabled: whatsappRecipients && whatsappRecipients.length > 0,
          recipients: whatsappRecipients || [],
          format: 'summary' as 'summary' | 'detailed'
        }
      },
      timezone: timezone || 'UTC',
      createdAt: new Date()
    };

    scheduledReportService.addScheduledReport(id, reportConfig);

    return res.json({
      success: true,
      message: 'Scheduled report saved successfully',
      data: reportConfig
    });
  } catch (error) {
    logger.error('Failed to save scheduled report:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save scheduled report'
    });
  }
});

// Delete a scheduled report
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const success = scheduledReportService.removeScheduledReport(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Scheduled report deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled report not found'
      });
    }
  } catch (error) {
    logger.error('Failed to delete scheduled report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scheduled report'
    });
  }
});

// Enable/disable a scheduled report
router.patch('/:id/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    const success = scheduledReportService.toggleScheduledReport(id, enabled);
    
    if (success) {
      res.json({
        success: true,
        message: `Scheduled report ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled report not found'
      });
    }
  } catch (error) {
    logger.error('Failed to toggle scheduled report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle scheduled report'
    });
  }
});

// Trigger a scheduled report manually
router.post('/:id/trigger', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const success = await scheduledReportService.triggerReport(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Report triggered successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled report not found'
      });
    }
  } catch (error) {
    logger.error('Failed to trigger scheduled report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scheduled report'
    });
  }
});

export default router;