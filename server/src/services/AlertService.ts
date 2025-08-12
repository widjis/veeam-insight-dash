import { WebSocketService } from './WebSocketService.js';
import { CacheService } from './CacheService.js';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import {
  Alert,
  AlertRule,
  ApiResponse,
  PaginatedResponse
} from '@/types/index.js';

export class AlertService {
  private webSocketService: WebSocketService;
  private cacheService: CacheService;
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  constructor(webSocketService: WebSocketService, cacheService: CacheService) {
    this.webSocketService = webSocketService;
    this.cacheService = cacheService;
    this.loadDefaultAlertRules();
    logger.info('Alert service initialized');
  }

  private loadDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'job-failure-rule',
        name: 'Job Failure Alert',
        type: 'job_failure',
        enabled: true,
        conditions: {},
        actions: {
          email: true,
          whatsapp: config.whatsappEnabled,
        },
      },
      {
        id: 'storage-threshold-rule',
        name: 'Storage Threshold Alert',
        type: 'storage_threshold',
        enabled: true,
        conditions: {
          threshold: 85, // Alert when storage usage > 85%
        },
        actions: {
          email: true,
          whatsapp: config.whatsappEnabled,
        },
      },
      {
        id: 'infrastructure-down-rule',
        name: 'Infrastructure Down Alert',
        type: 'infrastructure_down',
        enabled: true,
        conditions: {},
        actions: {
          email: true,
          whatsapp: config.whatsappEnabled,
        },
      },
      {
        id: 'long-running-job-rule',
        name: 'Long Running Job Alert',
        type: 'long_running_job',
        enabled: true,
        conditions: {
          duration: 4 * 60 * 60, // Alert if job runs longer than 4 hours
        },
        actions: {
          email: true,
          whatsapp: config.whatsappEnabled,
        },
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    logger.info(`Loaded ${defaultRules.length} default alert rules`);
  }

  public async createAlert(alert: Omit<Alert, 'ruleId' | 'resolved' | 'resolvedAt'>): Promise<Alert> {
    // Find matching rule or create a default one
    const matchingRule = Array.from(this.alertRules.values()).find(rule => rule.type === alert.type);
    const ruleId = matchingRule?.id || 'default-rule';

    const fullAlert: Alert = {
      ...alert,
      ruleId,
      resolved: false,
    };

    // Store alert
    this.alerts.set(alert.id, fullAlert);
    
    // Cache alert
    await this.cacheService.set(`alert:${alert.id}`, fullAlert, 24 * 60 * 60); // Cache for 24 hours
    
    // Broadcast to WebSocket clients
    this.webSocketService.broadcastNewAlert(fullAlert);
    
    // Send notifications if rule is enabled
    if (matchingRule?.enabled) {
      await this.sendNotifications(fullAlert, matchingRule);
    }
    
    logger.info(`Alert created: ${alert.id} - ${alert.title}`);
    return fullAlert;
  }

  public async getAlert(alertId: string): Promise<Alert | null> {
    // Try to get from memory first
    const alert = this.alerts.get(alertId);
    if (alert) {
      return alert;
    }

    // Try to get from cache
    const cachedAlert = await this.cacheService.get<Alert>(`alert:${alertId}`);
    if (cachedAlert) {
      this.alerts.set(alertId, cachedAlert);
      return cachedAlert;
    }

    return null;
  }

  public async getAlerts(
    page = 1,
    limit = 50,
    filters?: {
      type?: Alert['type'];
      severity?: Alert['severity'];
      acknowledged?: boolean;
      resolved?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedResponse<Alert>> {
    try {
      let allAlerts = Array.from(this.alerts.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          allAlerts = allAlerts.filter(alert => alert.type === filters.type);
        }
        if (filters.severity) {
          allAlerts = allAlerts.filter(alert => alert.severity === filters.severity);
        }
        if (filters.acknowledged !== undefined) {
          allAlerts = allAlerts.filter(alert => alert.acknowledged === filters.acknowledged);
        }
        if (filters.resolved !== undefined) {
          allAlerts = allAlerts.filter(alert => alert.resolved === filters.resolved);
        }
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          allAlerts = allAlerts.filter(alert => new Date(alert.timestamp) >= startDate);
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          allAlerts = allAlerts.filter(alert => new Date(alert.timestamp) <= endDate);
        }
      }

      // Sort by timestamp (newest first)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Paginate
      const total = allAlerts.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedAlerts = allAlerts.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedAlerts,
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error getting alerts:', error);
      return {
        success: false,
        error: 'Failed to retrieve alerts',
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
  }

  public async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<ApiResponse<Alert>> {
    try {
      const alert = await this.getAlert(alertId);
      
      if (!alert) {
        return {
          success: false,
          error: 'Alert not found',
          timestamp: new Date().toISOString(),
        };
      }

      if (alert.acknowledged) {
        return {
          success: false,
          error: 'Alert already acknowledged',
          timestamp: new Date().toISOString(),
        };
      }

      // Update alert
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();

      // Update in memory and cache
      this.alerts.set(alertId, alert);
      await this.cacheService.set(`alert:${alertId}`, alert, 24 * 60 * 60);

      // Broadcast update
      this.webSocketService.broadcastAlertUpdate(alert);

      // Send webhook notifications
      await this.sendWebhookNotifications(alert, 'alert.acknowledged');

      logger.info(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
      
      return {
        success: true,
        data: alert,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      return {
        success: false,
        error: 'Failed to acknowledge alert',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async resolveAlert(
    alertId: string,
    resolvedBy?: string
  ): Promise<ApiResponse<Alert>> {
    try {
      const alert = await this.getAlert(alertId);
      
      if (!alert) {
        return {
          success: false,
          error: 'Alert not found',
          timestamp: new Date().toISOString(),
        };
      }

      if (alert.resolved) {
        return {
          success: false,
          error: 'Alert already resolved',
          timestamp: new Date().toISOString(),
        };
      }

      // Update alert
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      if (resolvedBy) {
        alert.metadata = { ...alert.metadata, resolvedBy };
      }

      // Update in memory and cache
      this.alerts.set(alertId, alert);
      await this.cacheService.set(`alert:${alertId}`, alert, 24 * 60 * 60);

      // Broadcast update
      this.webSocketService.broadcastAlertUpdate(alert);

      // Send webhook notifications
      await this.sendWebhookNotifications(alert, 'alert.resolved');

      logger.info(`Alert resolved: ${alertId}${resolvedBy ? ` by ${resolvedBy}` : ''}`);
      
      return {
        success: true,
        data: alert,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error resolving alert:', error);
      return {
        success: false,
        error: 'Failed to resolve alert',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async deleteAlert(alertId: string): Promise<ApiResponse<boolean>> {
    try {
      const alert = this.alerts.get(alertId);
      
      if (!alert) {
        return {
          success: false,
          error: 'Alert not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Remove from memory and cache
      this.alerts.delete(alertId);
      await this.cacheService.delete(`alert:${alertId}`);

      logger.info(`Alert deleted: ${alertId}`);
      
      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error deleting alert:', error);
      return {
        success: false,
        error: 'Failed to delete alert',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getAlertRules(): Promise<ApiResponse<AlertRule[]>> {
    try {
      const rules = Array.from(this.alertRules.values());
      return {
        success: true,
        data: rules,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error getting alert rules:', error);
      return {
        success: false,
        error: 'Failed to retrieve alert rules',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<ApiResponse<AlertRule>> {
    try {
      const rule = this.alertRules.get(ruleId);
      
      if (!rule) {
        return {
          success: false,
          error: 'Alert rule not found',
          timestamp: new Date().toISOString(),
        };
      }

      // Update rule
      const updatedRule = { ...rule, ...updates, id: ruleId };
      this.alertRules.set(ruleId, updatedRule);

      logger.info(`Alert rule updated: ${ruleId}`);
      
      return {
        success: true,
        data: updatedRule,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error updating alert rule:', error);
      return {
        success: false,
        error: 'Failed to update alert rule',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    try {
      // Email notification
      if (rule.actions.email) {
        await this.sendEmailNotification(alert);
      }

      // WhatsApp notification
      if (rule.actions.whatsapp && config.whatsappEnabled) {
        await this.sendWhatsAppNotification(alert);
      }

      // Webhook notification
      if (rule.actions.webhook) {
        await this.sendWebhookNotification(alert, rule.actions.webhook);
      }
    } catch (error) {
      logger.error('Error sending notifications:', error);
    }
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // TODO: Implement email notification
    logger.info(`Email notification would be sent for alert: ${alert.id}`);
  }

  private async sendWhatsAppNotification(alert: Alert): Promise<void> {
    try {
      // Format WhatsApp message
      const message = this.formatWhatsAppMessage(alert);
      
      // Get WhatsApp recipients from config or alert rule
      const rule = this.alertRules.get(alert.ruleId);
      const recipients = rule?.actions.whatsappRecipients || config.whatsappDefaultRecipients;
      
      if (!recipients || recipients.length === 0) {
        logger.warn(`No WhatsApp recipients configured for alert: ${alert.id}`);
        return;
      }

      // Send to each recipient
      for (const recipient of recipients) {
        try {
          const normalizedNumber = this.normalizePhoneNumber(recipient.trim());
          
          // Use direct WhatsApp API endpoint
          const response = await fetch(`${config.whatsappApiUrl}/send-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(config.whatsappApiToken && { 'Authorization': `Bearer ${config.whatsappApiToken}` })
              },
            body: JSON.stringify({
              to: normalizedNumber,
              message: message
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (!response.ok) {
            throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
          }

          logger.info(`WhatsApp notification sent successfully to ${normalizedNumber} for alert: ${alert.id}`);
        } catch (error) {
          logger.error(`Failed to send WhatsApp notification to ${recipient}:`, error);
        }
      }
    } catch (error) {
      logger.error(`Failed to send WhatsApp notifications for alert ${alert.id}:`, error);
      // Don't throw error to prevent alert operation from failing
    }
  }

  private formatWhatsAppMessage(alert: Alert): string {
    const severityEmoji = {
      'critical': '🚨',
      'high': '⚠️',
      'medium': '⚡',
      'low': 'ℹ️'
    }[alert.severity] || '📢';

    const typeEmoji = {
      'job_failure': '❌',
      'storage_threshold': '💾',
      'infrastructure_down': '🔴',
      'long_running_job': '⏰',
      'error': '🚫',
      'warning': '⚠️'
    }[alert.type] || '📋';

    return `${severityEmoji} *Veeam Alert*\n\n` +
           `${typeEmoji} *${alert.title}*\n\n` +
           `📝 ${alert.message}\n\n` +
           `🔹 Severity: ${alert.severity.toUpperCase()}\n` +
           `🔹 Type: ${alert.type.replace('_', ' ').toUpperCase()}\n` +
           `🔹 Time: ${new Date(alert.timestamp).toLocaleString()}\n\n` +
           `_Alert ID: ${alert.id}_`;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If starts with 0, replace with country code (assuming Indonesia +62)
    if (digits.startsWith('0')) {
      return '62' + digits.substring(1);
    }
    
    // If doesn't start with country code, add Indonesia country code
    if (!digits.startsWith('62')) {
      return '62' + digits;
    }
    
    return digits;
  }

  private async sendWebhookNotification(alert: Alert, webhookUrl: string, eventType: 'alert.created' | 'alert.acknowledged' | 'alert.resolved' = 'alert.created'): Promise<void> {
    try {
      const webhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        alert: {
          id: alert.id,
          ruleId: alert.ruleId,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp,
          acknowledged: alert.acknowledged,
          acknowledgedBy: alert.acknowledgedBy,
          acknowledgedAt: alert.acknowledgedAt,
          resolved: alert.resolved,
          resolvedAt: alert.resolvedAt,
          metadata: alert.metadata
        },
        source: {
          system: 'veeam-insight-dash',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Veeam-Insight-Dashboard/1.0.0'
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      logger.info(`Webhook notification sent successfully to ${webhookUrl} for alert: ${alert.id} (${eventType})`);
    } catch (error) {
      logger.error(`Failed to send webhook notification to ${webhookUrl}:`, error);
      // Don't throw error to prevent alert operation from failing
    }
  }

  private async sendWebhookNotifications(alert: Alert, eventType: 'alert.created' | 'alert.acknowledged' | 'alert.resolved'): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId);
    if (rule?.actions.webhook) {
      await this.sendWebhookNotification(alert, rule.actions.webhook, eventType);
    }
  }

  public async getAlertStats(): Promise<{
    total: number;
    byType: Record<Alert['type'], number>;
    bySeverity: Record<Alert['severity'], number>;
    acknowledged: number;
    resolved: number;
    active: number;
  }> {
    const alerts = Array.from(this.alerts.values());
    
    const stats = {
      total: alerts.length,
      byType: {
        job_failure: 0,
        storage_threshold: 0,
        infrastructure_down: 0,
        long_running_job: 0,
      } as Record<Alert['type'], number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<Alert['severity'], number>,
      acknowledged: 0,
      resolved: 0,
      active: 0,
    };

    alerts.forEach(alert => {
      stats.byType[alert.type]++;
      stats.bySeverity[alert.severity]++;
      
      if (alert.acknowledged) {
        stats.acknowledged++;
      }
      
      if (alert.resolved) {
        stats.resolved++;
      } else {
        stats.active++;
      }
    });

    return stats;
  }

  public async cleanup(): Promise<void> {
    // Clean up old resolved alerts (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const alertsToRemove: string[] = [];

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt) {
        const resolvedDate = new Date(alert.resolvedAt);
        if (resolvedDate < thirtyDaysAgo) {
          alertsToRemove.push(alertId);
        }
      }
    }

    for (const alertId of alertsToRemove) {
      this.alerts.delete(alertId);
      await this.cacheService.delete(`alert:${alertId}`);
    }

    if (alertsToRemove.length > 0) {
      logger.info(`Cleaned up ${alertsToRemove.length} old resolved alerts`);
    }
  }

  public shutdown(): void {
    logger.info('Shutting down alert service...');
    this.alerts.clear();
    this.alertRules.clear();
    logger.info('Alert service shutdown complete');
  }
}