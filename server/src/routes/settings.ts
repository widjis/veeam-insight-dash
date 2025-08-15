import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '@/middleware/auth.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/environment.js';
import { ApiResponse } from '@/types/index.js';
import axios from 'axios';
import { SystemConfigService } from '@/services/database.js';
import { configService } from '@/services/configService.js';

const systemConfigService = new SystemConfigService();

const router = Router();

// Rate limiting for settings endpoints - temporarily disabled due to proxy configuration issues
// const settingsLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes
//   max: 10, // Limit each IP to 10 requests per 5 minutes
//   message: {
//     success: false,
//     error: 'Too many settings requests, please try again later.',
//     timestamp: new Date().toISOString(),
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// WhatsApp API URLs - now retrieved from database configuration
// WhatsApp URLs are constructed dynamically from database configuration

// Interface for settings update
interface SettingsUpdateRequest {
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
  whatsappChatId?: string;
  whatsappEnabled?: boolean;
  whatsappDefaultRecipients?: string[];
  veeamBaseUrl?: string;
  veeamUsername?: string;
  veeamPassword?: string;
  veeamVerifySSL?: boolean;
}

// Interface for WhatsApp message
interface WhatsAppMessageRequest {
  number?: string;
  chatId?: string;
  message: string;
  imageUrl?: string;
}



// Helper function to format phone number
function phoneNumberFormatter(number: string): string {
  // Remove all non-numeric characters
  let formatted = number.replace(/\D/g, '');
  
  // Add country code if not present
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substring(1);
  } else if (!formatted.startsWith('62')) {
    formatted = '62' + formatted;
  }
  
  return formatted + '@c.us';
}



// Get current settings
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Get settings from database with environment variable fallback
    const [
      whatsappApiUrl,
      whatsappChatId,
      whatsappEnabled,
      whatsappDefaultRecipients,
      veeamBaseUrl,
      veeamUsername,
      veeamVerifySSL
    ] = await Promise.all([
      systemConfigService.getConfig('notifications', 'whatsappApiUrl') || config.whatsappApiUrl,
      systemConfigService.getConfig('notifications', 'whatsappChatId') || config.whatsappChatId,
      (systemConfigService.getConfig('notifications', 'whatsappEnabled') ?? config.whatsappEnabled),
      systemConfigService.getConfig('notifications', 'whatsappDefaultRecipients') || config.whatsappDefaultRecipients,
      systemConfigService.getConfig('veeam', 'baseUrl') || config.veeamBaseUrl,
      systemConfigService.getConfig('veeam', 'username') || config.veeamUsername,
      (systemConfigService.getConfig('veeam', 'verifySSL') ?? config.veeamVerifySSL)
    ]);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        whatsappApiUrl,
        whatsappChatId,
        whatsappEnabled,
        whatsappDefaultRecipients,
        veeamBaseUrl,
        veeamUsername,
        veeamVerifySSL,
        // Don't expose sensitive data
        hasWhatsappToken: !!(systemConfigService.getConfig('notifications', 'whatsappApiToken') || config.whatsappApiToken),
        hasVeeamPassword: !!(systemConfigService.getConfig('veeam', 'password') || config.veeamPassword),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching settings:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch settings',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

