import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { AlertService } from './AlertService.js';
import { configService } from './configService.js';
import config from '../config/environment.js';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import { generateReportData } from '../routes/reports.js';
import { ReportConfigService } from './ReportConfigService.js';

export interface ScheduledReportConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string; // Cron expression
  reportType: 'summary' | 'detailed' | 'custom';
  format: 'html' | 'pdf' | 'csv';
  includeJobs: boolean;
  includeRepositories: boolean;
  includeAlerts: boolean;
  dateRange: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number;
  delivery: {
    email: {
      enabled: boolean;
      recipients: string[];
      subject?: string;
    };
    whatsapp: {
      enabled: boolean;
      recipients: string[];
      format: 'summary' | 'detailed';
    };
  };
  timezone: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

export class ScheduledReportService {
  private alertService: AlertService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private scheduledReports: Map<string, ScheduledReportConfig> = new Map();
  private emailTransporter: nodemailer.Transporter | null = null;
  private isRunning = false;

  constructor(alertService: AlertService) {
    this.alertService = alertService;
    this.initializeEmailTransporter();
    // Load report configs asynchronously after construction
    this.loadReportConfigsFromDatabase().catch(error => {
      logger.error('Failed to load report configurations during initialization:', error);
    });
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Scheduled report service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduled report service...');

    // Start all scheduled reports
    for (const [reportId, reportConfig] of this.scheduledReports) {
      if (reportConfig.enabled) {
        this.scheduleReport(reportId, reportConfig);
      }
    }

    logger.info(`Scheduled report service started with ${this.scheduledJobs.size} active schedules`);
  }

  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Scheduled report service is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping scheduled report service...');

    // Stop all scheduled jobs
    for (const [reportId, job] of this.scheduledJobs) {
      job.stop();
      logger.debug(`Stopped scheduled report: ${reportId}`);
    }

