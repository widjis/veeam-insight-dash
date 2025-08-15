import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '@/middleware/auth.js';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/environment.js';
import { ApiResponse } from '@/types/index.js';
import axios from 'axios';

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

// WhatsApp API URLs
const WHATSAPP_GROUP_URL = 'http://10.60.10.59:8192/send-group-message';
const WHATSAPP_PERSONAL_URL = 'http://10.60.10.59:8192/send-message';

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

// Helper function to update .env file
async function updateEnvFile(updates: Record<string, string>): Promise<void> {
  // In Docker/production environments, we should update runtime environment variables
  // instead of trying to write to .env files which may be read-only
  
  try {
    // Update runtime environment variables
    Object.entries(updates).forEach(([key, value]) => {
      process.env[key] = value;
      logger.info(`Updated environment variable: ${key}`);
    });

    // Only attempt to write .env file in development environment
    if (process.env.NODE_ENV === 'development') {
      const envPath = path.join(process.cwd(), '.env');
      
      try {
        // Read current .env file
        let envContent = '';
        try {
          envContent = await fs.readFile(envPath, 'utf-8');
        } catch (error) {
          // File doesn't exist, create new content
          logger.info('.env file not found, creating new one');
        }

        // Parse existing environment variables
        const envLines = envContent.split('\n');
        const envMap = new Map<string, string>();

        envLines.forEach(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('#') && trimmedLine !== '' && trimmedLine.includes('=')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            envMap.set(key.trim(), valueParts.join('='));
          }
        });

        // Update with new values
        Object.entries(updates).forEach(([key, value]) => {
          envMap.set(key, value);
        });

        // Rebuild .env content
        const newEnvContent = [
          '# Veeam Insight Dashboard Configuration',
          '# Server Configuration',
          `PORT=${envMap.get('PORT') || '3001'}`,
          `NODE_ENV=${envMap.get('NODE_ENV') || 'development'}`,
          `CORS_ORIGIN=${envMap.get('CORS_ORIGIN') || 'http://localhost:8080'}`,
          '',
          '# Veeam API Configuration',
          `VEEAM_BASE_URL=${envMap.get('VEEAM_BASE_URL') || 'https://10.60.10.128:9419'}`,
          `VEEAM_API_VERSION=${envMap.get('VEEAM_API_VERSION') || '1.1-rev1'}`,
          `VEEAM_USERNAME=${envMap.get('VEEAM_USERNAME') || 'admin.it'}`,
          `VEEAM_PASSWORD=${envMap.get('VEEAM_PASSWORD') || ''}`,
          `VEEAM_VERIFY_SSL=${envMap.get('VEEAM_VERIFY_SSL') || 'false'}`,
          '',
          '# Authentication',
          `JWT_SECRET=${envMap.get('JWT_SECRET') || 'your-super-secret-jwt-key-change-in-production'}`,
          `JWT_EXPIRES_IN=${envMap.get('JWT_EXPIRES_IN') || '24h'}`,
          `JWT_REFRESH_SECRET=${envMap.get('JWT_REFRESH_SECRET') || 'your-super-secret-refresh-key-change-in-production'}`,
          `JWT_REFRESH_EXPIRES_IN=${envMap.get('JWT_REFRESH_EXPIRES_IN') || '7d'}`,
          `REFRESH_TOKEN_EXPIRES_IN=${envMap.get('REFRESH_TOKEN_EXPIRES_IN') || '7d'}`,
          '',
          '# Cache Configuration',
          `CACHE_TTL=${envMap.get('CACHE_TTL') || '300'}`,
          `CACHE_CHECK_PERIOD=${envMap.get('CACHE_CHECK_PERIOD') || '600'}`,
          '',
          '# Logging',
          `LOG_LEVEL=${envMap.get('LOG_LEVEL') || 'info'}`,
          `LOG_FILE=${envMap.get('LOG_FILE') || 'logs/app.log'}`,
          '',
          '# WebSocket Configuration',
          `WS_PORT=${envMap.get('WS_PORT') || '3002'}`,
          '',
          '# Monitoring Configuration',
          `MONITORING_INTERVAL=${envMap.get('MONITORING_INTERVAL') || '30000'}`,
          `ALERT_CHECK_INTERVAL=${envMap.get('ALERT_CHECK_INTERVAL') || '60000'}`,
          `HEALTH_CHECK_INTERVAL=${envMap.get('HEALTH_CHECK_INTERVAL') || '30'}`,
          `METRICS_INTERVAL=${envMap.get('METRICS_INTERVAL') || '60'}`,
          '',
          '# WhatsApp Integration (Optional)',
          `WHATSAPP_API_URL=${envMap.get('WHATSAPP_API_URL') || 'http://10.60.10.59:8192'}`,
          `WHATSAPP_API_TOKEN=${envMap.get('WHATSAPP_API_TOKEN') || ''}`,
          `WHATSAPP_CHAT_ID=${envMap.get('WHATSAPP_CHAT_ID') || '120363123402010871@g.us'}`,
          `WHATSAPP_ENABLED=${envMap.get('WHATSAPP_ENABLED') || 'false'}`,
          `WHATSAPP_DEFAULT_RECIPIENTS=${envMap.get('WHATSAPP_DEFAULT_RECIPIENTS') || ''}`,
          '',
          '# Database (Future use)',
          '# DATABASE_URL=postgresql://user:password@localhost:5432/veeam_dashboard',
          '',
          '# Email Configuration (Future use)',
          '# EMAIL_HOST=smtp.gmail.com',
          '# EMAIL_PORT=587',
          '# EMAIL_USER=your-email@gmail.com',
          '# EMAIL_PASS=your-app-password'
        ].join('\n');

        // Write updated .env file
        await fs.writeFile(envPath, newEnvContent, 'utf-8');
        logger.info('Development .env file updated successfully');
      } catch (fileError) {
        logger.warn('Could not update .env file in development, but runtime variables updated:', fileError);
      }
    } else {
      logger.info('Production environment detected - runtime variables updated, .env file write skipped');
    }
    
  } catch (error) {
    logger.error('Error updating environment configuration:', error);
    throw new Error('Failed to update environment configuration');
  }
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
    const response: ApiResponse<any> = {
      success: true,
      data: {
        whatsappApiUrl: config.whatsappApiUrl,
        whatsappChatId: config.whatsappChatId,
        whatsappEnabled: config.whatsappEnabled,
        whatsappDefaultRecipients: config.whatsappDefaultRecipients,
        veeamBaseUrl: config.veeamBaseUrl,
        veeamUsername: config.veeamUsername,
        veeamVerifySSL: config.veeamVerifySSL,
        // Don't expose sensitive data
        hasWhatsappToken: !!config.whatsappApiToken,
        hasVeeamPassword: !!config.veeamPassword,
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
    body('whatsappApiUrl').optional().isURL({ require_protocol: true, allow_underscores: true }).withMessage('Invalid WhatsApp API URL'),
    body('whatsappApiToken').optional().isString().withMessage('WhatsApp API token must be a string'),
    body('whatsappChatId').optional().isString().withMessage('WhatsApp chat ID must be a string'),
    body('whatsappEnabled').optional().isBoolean().withMessage('WhatsApp enabled must be a boolean'),
    body('whatsappDefaultRecipients').optional().isArray().withMessage('WhatsApp recipients must be an array'),
    body('veeamBaseUrl').optional().isURL().withMessage('Invalid Veeam base URL'),
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

      const updates: SettingsUpdateRequest = req.body;
      const envUpdates: Record<string, string> = {};

      // Map settings to environment variables
      if (updates.whatsappApiUrl !== undefined) {
        envUpdates.WHATSAPP_API_URL = updates.whatsappApiUrl;
      }
      if (updates.whatsappApiToken !== undefined) {
        envUpdates.WHATSAPP_API_TOKEN = updates.whatsappApiToken;
      }
      if (updates.whatsappChatId !== undefined) {
        envUpdates.WHATSAPP_CHAT_ID = updates.whatsappChatId;
      }
      if (updates.whatsappEnabled !== undefined) {
        envUpdates.WHATSAPP_ENABLED = updates.whatsappEnabled.toString();
      }
      if (updates.whatsappDefaultRecipients !== undefined) {
        envUpdates.WHATSAPP_DEFAULT_RECIPIENTS = updates.whatsappDefaultRecipients.join(',');
      }
      if (updates.veeamBaseUrl !== undefined) {
        envUpdates.VEEAM_BASE_URL = updates.veeamBaseUrl;
      }
      if (updates.veeamUsername !== undefined) {
        envUpdates.VEEAM_USERNAME = updates.veeamUsername;
      }
      if (updates.veeamPassword !== undefined) {
        envUpdates.VEEAM_PASSWORD = updates.veeamPassword;
      }
      if (updates.veeamVerifySSL !== undefined) {
        envUpdates.VEEAM_VERIFY_SSL = updates.veeamVerifySSL.toString();
      }

      // Update .env file
      await updateEnvFile(envUpdates);

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Settings updated successfully. Please restart the server for changes to take effect.' },
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
      const response = await axios.post(WHATSAPP_PERSONAL_URL, payload, {
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
      const response = await axios.post(WHATSAPP_GROUP_URL, payload, {
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

      // Test group message
      const testMessage = `🧪 Test message from Veeam Insight Dashboard\nTimestamp: ${new Date().toISOString()}`;
      
      const payload = {
        id: config.whatsappChatId,
        message: testMessage,
      };

      const response = await axios.post(WHATSAPP_GROUP_URL, payload, {
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
    const whatsappSettings = {
      enabled: config.whatsappEnabled || false,
      apiUrl: config.whatsappApiUrl || '',
      apiToken: '', // Don't return the actual token for security
      chatId: config.whatsappChatId || '',
      defaultRecipients: config.whatsappDefaultRecipients || []
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
    body('apiUrl').optional().isURL({ require_protocol: true, allow_underscores: true }).withMessage('Invalid API URL'),
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
      const updates: Record<string, string> = {};

      if (enabled !== undefined) {
        updates.WHATSAPP_ENABLED = enabled.toString();
      }
      if (apiUrl !== undefined) {
        updates.WHATSAPP_API_URL = apiUrl;
      }
      if (apiToken !== undefined && apiToken.trim() !== '') {
        updates.WHATSAPP_API_TOKEN = apiToken;
      }
      if (chatId !== undefined) {
        updates.WHATSAPP_CHAT_ID = chatId;
      }
      if (defaultRecipients !== undefined) {
        updates.WHATSAPP_DEFAULT_RECIPIENTS = defaultRecipients.join(',');
      }

      if (Object.keys(updates).length > 0) {
        await updateEnvFile(updates);
        logger.info('WhatsApp settings updated successfully');
      }

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
      
      const response = await axios.post(WHATSAPP_PERSONAL_URL, {
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
      
      const response = await axios.post(WHATSAPP_GROUP_URL, {
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
      const testMessage = 'Connection test from Veeam Insight Dashboard';
      const chatId = config.whatsappChatId || '120363123402010871@g.us';
      
      const response = await axios.post(WHATSAPP_GROUP_URL, {
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
          
          const messageData = {
            number: formattedNumber,
            message: reportContent,
          };

          const response = await axios.post(WHATSAPP_PERSONAL_URL, messageData, {
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

// Helper function to generate report content
async function generateReportContent(format: 'summary' | 'detailed', reportType: 'daily' | 'weekly' | 'monthly'): Promise<string> {
  const currentDate = new Date().toISOString().split('T')[0];
  const reportTitle = `*${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Veeam Backup Report - ${currentDate}*`;
  
  if (format === 'summary') {
    return `${reportTitle}\n\n` +
           `📊 *Summary Report*\n` +
           `• Total Jobs: 12\n` +
           `• Successful: 10 ✅\n` +
           `• Failed: 2 ❌\n` +
           `• Warning: 0 ⚠️\n\n` +
           `💾 *Storage Status*\n` +
           `• Repository 1: 75% used\n` +
           `• Repository 2: 82% used\n\n` +
           `🔄 *Last Backup*\n` +
           `• Completed: ${new Date().toLocaleString()}\n\n` +
           `_Generated by Veeam Insight Dashboard_`;
  } else {
    return `${reportTitle}\n\n` +
           `📋 *Detailed Report*\n\n` +
           `🔄 *Job Status Details*\n` +
           `• SQL Server Backup: ✅ Success (2.5GB)\n` +
           `• File Server Backup: ✅ Success (15.2GB)\n` +
           `• Exchange Backup: ❌ Failed (Connection timeout)\n` +
           `• VM Backup: ✅ Success (45.8GB)\n\n` +
           `💾 *Repository Details*\n` +
           `• Primary Repository:\n` +
           `  - Capacity: 2TB\n` +
           `  - Used: 1.5TB (75%)\n` +
           `  - Free: 512GB\n\n` +
           `• Secondary Repository:\n` +
           `  - Capacity: 5TB\n` +
           `  - Used: 4.1TB (82%)\n` +
           `  - Free: 900GB\n\n` +
           `⚠️ *Alerts*\n` +
           `• Repository 2 approaching capacity limit\n` +
           `• Exchange backup requires attention\n\n` +
           `📈 *Performance*\n` +
           `• Average backup speed: 125 MB/s\n` +
           `• Total data processed: 63.5GB\n` +
           `• Backup window: 22:00 - 06:00\n\n` +
           `_Generated by Veeam Insight Dashboard_`;
  }
}

export default router;