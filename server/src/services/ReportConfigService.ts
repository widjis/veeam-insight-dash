import { PrismaClient, ReportConfig, ReportConfigType, ReportFormat, WhatsAppReportFormat } from '../generated/prisma';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface CreateReportConfigData {
  name: string;
  type: ReportConfigType;
  enabled?: boolean;
  deliveryTime: string;
  timezone?: string;
  emailEnabled?: boolean;
  emailRecipients?: string[];
  emailFormat?: ReportFormat;
  whatsappEnabled?: boolean;
  whatsappRecipients?: string[];
  whatsappFormat?: WhatsAppReportFormat;
  includeJobs?: boolean;
  includeRepositories?: boolean;
  includeAlerts?: boolean;
  createdBy?: string;
}

export interface UpdateReportConfigData extends Partial<CreateReportConfigData> {
  lastRun?: Date;
  nextRun?: Date;
}

export class ReportConfigService {
  /**
   * Get all report configurations
   */
  static async getAllConfigs(): Promise<ReportConfig[]> {
    try {
      return await prisma.reportConfig.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching report configurations:', error);
      throw new Error('Failed to fetch report configurations');
    }
  }

  /**
   * Get report configuration by ID
   */
  static async getConfigById(id: string): Promise<ReportConfig | null> {
    try {
      return await prisma.reportConfig.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error(`Error fetching report configuration ${id}:`, error);
      throw new Error('Failed to fetch report configuration');
    }
  }

  /**
   * Get enabled report configurations
   */
  static async getEnabledConfigs(): Promise<ReportConfig[]> {
    try {
      return await prisma.reportConfig.findMany({
        where: { enabled: true },
        orderBy: { deliveryTime: 'asc' }
      });
    } catch (error) {
      logger.error('Error fetching enabled report configurations:', error);
      throw new Error('Failed to fetch enabled report configurations');
    }
  }

  /**
   * Create a new report configuration
   */
  static async createConfig(data: CreateReportConfigData): Promise<ReportConfig> {
    try {
      const config = await prisma.reportConfig.create({
        data: {
          name: data.name,
          type: data.type,
          enabled: data.enabled ?? false,
          deliveryTime: data.deliveryTime,
          timezone: data.timezone ?? 'UTC',
          emailEnabled: data.emailEnabled ?? false,
          emailRecipients: data.emailRecipients ?? [],
          emailFormat: data.emailFormat ?? ReportFormat.HTML,
          whatsappEnabled: data.whatsappEnabled ?? false,
          whatsappRecipients: data.whatsappRecipients ?? [],
          whatsappFormat: data.whatsappFormat ?? WhatsAppReportFormat.SUMMARY,
          includeJobs: data.includeJobs ?? true,
          includeRepositories: data.includeRepositories ?? true,
          includeAlerts: data.includeAlerts ?? true,
          createdBy: data.createdBy
        }
      });

      logger.info(`Created report configuration: ${config.name} (${config.id})`);
      return config;
    } catch (error) {
      logger.error('Error creating report configuration:', error);
      throw new Error('Failed to create report configuration');
    }
  }

  /**
   * Update a report configuration
   */
  static async updateConfig(id: string, data: UpdateReportConfigData): Promise<ReportConfig> {
    try {
      const config = await prisma.reportConfig.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      logger.info(`Updated report configuration: ${config.name} (${config.id})`);
      return config;
    } catch (error) {
      logger.error(`Error updating report configuration ${id}:`, error);
      throw new Error('Failed to update report configuration');
    }
  }

  /**
   * Delete a report configuration
   */
  static async deleteConfig(id: string): Promise<void> {
    try {
      await prisma.reportConfig.delete({
        where: { id }
      });

      logger.info(`Deleted report configuration: ${id}`);
    } catch (error) {
      logger.error(`Error deleting report configuration ${id}:`, error);
      throw new Error('Failed to delete report configuration');
    }
  }

  /**
   * Toggle enabled status of a report configuration
   */
  static async toggleConfig(id: string): Promise<ReportConfig> {
    try {
      const currentConfig = await this.getConfigById(id);
      if (!currentConfig) {
        throw new Error('Report configuration not found');
      }

      const config = await prisma.reportConfig.update({
        where: { id },
        data: {
          enabled: !currentConfig.enabled,
          updatedAt: new Date()
        }
      });

      logger.info(`Toggled report configuration: ${config.name} (${config.id}) - enabled: ${config.enabled}`);
      return config;
    } catch (error) {
      logger.error(`Error toggling report configuration ${id}:`, error);
      throw new Error('Failed to toggle report configuration');
    }
  }

  /**
   * Update last run time for a configuration
   */
  static async updateLastRun(id: string, lastRun: Date, nextRun?: Date): Promise<void> {
    try {
      await prisma.reportConfig.update({
        where: { id },
        data: {
          lastRun,
          nextRun,
          updatedAt: new Date()
        }
      });

      logger.info(`Updated last run for report configuration: ${id}`);
    } catch (error) {
      logger.error(`Error updating last run for report configuration ${id}:`, error);
      throw new Error('Failed to update last run');
    }
  }

  /**
   * Get configurations by type
   */
  static async getConfigsByType(type: ReportConfigType): Promise<ReportConfig[]> {
    try {
      return await prisma.reportConfig.findMany({
        where: { type },
        orderBy: { deliveryTime: 'asc' }
      });
    } catch (error) {
      logger.error(`Error fetching report configurations by type ${type}:`, error);
      throw new Error('Failed to fetch report configurations by type');
    }
  }
}

export default ReportConfigService;