    this.scheduledJobs.clear();
    logger.info('Scheduled report service stopped');
  }



  private async initializeEmailTransporter(): Promise<void> {
    try {
      const notificationConfig = await configService.getNotificationConfig();
      
      if (notificationConfig.email.enabled && notificationConfig.email.host) {
        this.emailTransporter = nodemailer.createTransport({
          host: notificationConfig.email.host,
          port: notificationConfig.email.port,
          secure: notificationConfig.email.port === 465,
          auth: {
            user: notificationConfig.email.user,
            pass: notificationConfig.email.password,
          },
        });
        
        logger.info('Email transporter initialized successfully');
      } else {
        logger.warn('Email configuration not available, email delivery disabled');
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  private async loadReportConfigsFromDatabase(): Promise<void> {
    try {
      const reportConfigs = await ReportConfigService.getEnabledConfigs();
      
      for (const config of reportConfigs) {
        const scheduledReport: ScheduledReportConfig = this.convertReportConfigToScheduledReport(config);
        this.scheduledReports.set(scheduledReport.id, scheduledReport);
      }
      
      logger.info(`Loaded ${reportConfigs.length} report configurations from database`);
    } catch (error) {
      logger.error('Failed to load report configurations from database:', error);
      // Fallback to default reports if database loading fails
      this.loadFallbackReports();
    }
  }

  private convertReportConfigToScheduledReport(config: any): ScheduledReportConfig {
    // Convert database ReportConfig to ScheduledReportConfig format
    const cronExpression = this.generateCronExpression(config.type, config.deliveryTime);
    
    return {
      id: config.id.toString(),
      name: config.name,
      enabled: config.enabled,
      schedule: cronExpression,
      reportType: this.mapReportType(config.type),
      format: config.reportFormat.toLowerCase() as 'html' | 'pdf' | 'csv',
      includeJobs: true,
      includeRepositories: true,
      includeAlerts: true,
      dateRange: this.mapDateRange(config.type),
      delivery: {
        email: {
          enabled: config.emailRecipients && config.emailRecipients.length > 0,
          recipients: config.emailRecipients || [],
          subject: `${config.name} - Veeam Backup Report`,
        },
        whatsapp: {
          enabled: config.whatsappEnabled || false,
          recipients: config.whatsappRecipients || [],
          format: config.whatsappFormat?.toLowerCase() as 'summary' | 'detailed' || 'summary',
        },
      },
      timezone: config.timezone || 'UTC',
      createdAt: config.createdAt,
      lastRun: config.lastRun,
    };
  }

  private generateCronExpression(reportType: string, deliveryTime: string): string {
    const [hours, minutes] = deliveryTime.split(':').map(Number);
    
    switch (reportType) {
      case 'DAILY_SUMMARY':
        return `${minutes} ${hours} * * *`; // Every day at specified time
      case 'WEEKLY_TREND':
        return `${minutes} ${hours} * * 1`; // Every Monday at specified time
      case 'MONTHLY_CAPACITY':
        return `${minutes} ${hours} 1 * *`; // First day of every month at specified time
      default:
        return `${minutes} ${hours} * * *`; // Default to daily
    }
  }

  private mapReportType(dbType: string): 'summary' | 'detailed' | 'custom' {
    switch (dbType) {
      case 'DAILY_SUMMARY':
        return 'summary';
      case 'WEEKLY_TREND':
        return 'detailed';
      case 'MONTHLY_CAPACITY':
        return 'custom';
      default:
        return 'summary';
    }
  }

  private mapDateRange(dbType: string): 'daily' | 'weekly' | 'monthly' | 'custom' {
    switch (dbType) {
      case 'DAILY_SUMMARY':
        return 'daily';
      case 'WEEKLY_TREND':
        return 'weekly';
      case 'MONTHLY_CAPACITY':
        return 'monthly';
      default:
        return 'daily';
    }
  }

  private loadFallbackReports(): void {
    const fallbackReport: ScheduledReportConfig = {
      id: 'fallback-daily',
      name: 'Daily Summary Report (Fallback)',
      enabled: true,
      schedule: '0 9 * * *', // Every day at 9:00 AM
      reportType: 'summary',
      format: 'html',
      includeJobs: true,
      includeRepositories: true,
      includeAlerts: true,
      dateRange: 'daily',
      delivery: {
        email: {
          enabled: false,
          recipients: [],
        },
        whatsapp: {
          enabled: false,
          recipients: [],
          format: 'summary',
        },
      },
      timezone: 'UTC',
      createdAt: new Date(),
    };

    this.scheduledReports.set(fallbackReport.id, fallbackReport);
    logger.info('Loaded fallback report configuration');
  }

  public async reloadReportConfigs(): Promise<void> {
    // Stop all current jobs
    for (const [reportId, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();
    this.scheduledReports.clear();

    // Reload from database
    await this.loadReportConfigsFromDatabase();

    // Restart jobs if service is running
    if (this.isRunning) {
      for (const [reportId, reportConfig] of this.scheduledReports) {
        if (reportConfig.enabled) {
          this.scheduleReport(reportId, reportConfig);
        }
      }
    }

    logger.info('Report configurations reloaded from database');
  }

  public startScheduler(): void {
    logger.info('Starting scheduled report service...');
    
    this.scheduledReports.forEach((report, id) => {
      if (report.enabled) {
        this.scheduleReport(id, report);
      }
    });

    logger.info(`Scheduled ${this.scheduledJobs.size} reports`);
  }

  public stopScheduler(): void {
    logger.info('Stopping scheduled report service...');
    
    this.scheduledJobs.forEach((job, id) => {
      job.stop();
      logger.debug(`Stopped scheduled report: ${id}`);
    });
    
    this.scheduledJobs.clear();
    logger.info('All scheduled reports stopped');
  }

  private scheduleReport(id: string, report: ScheduledReportConfig): void {
    try {
      const task = cron.schedule(report.schedule, async () => {
        await this.executeScheduledReport(id, report);
      }, {
        scheduled: false,
        timezone: report.timezone,
      });

      task.start();
      this.scheduledJobs.set(id, task);
      
      // Update next run time
      report.nextRun = this.getNextRunTime(report.schedule, report.timezone);
      
      logger.info(`Scheduled report '${report.name}' (${id}) with cron: ${report.schedule}`);
    } catch (error) {
      logger.error(`Failed to schedule report '${report.name}' (${id}):`, error);
    }
  }

  private async executeScheduledReport(id: string, report: ScheduledReportConfig): Promise<void> {
    try {
      logger.info(`Executing scheduled report: ${report.name} (${id})`);
      
      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(report.dateRange, report.customDays);
      
      // Generate report data using real data from monitoring service
      const reportData = {
        success: true,
        data: await generateReportData({
          type: report.reportType === 'detailed' ? 'detailed' : 'summary',
          startDate,
          endDate,
          includeJobs: report.includeJobs,
          includeRepositories: report.includeRepositories,
          includeAlerts: report.includeAlerts
        })
      };
      
      // Add date range to the data
      reportData.data.dateRange = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };

      if (!reportData.success) {
        throw new Error(`Report generation failed`);
      }

      // Generate formatted report for delivery
      const formattedReport = {
        data: JSON.stringify(reportData.data)
      };

      // Deliver report
      await this.deliverReport(report, reportData.data, formattedReport.data);
      
      // Update last run time in memory and database
      const lastRunTime = new Date();
      report.lastRun = lastRunTime;
      report.nextRun = this.getNextRunTime(report.schedule, report.timezone);
      
      // Update last run time in database
       try {
         await ReportConfigService.updateLastRun(id, lastRunTime);
       } catch (dbError) {
         logger.warn(`Failed to update last run time in database for report ${id}:`, dbError);
       }
      
      logger.info(`Successfully executed scheduled report: ${report.name} (${id})`);
    } catch (error) {
      logger.error(`Failed to execute scheduled report '${report.name}' (${id}):`, error);
      
      // Send error notification
      await this.sendErrorNotification(report, error as Error);
    }
  }

  private calculateDateRange(dateRange: string, customDays?: number): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'custom':
        if (customDays) {
          startDate.setDate(endDate.getDate() - customDays);
        } else {
          startDate.setDate(endDate.getDate() - 1); // Default to daily
        }
        break;
      default:
        startDate.setDate(endDate.getDate() - 1);
    }

    return { startDate, endDate };
  }

  private async deliverReport(report: ScheduledReportConfig, reportData: any, formattedReport: any): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    // Email delivery
    if (report.delivery.email.enabled && report.delivery.email.recipients.length > 0) {
      deliveryPromises.push(this.sendEmailReport(report, reportData, formattedReport));
    }

    // WhatsApp delivery
    if (report.delivery.whatsapp.enabled && report.delivery.whatsapp.recipients.length > 0) {
      deliveryPromises.push(this.sendWhatsAppReport(report, reportData));
    }

    await Promise.allSettled(deliveryPromises);
  }

  private async sendEmailReport(report: ScheduledReportConfig, reportData: any, formattedReport: any): Promise<void> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email transporter not initialized');
      }

      const subject = report.delivery.email.subject || `${report.name} - ${new Date().toLocaleDateString()}`;
      const attachments: any[] = [];

      let htmlContent = '';
      let textContent = '';

      if (report.format === 'html') {
        htmlContent = formattedReport;
        textContent = this.generateTextSummary(reportData);
      } else {
        htmlContent = this.generateEmailHtml(reportData);
        textContent = this.generateTextSummary(reportData);
        
        // Add formatted report as attachment
        const filename = `veeam-report-${new Date().toISOString().split('T')[0]}.${report.format}`;
        attachments.push({
          filename,
          content: formattedReport,
          contentType: this.getContentType(report.format),
        });
      }

      const mailOptions = {
        from: 'noreply@company.com',
        to: report.delivery.email.recipients.join(', '),
        subject,
        text: textContent,
        html: htmlContent,
        attachments,
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`Email report sent successfully to: ${report.delivery.email.recipients.join(', ')}`);
    } catch (error) {
      logger.error('Failed to send email report:', error);
      throw error;
    }
  }

  private async sendWhatsAppReport(report: ScheduledReportConfig, reportData: any): Promise<void> {
    try {
      const notificationConfig = await configService.getNotificationConfig();
      
      if (!notificationConfig.whatsapp.enabled || !notificationConfig.whatsapp.apiUrl) {
        throw new Error('WhatsApp configuration not available');
      }

      const message = this.formatWhatsAppReport(report, reportData);
      
      for (const recipient of report.delivery.whatsapp.recipients) {
        try {
          const normalizedNumber = this.normalizePhoneNumber(recipient.trim());
          
          const response = await fetch(`${notificationConfig.whatsapp.apiUrl}/send-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: normalizedNumber,
              message: message,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
          }

          logger.info(`WhatsApp report sent successfully to ${normalizedNumber}`);
        } catch (error) {
          logger.error(`Failed to send WhatsApp report to ${recipient}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to send WhatsApp report:', error);
      throw error;
    }
  }

  private formatWhatsAppReport(report: ScheduledReportConfig, reportData: any): string {
    const summary = reportData.summary || {};
    const dateRange = `${reportData.dateRange?.startDate || 'N/A'} to ${reportData.dateRange?.endDate || 'N/A'}`;
    
    let message = `🔄 *${report.name}*\n\n` +
                 `📅 Period: ${dateRange}\n\n` +
                 `📊 *Summary:*\n` +
                 `• Total Jobs: ${summary.totalJobs || 0}\n` +
                 `• ✅ Successful: ${summary.successfulJobs || 0}\n` +
                 `• ❌ Failed: ${summary.failedJobs || 0}\n` +
                 `• ⚠️ Warnings: ${summary.warningJobs || 0}\n` +
                 `• 🚨 Active Alerts: ${summary.totalAlerts || 0}\n\n`;
    
    // Add repository details
    if (reportData.repositories && reportData.repositories.length > 0) {
      message += `💾 *Repositories:*\n`;
      reportData.repositories.forEach((repo: any) => {
        const capacityGB = repo.capacity || repo.capacityGB || 0;
        const usedGB = repo.used || repo.usedSpaceGB || 0;
        const capacityTB = (capacityGB / 1024).toFixed(2);
        const usedTB = (usedGB / 1024).toFixed(2);
        const usagePercent = capacityGB > 0 ? ((usedGB / capacityGB) * 100).toFixed(1) : '0';
        
        message += `• ${repo.name || 'Unknown'}: ${usedTB}TB / ${capacityTB}TB (${usagePercent}%)\n`;
      });
      message += `\n`;
    }
    
    // Add failed jobs details if any (for both summary and detailed formats)
    if (reportData.jobs && summary.failedJobs > 0) {
      const failedJobs = reportData.jobs.filter((job: any) => job.lastResult === 'Failed');
      if (failedJobs.length > 0) {
        message += `🚨 *Failed Jobs:*\n`;
        const jobsToShow = report.delivery.whatsapp.format === 'summary' ? failedJobs.slice(0, 3) : failedJobs.slice(0, 5);
        jobsToShow.forEach((job: any) => {
          message += `• ${job.name || 'Unknown Job'}: ${job.message || 'No details available'}\n`;
        });
        if (failedJobs.length > jobsToShow.length) {
          message += `• ... and ${failedJobs.length - jobsToShow.length} more\n`;
        }
        message += '\n';
      }
    }
    
    message += `Generated: ${new Date().toLocaleString()}`;
    return message;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let normalized = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming +1 for US/Canada)
    if (normalized.length === 10) {
      normalized = '1' + normalized;
    }
    
    // Add + prefix
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }

  private generateEmailHtml(reportData: any): string {
    const summary = reportData.summary || {};
    const dateRange = `${reportData.dateRange?.startDate || 'N/A'} to ${reportData.dateRange?.endDate || 'N/A'}`;
    
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; }
            .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
            .summary-card { background-color: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
            .success { color: #28a745; }
            .failed { color: #dc3545; }
            .warning { color: #ffc107; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Veeam Backup Report</h1>
            <p><strong>Period:</strong> ${dateRange}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>Total Jobs</h3>
              <div style="font-size: 24px; font-weight: bold;">${summary.totalJobs || 0}</div>
            </div>
            <div class="summary-card">
              <h3>Successful</h3>
              <div style="font-size: 24px; font-weight: bold;" class="success">${summary.successfulJobs || 0}</div>
            </div>
            <div class="summary-card">
              <h3>Failed</h3>
              <div style="font-size: 24px; font-weight: bold;" class="failed">${summary.failedJobs || 0}</div>
            </div>
            <div class="summary-card">
              <h3>Warnings</h3>
              <div style="font-size: 24px; font-weight: bold;" class="warning">${summary.warningJobs || 0}</div>
            </div>
            <div class="summary-card">
              <h3>Repositories</h3>
              <div style="font-size: 24px; font-weight: bold;">${summary.totalRepositories || 0}</div>
            </div>
            <div class="summary-card">
              <h3>Active Alerts</h3>
              <div style="font-size: 24px; font-weight: bold;">${summary.totalAlerts || 0}</div>
            </div>
          </div>
          
          <p><em>For detailed information, please check the attached report or visit the Veeam Insight Dashboard.</em></p>
        </body>
      </html>
    `;
  }

  private generateTextSummary(reportData: any): string {
    const summary = reportData.summary || {};
    const dateRange = `${reportData.dateRange?.startDate || 'N/A'} to ${reportData.dateRange?.endDate || 'N/A'}`;
    
    return `Veeam Backup Report\n\n` +
           `Period: ${dateRange}\n` +
           `Generated: ${new Date().toLocaleString()}\n\n` +
           `Summary:\n` +
           `- Total Jobs: ${summary.totalJobs || 0}\n` +
           `- Successful Jobs: ${summary.successfulJobs || 0}\n` +
           `- Failed Jobs: ${summary.failedJobs || 0}\n` +
           `- Warning Jobs: ${summary.warningJobs || 0}\n` +
           `- Repositories: ${summary.totalRepositories || 0}\n` +
           `- Active Alerts: ${summary.totalAlerts || 0}\n\n` +
           `For detailed information, please check the attached report or visit the Veeam Insight Dashboard.`;
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
      case 'csv':
        return 'text/csv';
      case 'html':
        return 'text/html';
      default:
        return 'application/octet-stream';
    }
  }

  private getNextRunTime(cronExpression: string, timezone: string): Date {
    try {
      // This is a simplified calculation - in production, you might want to use a more robust cron parser
      const now = new Date();
      const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to next day
      return nextRun;
    } catch (error) {
      logger.error('Failed to calculate next run time:', error);
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }

  private async sendErrorNotification(report: ScheduledReportConfig, error: Error): Promise<void> {
    try {
      // Create an alert for the failed scheduled report
      const alert = {
        id: `scheduled-report-error-${Date.now()}`,
        ruleId: 'scheduled-report-rule',
        type: 'error' as const,
        severity: 'high' as const,
        title: 'Scheduled Report Failed',
        message: `Failed to execute scheduled report '${report.name}': ${error.message}`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
        metadata: {
          reportId: report.id,
          reportName: report.name,
          errorMessage: error.message,
          scheduledTime: new Date().toISOString(),
        },
      };

      // Send through alert service
      await this.alertService.createAlert(alert);
      
      logger.info(`Error notification sent for failed scheduled report: ${report.name}`);
    } catch (notificationError) {
      logger.error('Failed to send error notification:', notificationError);
    }
  }

  // Public API methods
  public getScheduledReports(): Map<string, ScheduledReportConfig> {
    return new Map(this.scheduledReports);
  }

  public getScheduledReport(id: string): ScheduledReportConfig | undefined {
    return this.scheduledReports.get(id);
  }

  public async createScheduledReport(config: Omit<ScheduledReportConfig, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): Promise<ScheduledReportConfig> {
    const id = `custom-${Date.now()}`;
    const scheduledReport: ScheduledReportConfig = {
      ...config,
      id,
      createdAt: new Date(),
      nextRun: config.enabled ? this.getNextRunTime(config.schedule, config.timezone) : undefined,
    };

    this.scheduledReports.set(id, scheduledReport);
    
    if (scheduledReport.enabled) {
      this.scheduleReport(id, scheduledReport);
    }

    logger.info(`Created new scheduled report: ${scheduledReport.name} (${id})`);
    return scheduledReport;
  }

  public async updateScheduledReport(id: string, updates: Partial<ScheduledReportConfig>): Promise<ScheduledReportConfig | null> {
    const existingReport = this.scheduledReports.get(id);
    if (!existingReport) {
      return null;
    }

    // Stop existing job if it exists
    const existingJob = this.scheduledJobs.get(id);
    if (existingJob) {
      existingJob.stop();
      this.scheduledJobs.delete(id);
    }

    // Update the report configuration
    const updatedReport: ScheduledReportConfig = {
      ...existingReport,
      ...updates,
      id, // Ensure ID doesn't change
      nextRun: updates.enabled !== false ? this.getNextRunTime(updates.schedule || existingReport.schedule, updates.timezone || existingReport.timezone) : undefined,
    };

    this.scheduledReports.set(id, updatedReport);
    
    // Reschedule if enabled
    if (updatedReport.enabled) {
      this.scheduleReport(id, updatedReport);
    }

    logger.info(`Updated scheduled report: ${updatedReport.name} (${id})`);
    return updatedReport;
  }

  public async deleteScheduledReport(id: string): Promise<boolean> {
    const existingJob = this.scheduledJobs.get(id);
    if (existingJob) {
      existingJob.stop();
      this.scheduledJobs.delete(id);
    }

    const deleted = this.scheduledReports.delete(id);
    
    if (deleted) {
      logger.info(`Deleted scheduled report: ${id}`);
    }
    
    return deleted;
  }

  public async executeReportNow(id: string): Promise<void> {
    const report = this.scheduledReports.get(id);
    if (!report) {
      throw new Error(`Scheduled report with ID ${id} not found`);
    }

    await this.executeScheduledReport(id, report);
  }

  public addScheduledReport(id: string, config: ScheduledReportConfig): void {
    this.scheduledReports.set(id, config);
    
    if (this.isRunning && config.enabled) {
      this.scheduleReport(id, config);
    }
    
    logger.info(`Added scheduled report: ${config.name} (${id})`);
  }

  public removeScheduledReport(id: string): boolean {
    const config = this.scheduledReports.get(id);
    if (!config) {
      return false;
    }

    // Stop the job if it's running
    const job = this.scheduledJobs.get(id);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(id);
    }

    this.scheduledReports.delete(id);
    logger.info(`Removed scheduled report: ${config.name} (${id})`);
    return true;
  }

  public toggleScheduledReport(id: string, enabled: boolean): boolean {
    const config = this.scheduledReports.get(id);
    if (!config) {
      return false;
    }

    config.enabled = enabled;
    this.scheduledReports.set(id, config);

    if (this.isRunning) {
      const job = this.scheduledJobs.get(id);
      if (enabled && !job) {
        this.scheduleReport(id, config);
      } else if (!enabled && job) {
        job.stop();
        this.scheduledJobs.delete(id);
      }
    }

    logger.info(`${enabled ? 'Enabled' : 'Disabled'} scheduled report: ${config.name} (${id})`);
    return true;
  }

  public async triggerReport(id: string): Promise<boolean> {
    try {
      await this.executeReportNow(id);
      return true;
    } catch (error) {
      logger.error(`Failed to trigger report ${id}:`, error);
      return false;
    }
  }

  public getSchedulerStatus(): { running: boolean; totalJobs: number; activeJobs: number } {
    return {
      running: this.scheduledJobs.size > 0,
      totalJobs: this.scheduledReports.size,
      activeJobs: this.scheduledJobs.size,
    };
  }
}