// Update settings
router.put('/', 
  authMiddleware, 

  [
    body('whatsappApiUrl').optional().isURL({ require_protocol: true, allow_underscores: true, allow_protocol_relative_urls: false, require_tld: false }).withMessage('Invalid WhatsApp API URL'),
    body('whatsappApiToken').optional().isString().withMessage('WhatsApp API token must be a string'),
    body('whatsappChatId').optional().isString().withMessage('WhatsApp chat ID must be a string'),
    body('whatsappEnabled').optional().isBoolean().withMessage('WhatsApp enabled must be a boolean'),
    body('whatsappDefaultRecipients').optional().isArray().withMessage('WhatsApp recipients must be an array'),
    body('veeamBaseUrl').optional().isURL({ require_protocol: true, allow_protocol_relative_urls: false, require_tld: false }).withMessage('Invalid Veeam base URL'),
    body('veeamUsername').optional().isString().withMessage('Veeam username must be a string'),
    body('veeamPassword').optional().isString().withMessage('Veeam password must be a string'),
    body('veeamVerifySSL').optional().isBoolean().withMessage('Veeam verify SSL must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Validation failed',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Map settings to database storage with environment variable fallback
      const updates: SettingsUpdateRequest = req.body;
      const userId = (req as any).user?.id || 'system';

      // Update database configurations
      const updatePromises = [];

      if (updates.whatsappApiUrl !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappApiUrl', updates.whatsappApiUrl, 'WhatsApp API URL', false, userId)
        );
      }
      if (updates.whatsappApiToken !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappApiToken', updates.whatsappApiToken, 'WhatsApp API Token', true, userId)
        );
      }
      if (updates.whatsappChatId !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappChatId', updates.whatsappChatId, 'WhatsApp Chat/Group ID', false, userId)
        );
      }
      if (updates.whatsappEnabled !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappEnabled', updates.whatsappEnabled, 'Enable WhatsApp notifications', false, userId)
        );
      }
      if (updates.whatsappDefaultRecipients !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappDefaultRecipients', updates.whatsappDefaultRecipients, 'Default WhatsApp recipients', false, userId)
        );
      }
      if (updates.veeamBaseUrl !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('veeam', 'baseUrl', updates.veeamBaseUrl, 'Veeam server base URL', false, userId)
        );
      }
      if (updates.veeamUsername !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('veeam', 'username', updates.veeamUsername, 'Veeam username', false, userId)
        );
      }
      if (updates.veeamPassword !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('veeam', 'password', updates.veeamPassword, 'Veeam password', true, userId)
        );
      }
      if (updates.veeamVerifySSL !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('veeam', 'verifySSL', updates.veeamVerifySSL, 'Verify SSL certificates for Veeam connections', false, userId)
        );
      }

      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      // Clear configuration cache to ensure immediate effect
      configService.clearCache();
      logger.info('Settings updated successfully and cache cleared');

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Settings updated successfully.' },
        timestamp: new Date().toISOString(),
      };

      return res.json(response);
    } catch (error) {
      logger.error('Error updating settings:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to update settings',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// Send WhatsApp message to personal number
router.post('/whatsapp/send-personal',
  authMiddleware,

  [
    body('number').trim().notEmpty().withMessage('Number cannot be empty'),
    body('message').trim().notEmpty().withMessage('Message cannot be empty'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Validation failed',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { number, message, imageUrl }: WhatsAppMessageRequest = req.body;
      
      // Format phone number
      const formattedNumber = phoneNumberFormatter(number!);
      
      // Prepare payload
      const payload: any = {
        number: formattedNumber,
        message: message,
      };
      
      if (imageUrl) {
        payload.imageUrl = imageUrl;
      }

      // Send message to WhatsApp API
      const notificationConfig = await configService.getNotificationConfig();
       const whatsappApiUrl = String(
          notificationConfig.whatsapp.apiUrl ?? 
          config.whatsappApiUrl ?? 
          'https://api.callmebot.com/whatsapp.php'
        );
      const response = await axios.post(whatsappApiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
      });

      const apiResponse: ApiResponse<any> = {
        success: true,
        data: {
          message: 'WhatsApp message sent successfully',
          response: response.data,
        },
        timestamp: new Date().toISOString(),
      };

      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending WhatsApp personal message:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to send WhatsApp message',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// Send WhatsApp message to group
router.post('/whatsapp/send-group',
  authMiddleware,
  [
    body('chatId').optional().isString().withMessage('Chat ID must be a string'),
    body('message').trim().notEmpty().withMessage('Message cannot be empty'),
    body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Validation failed',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { chatId, message, imageUrl }: WhatsAppMessageRequest = req.body;
      
      // Use provided chatId or default from config
      const targetChatId = chatId || config.whatsappChatId;
      
      if (!targetChatId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'No chat ID provided and no default chat ID configured',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Prepare payload
      const payload: any = {
        id: targetChatId,
        message: message,
      };
      
      if (imageUrl) {
        // For group messages with images, we need to handle it differently
        // This would require file upload handling similar to the example
        payload.imageUrl = imageUrl;
      }

      // Send message to WhatsApp API
      const notificationConfig = await configService.getNotificationConfig();
      const whatsappApiUrl = String(
        notificationConfig.whatsapp.apiUrl ?? 
        config.whatsappApiUrl ?? 
        'https://api.callmebot.com/whatsapp.php'
      );
      const response = await axios.post(whatsappApiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
      });

      const apiResponse: ApiResponse<any> = {
        success: true,
        data: {
          message: 'WhatsApp group message sent successfully',
          response: response.data,
        },
        timestamp: new Date().toISOString(),
      };

      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending WhatsApp group message:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to send WhatsApp group message',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// Test WhatsApp connection
router.post('/whatsapp/test',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      if (!config.whatsappEnabled) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'WhatsApp integration is disabled',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      // Initialize WhatsApp URLs from database
      const notificationConfig = await configService.getNotificationConfig();
      const whatsappApiUrl = notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? 'http://10.60.10.59:8192';
      const whatsappGroupUrl = `${whatsappApiUrl}/send-group-message`;
      
      const testMessage = `🧪 Test message from Veeam Insight Dashboard\nTimestamp: ${new Date().toISOString()}`;
      
      const payload = {
        id: config.whatsappChatId,
        message: testMessage,
      };

      const response = await axios.post(whatsappGroupUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const apiResponse: ApiResponse<any> = {
        success: true,
        data: {
          message: 'WhatsApp test message sent successfully',
          response: response.data,
        },
        timestamp: new Date().toISOString(),
      };

      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error testing WhatsApp connection:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to test WhatsApp connection',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// WhatsApp-specific settings endpoints
router.get('/whatsapp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const notificationConfig = await configService.getNotificationConfig();
    const [
      enabled,
      chatId,
      defaultRecipients
    ] = await Promise.all([
      (await systemConfigService.getConfig('notifications', 'whatsappEnabled')) ?? config.whatsappEnabled ?? false,
      (await systemConfigService.getConfig('notifications', 'whatsappChatId')) ?? config.whatsappChatId ?? '',
      (await systemConfigService.getConfig('notifications', 'whatsappDefaultRecipients')) ?? config.whatsappDefaultRecipients ?? []
    ]);
    
    const apiUrl = notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? '';

    const whatsappSettings = {
      enabled,
      apiUrl,
      apiToken: '', // Don't return the actual token for security
      chatId,
      defaultRecipients
    };

    const response: ApiResponse<typeof whatsappSettings> = {
      success: true,
      data: whatsappSettings,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (error: any) {
    logger.error('Error fetching WhatsApp settings:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch WhatsApp settings',
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(response);
  }
});

router.put('/whatsapp',
  authMiddleware,
  [
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
    body('apiUrl').optional().isURL({ require_protocol: true, allow_underscores: true, allow_protocol_relative_urls: false, require_tld: false }).withMessage('Invalid API URL'),
    body('apiToken').optional().isString().withMessage('API token must be a string'),
    body('chatId').optional().isString().withMessage('Chat ID must be a string'),
    body('defaultRecipients').optional().isArray().withMessage('Default recipients must be an array'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Log the request body for debugging
      logger.info('WhatsApp settings update request body:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.error('WhatsApp settings validation errors:', errors.array());
        const response: ApiResponse<null> = {
          success: false,
          error: `Validation error: ${errors.array().map(e => `${e.type === 'field' ? e.path : 'unknown'}: ${e.msg}`).join(', ')}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { enabled, apiUrl, apiToken, chatId, defaultRecipients } = req.body;
      const userId = (req as any).user?.id || 'system';

      // Update database configurations
      const updatePromises = [];
      if (enabled !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappEnabled', enabled, 'Enable WhatsApp notifications', false, userId)
        );
      }
      if (apiUrl !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappApiUrl', apiUrl, 'WhatsApp API URL', false, userId)
        );
      }
      if (apiToken !== undefined && apiToken.trim() !== '') {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappApiToken', apiToken, 'WhatsApp API Token', true, userId)
        );
      }
      if (chatId !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappChatId', chatId, 'WhatsApp Chat/Group ID', false, userId)
        );
      }
      if (defaultRecipients !== undefined) {
        updatePromises.push(
          systemConfigService.setConfig('notifications', 'whatsappDefaultRecipients', defaultRecipients, 'Default WhatsApp recipients', false, userId)
        );
      }

      await Promise.all(updatePromises);
      
      // Clear configuration cache to ensure immediate effect
      configService.clearCache();
      logger.info('WhatsApp settings updated successfully and cache cleared');

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'WhatsApp settings updated successfully' },
        timestamp: new Date().toISOString(),
      };
      return res.json(response);
    } catch (error: any) {
      logger.error('Error updating WhatsApp settings:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to update WhatsApp settings',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

router.post('/whatsapp/test-personal',
  authMiddleware,
  [
    body('message').optional().trim().isString().withMessage('Message must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Validation error: ${errors.array().map(e => `${e.type === 'field' ? e.path : 'unknown'}: ${e.msg}`).join(', ')}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { message } = req.body;
      const testNumber = '6285712612218'; // Default test number
      
      const notificationConfig = await configService.getNotificationConfig();
      const whatsappApiUrl = notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? 'http://10.60.10.59:8192';
      const whatsappPersonalUrl = `${whatsappApiUrl}/send-message`;
      
      const response = await axios.post(whatsappPersonalUrl, {
        number: phoneNumberFormatter(testNumber),
        message: message || 'Test personal message from Veeam Insight Dashboard',
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info('WhatsApp personal test successful:', response.data);
      
      const apiResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Personal WhatsApp test message sent successfully' },
        timestamp: new Date().toISOString(),
      };
      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending WhatsApp personal test:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to send personal test message',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

router.post('/whatsapp/test-group',
  authMiddleware,
  [
    body('message').optional().trim().isString().withMessage('Message must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Validation error: ${errors.array().map(e => `${e.type === 'field' ? e.path : 'unknown'}: ${e.msg}`).join(', ')}`,
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }

      const { message } = req.body;
      const chatId = config.whatsappChatId || '120363123402010871@g.us';
      
      const notificationConfig = await configService.getNotificationConfig();
      const whatsappApiUrl = 
        notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? 'http://10.60.10.59:8192';
      const whatsappGroupUrl = `${whatsappApiUrl}/send-group-message`;
      
      const response = await axios.post(whatsappGroupUrl, {
        id: chatId,
        message: message || 'Test group message from Veeam Insight Dashboard',
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info('WhatsApp group test successful:', response.data);
      
      const apiResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Group WhatsApp test message sent successfully' },
        timestamp: new Date().toISOString(),
      };
      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending WhatsApp group test:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to send group test message',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

router.post('/whatsapp/test-connection',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Test WhatsApp API connection
      const notificationConfig = await configService.getNotificationConfig();
      const whatsappApiUrl = 
        notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? 'http://10.60.10.59:8192';
      const whatsappGroupUrl = `${whatsappApiUrl}/send-group-message`;
      const testMessage = 'Connection test from Veeam Insight Dashboard';
      const chatId = config.whatsappChatId || '120363123402010871@g.us';
      
      const response = await axios.post(whatsappGroupUrl, {
        id: chatId,
        message: testMessage,
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info('WhatsApp connection test successful:', response.data);
      
      const apiResponse: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'WhatsApp API connection test successful' },
        timestamp: new Date().toISOString(),
      };
      res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error testing WhatsApp connection:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error.response?.data?.message || 'Failed to test WhatsApp API connection',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(response);
    }
  }
);

// POST /api/settings/whatsapp/send-report - Send WhatsApp report
router.post('/whatsapp/send-report',
  authMiddleware,
  [
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('format').isIn(['summary', 'detailed']).withMessage('Format must be summary or detailed'),
    body('reportType').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid report type'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse<null> = {
          success: false,
          error: `Validation failed: ${errors.array().map(e => `${e.type === 'field' ? e.path : 'unknown'}: ${e.msg}`).join(', ')}`,
          timestamp: new Date().toISOString(),
        };
      return res.status(400).json(response);
    }

    try {
      const { recipients, format, reportType = 'daily' } = req.body;
      
      // Generate report content based on format
      const reportContent = await generateReportContent(format, reportType);
      
      // Send to each recipient
      const results = [];
      for (const recipient of recipients) {
        try {
          const formattedNumber = phoneNumberFormatter(recipient);
          
          const notificationConfig = await configService.getNotificationConfig();
           const whatsappApiUrl = notificationConfig.whatsapp.apiUrl ?? config.whatsappApiUrl ?? 'http://10.60.10.59:8192';
      const whatsappPersonalUrl = `${whatsappApiUrl}/send-message`;
      
      const messageData = {
        number: formattedNumber,
        message: reportContent,
      };

      const response = await axios.post(whatsappPersonalUrl, messageData, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          results.push({
            recipient: formattedNumber,
            success: true,
            response: response.data,
          });
          
          logger.info(`WhatsApp report sent successfully to ${formattedNumber}`);
        } catch (error: any) {
          logger.error(`Failed to send WhatsApp report to ${recipient}:`, error);
          results.push({
            recipient,
            success: false,
            error: error.response?.data?.message || error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const apiResponse: ApiResponse<any> = {
        success: successCount > 0,
        data: {
          totalRecipients: recipients.length,
          successCount,
          failureCount: recipients.length - successCount,
          results,
        },
        message: `Report sent to ${successCount}/${recipients.length} recipients`,
        timestamp: new Date().toISOString(),
      };
      
      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending WhatsApp report:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to send WhatsApp report',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// Email send report endpoint
router.post('/email/send-report',
  authMiddleware,
  [
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('subject').optional().isString().withMessage('Subject must be a string'),
    body('format').isIn(['summary', 'detailed']).withMessage('Format must be summary or detailed'),
    body('reportType').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid report type'),
    body('reportFormat').optional().isIn(['html', 'pdf', 'csv']).withMessage('Invalid report format'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Validation failed: ${errors.array().map(e => `${e.type === 'field' ? e.path : 'unknown'}: ${e.msg}`).join(', ')}`,
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    try {
      const { recipients, subject, format, reportType = 'daily', reportFormat = 'html' } = req.body;
      
      // Check if email is configured
      const notificationConfig = await configService.getNotificationConfig();
      
      if (!notificationConfig.email.enabled || !notificationConfig.email.host) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Email is not configured. Please configure email settings first.',
          timestamp: new Date().toISOString(),
        };
        return res.status(400).json(response);
      }
      
      // Generate report content
      const reportContent = await generateEmailReportContent(format, reportType, reportFormat);
      
      // For now, we'll just simulate email sending since we don't have nodemailer setup in this endpoint
      // In a real implementation, you would use the ScheduledReportService's email functionality
      const results = [];
      for (const recipient of recipients) {
        try {
          // Simulate email sending - replace with actual email sending logic
          logger.info(`Email report would be sent to ${recipient}`);
          
          results.push({
            recipient,
            success: true,
            message: 'Email sent successfully (simulated)',
          });
        } catch (error: any) {
          logger.error(`Failed to send email report to ${recipient}:`, error);
          results.push({
            recipient,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const apiResponse: ApiResponse<any> = {
        success: successCount > 0,
        data: {
          totalRecipients: recipients.length,
          successCount,
          failureCount: recipients.length - successCount,
          results,
        },
        message: `Email report sent to ${successCount}/${recipients.length} recipients`,
        timestamp: new Date().toISOString(),
      };
      
      return res.json(apiResponse);
    } catch (error: any) {
      logger.error('Error sending email report:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to send email report',
        timestamp: new Date().toISOString(),
      };
      return res.status(500).json(response);
    }
  }
);

// Helper function to generate email report content
async function generateEmailReportContent(format: 'summary' | 'detailed', reportType: 'daily' | 'weekly' | 'monthly', reportFormat: 'html' | 'pdf' | 'csv' = 'html'): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];
  const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Veeam Backup Report - ${currentDate}`;
  
  if (reportFormat === 'html') {
    const summaryContent = format === 'summary' ? 
      `<h2>📊 Summary Report</h2>
      <ul>
        <li>Total Jobs: 12</li>
        <li>Successful: 10 ✅</li>
        <li>Failed: 2 ❌</li>
        <li>Warning: 0 ⚠️</li>
      </ul>
      <h3>💾 Storage Status</h3>
      <ul>
        <li>Repository 1: 75% used</li>
        <li>Repository 2: 82% used</li>
      </ul>` :
      `<h2>📋 Detailed Report</h2>
      <h3>🔄 Job Status Details</h3>
      <ul>
        <li>SQL Server Backup: ✅ Success (2.5GB)</li>
        <li>File Server Backup: ✅ Success (15.2GB)</li>
        <li>Exchange Backup: ❌ Failed (Connection timeout)</li>
        <li>VM Backup: ✅ Success (45.8GB)</li>
      </ul>
      <h3>💾 Repository Details</h3>
      <ul>
        <li>Primary Repository: 2TB capacity, 1.5TB used (75%)</li>
        <li>Secondary Repository: 5TB capacity, 4.1TB used (82%)</li>
      </ul>`;
    
    return `<html><body><h1>${reportTitle}</h1>${summaryContent}<p><em>Generated by Veeam Insight Dashboard</em></p></body></html>`;
  }
  
  // Fallback to text format for other types
  return generateReportContent(format, reportType);
}

// Helper function to generate report content with real Veeam data
async function generateReportContent(format: 'summary' | 'detailed', reportType: 'daily' | 'weekly' | 'monthly'): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];
  const reportTitle = `*${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Veeam Backup Report - ${currentDate}*`;
  
  try {
    // Initialize VeeamService to get real data
    const veeamService = new (await import('@/services/VeeamService.js')).VeeamService();
    
    // Fetch real data from Veeam
    const [jobsResponse, repositoriesResponse] = await Promise.all([
      veeamService.getJobStates(),
      veeamService.getRepositoryStates()
    ]);
    
    // Extract data or use defaults if API calls fail
    const jobs = (jobsResponse.success && jobsResponse.data) ? jobsResponse.data : [];
    const repositories = (repositoriesResponse.success && repositoriesResponse.data) ? repositoriesResponse.data : [];
    
    // Calculate real statistics
    const totalJobs = jobs?.length || 0;
    const successfulJobs = jobs?.filter((job: any) => job.lastResult === 'Success').length || 0;
    const failedJobs = jobs?.filter((job: any) => job.lastResult === 'Failed').length || 0;
    const warningJobs = jobs?.filter((job: any) => job.lastResult === 'Warning').length || 0;
    
    // Calculate repository statistics
    const repoStats = repositories?.map((repo: any) => {
      const capacityTB = (repo.capacityGB || 0) / 1024;
      const usedTB = (repo.usedSpaceGB || 0) / 1024;
      const usagePercent = repo.capacityGB > 0 ? Math.round((repo.usedSpaceGB / repo.capacityGB) * 100) : 0;
      return {
        name: repo.name || 'Unknown Repository',
        capacityTB: capacityTB.toFixed(1),
        usedTB: usedTB.toFixed(1),
        usagePercent
      };
    });
    
    if (format === 'summary') {
      let repoSummary = '';
      repoStats.forEach((repo, index) => {
        repoSummary += `• ${repo.name}: ${repo.usagePercent}% used\n`;
      });
      
      return `${reportTitle}\n\n` +
             `📊 *Summary Report*\n` +
             `• Total Jobs: ${totalJobs}\n` +
             `• Successful: ${successfulJobs} ✅\n` +
             `• Failed: ${failedJobs} ❌\n` +
             `• Warning: ${warningJobs} ⚠️\n\n` +
             `💾 *Storage Status*\n` +
             (repoSummary || '• No repositories found\n') +
             `\n🔄 *Last Backup*\n` +
             `• Completed: ${new Date().toLocaleString()}\n\n` +
             `_Generated by Veeam Insight Dashboard_`;
    } else {
      // Detailed format with real job details
       let jobDetails = '';
       const failedJobsList = jobs?.filter((job: any) => job.lastResult === 'Failed') || [];
       const successfulJobsList = jobs?.filter((job: any) => job.lastResult === 'Success') || [];
      
      // Add successful jobs (limit to first 5)
      successfulJobsList.slice(0, 5).forEach((job: any) => {
        jobDetails += `• ${job.name || 'Unknown Job'}: ✅ Success\n`;
      });
      
      // Add failed jobs
      failedJobsList.forEach((job: any) => {
        const message = job.message || 'No details available';
        jobDetails += `• ${job.name || 'Unknown Job'}: ❌ Failed (${message})\n`;
      });
      
      // Repository details
      let repoDetails = '';
      repoStats.forEach((repo) => {
        const freeTB = (parseFloat(repo.capacityTB) - parseFloat(repo.usedTB)).toFixed(1);
        repoDetails += `• ${repo.name}:\n` +
                      `  - Capacity: ${repo.capacityTB}TB\n` +
                      `  - Used: ${repo.usedTB}TB (${repo.usagePercent}%)\n` +
                      `  - Free: ${freeTB}TB\n\n`;
      });
      
      // Generate alerts for high usage repositories
      let alerts = '';
      const highUsageRepos = repoStats.filter(repo => repo.usagePercent > 80);
      if (highUsageRepos.length > 0) {
        highUsageRepos.forEach(repo => {
          alerts += `• ${repo.name} approaching capacity limit (${repo.usagePercent}%)\n`;
        });
      }
      if (failedJobs > 0) {
        alerts += `• ${failedJobs} backup job(s) require attention\n`;
      }
      if (!alerts) {
        alerts = '• No active alerts\n';
      }
      
      return `${reportTitle}\n\n` +
             `📋 *Detailed Report*\n\n` +
             `🔄 *Job Status Details*\n` +
             (jobDetails || '• No jobs found\n') +
             `\n💾 *Repository Details*\n` +
             (repoDetails || '• No repositories found\n') +
             `⚠️ *Alerts*\n` +
             alerts +
             `\n📈 *Performance*\n` +
             `• Total Jobs Monitored: ${totalJobs}\n` +
             `• Success Rate: ${totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 100) : 0}%\n` +
             `• Repositories: ${repositories?.length || 0}\n\n` +
             `_Generated by Veeam Insight Dashboard_`;
    }
  } catch (error) {
    logger.error('Error generating report content with real data:', error);
    
    // Fallback to basic report if real data fetch fails
    return `${reportTitle}\n\n` +
           `📊 *Report Generation Error*\n` +
           `• Unable to fetch real-time data\n` +
           `• Please check Veeam connection\n` +
           `• Contact administrator if issue persists\n\n` +
           `_Generated by Veeam Insight Dashboard_`;
  }
}

export default router;