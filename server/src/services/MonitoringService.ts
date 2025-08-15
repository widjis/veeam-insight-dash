import { VeeamService } from './VeeamService.js';
import { MockVeeamService } from './MockVeeamService.js';
import { WebSocketService } from './WebSocketService.js';
import { CacheService } from './CacheService.js';
import { AlertService } from './AlertService.js';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import {
  DashboardStats,
  VeeamJobState,
  VeeamRepositoryState,
  VeeamSession,
  SystemMetrics,
  HealthCheck,
  Alert
} from '@/types/index.js';
import os from 'os';
import process from 'process';

export class MonitoringService {
  private veeamService: VeeamService | MockVeeamService;
  private webSocketService: WebSocketService;
  private cacheService: CacheService;
  private alertService: AlertService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    veeamService: VeeamService | MockVeeamService,
    webSocketService: WebSocketService,
    cacheService: CacheService,
    alertService: AlertService
  ) {
    this.veeamService = veeamService;
    this.webSocketService = webSocketService;
    this.cacheService = cacheService;
    this.alertService = alertService;
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Monitoring service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting monitoring service...');

    // Start main monitoring loop
    this.startMainMonitoring();
    
    // Start health check monitoring
    this.startHealthCheckMonitoring();
    
    // Start system metrics monitoring
    this.startSystemMetricsMonitoring();

    logger.info('Monitoring service started successfully');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Monitoring service is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping monitoring service...');

    // Clear all intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Shutdown WebSocket service
    await this.webSocketService.shutdown();

    logger.info('Monitoring service stopped');
  }

  private startMainMonitoring(): void {
    // Run immediately
    this.performMonitoringCycle();

    // Set up recurring monitoring
    this.monitoringInterval = setInterval(
      () => this.performMonitoringCycle(),
      config.monitoringInterval * 1000
    );

    logger.info(`Main monitoring started with ${config.monitoringInterval}s interval`);
  }

  private startHealthCheckMonitoring(): void {
    // Run immediately
    this.performHealthCheck();

    // Set up recurring health checks
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      config.healthCheckInterval * 1000
    );

    logger.info(`Health check monitoring started with ${config.healthCheckInterval}s interval`);
  }

  private startSystemMetricsMonitoring(): void {
    // Run immediately
    this.collectSystemMetrics();

    // Set up recurring metrics collection
    this.metricsInterval = setInterval(
      () => this.collectSystemMetrics(),
      config.metricsInterval * 1000
    );

    logger.info(`System metrics monitoring started with ${config.metricsInterval}s interval`);
  }

  private async performMonitoringCycle(): Promise<void> {
    try {
      logger.debug('Starting monitoring cycle...');

      // Collect data from Veeam API
      const [jobsResult, repositoriesResult, sessionsResult] = await Promise.allSettled([
        this.veeamService.getJobStates(),
        this.veeamService.getRepositoryStates(),
        this.veeamService.getSessionStates()
      ]);

      // Process jobs data
      let jobs: VeeamJobState[] = [];
      if (jobsResult.status === 'fulfilled' && jobsResult.value.success) {
        jobs = jobsResult.value.data || [];
        logger.info(`Fetched ${jobs.length} jobs from Veeam API`);
        await this.cacheService.set('jobs', jobs, 300); // Cache for 5 minutes
        this.webSocketService.broadcastJobsUpdate(jobs);
      } else {
        logger.error('Failed to fetch jobs:', jobsResult.status === 'rejected' ? jobsResult.reason : jobsResult.value.error);
      }

      // Process repositories data
      let repositories: VeeamRepositoryState[] = [];
      if (repositoriesResult.status === 'fulfilled' && repositoriesResult.value.success) {
        repositories = repositoriesResult.value.data || [];
        logger.info(`Fetched ${repositories.length} repositories from Veeam API`);
        await this.cacheService.set('repositories', repositories, 300);
        this.webSocketService.broadcastRepositoriesUpdate(repositories);
      } else {
        logger.error('Failed to fetch repositories:', repositoriesResult.status === 'rejected' ? repositoriesResult.reason : repositoriesResult.value.error);
      }

      // Process sessions data
      let sessions: VeeamSession[] = [];
      if (sessionsResult.status === 'fulfilled' && sessionsResult.value.success) {
        sessions = sessionsResult.value.data || [];
        await this.cacheService.set('sessions', sessions, 300);
      } else {
        logger.error('Failed to fetch sessions:', sessionsResult.status === 'rejected' ? sessionsResult.reason : sessionsResult.value.error);
      }

      // Generate dashboard statistics
      const dashboardStats = this.generateDashboardStats(jobs, repositories, sessions);
      logger.info('Generated dashboard stats:', {
        totalJobs: dashboardStats.totalJobs,
        successfulJobs: dashboardStats.successfulJobs,
        failedJobs: dashboardStats.failedJobs,
        totalRepositories: dashboardStats.totalRepositories,
        totalCapacityTB: dashboardStats.totalCapacityTB,
        usedCapacityTB: dashboardStats.usedCapacityTB,
        capacityUsagePercent: dashboardStats.capacityUsagePercent
      });
      await this.cacheService.set('dashboard_stats', dashboardStats, 60); // Cache for 1 minute
      this.webSocketService.broadcastDashboardStats(dashboardStats);

      // Check for alerts
      await this.checkForAlerts(jobs, repositories, sessions);

      logger.debug('Monitoring cycle completed successfully');
    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
      this.webSocketService.broadcastDashboardError('Failed to update monitoring data');
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      logger.debug('Performing health check...');

      // Perform individual health checks with detailed error tracking
      const healthResults = {
        veeam: { healthy: false, error: '' },
        cache: { healthy: false, error: '' },
        websocket: { healthy: false, error: '' }
      };

      // Check Veeam service health
      try {
        healthResults.veeam.healthy = await this.veeamService.healthCheck();
        if (!healthResults.veeam.healthy) {
          healthResults.veeam.error = 'Veeam API connectivity failed - check authentication, network connection, or service availability';
        }
      } catch (error) {
        healthResults.veeam.healthy = false;
        healthResults.veeam.error = `Veeam service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

      // Check Cache service health
      try {
        healthResults.cache.healthy = await this.cacheService.healthCheck();
        if (!healthResults.cache.healthy) {
          healthResults.cache.error = 'Cache service operations failed - check Redis connection or memory cache';
        }
      } catch (error) {
        healthResults.cache.healthy = false;
        healthResults.cache.error = `Cache service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

      // Check WebSocket service health
      try {
        const connectedClients = this.webSocketService.getConnectedClientsCount();
        healthResults.websocket.healthy = connectedClients >= 0;
        if (!healthResults.websocket.healthy) {
          healthResults.websocket.error = 'WebSocket service unavailable - real-time updates may not work';
        }
      } catch (error) {
        healthResults.websocket.healthy = false;
        healthResults.websocket.error = `WebSocket service error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }

      const healthCheck: HealthCheck = {
        service: 'veeam-dashboard',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          veeam: healthResults.veeam.healthy ? 'healthy' : 'unhealthy',
          cache: healthResults.cache.healthy ? 'healthy' : 'unhealthy',
          websocket: healthResults.websocket.healthy ? 'healthy' : 'unhealthy',
        },
      };

      // Determine overall health status
      const allServicesHealthy = Object.values(healthResults).every(result => result.healthy);
      healthCheck.status = allServicesHealthy ? 'healthy' : 'unhealthy';

      // Cache health check result
      await this.cacheService.set('health_check', healthCheck, 30);

      if (!allServicesHealthy) {
        logger.warn('Health check failed:', healthCheck.details);
        
        // Create detailed alert message with specific error information
        const unhealthyServices = Object.entries(healthResults)
          .filter(([, result]) => !result.healthy)
          .map(([service, result]) => `${service}: ${result.error}`);

        const alert: Alert = {
          id: `health-check-${Date.now()}`,
          ruleId: 'health-check-rule',
          type: 'error',
          severity: 'high',
          title: 'Service Health Check Failed',
          message: `Service health issues detected:\n\n${unhealthyServices.join('\n\n')}\n\nPlease check the affected services and their configurations.`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
          resolved: false,
          metadata: {
            healthDetails: healthResults,
            unhealthyCount: unhealthyServices.length,
            totalServices: Object.keys(healthResults).length
          }
        };

        await this.alertService.createAlert(alert);
      }

      logger.debug('Health check completed');
    } catch (error) {
      logger.error('Error performing health check:', error);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: await this.getCpuUsage(),
          cores: os.cpus().length,
        },
        memory: {
          total: os.totalmem(),
          used: os.totalmem() - os.freemem(),
          percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        },
        disk: {
          used: 0, // Placeholder - would need disk usage calculation
          total: 0, // Placeholder - would need disk usage calculation
          percentage: 0, // Placeholder - would need disk usage calculation
        },
        network: {
          bytesIn: 0, // Placeholder - would need network stats
          bytesOut: 0, // Placeholder - would need network stats
        },
      };

      // Cache metrics
      await this.cacheService.set('system_metrics', metrics, 60);
      
      // Broadcast to WebSocket clients
      this.webSocketService.broadcastSystemMetrics(metrics);

      logger.debug('System metrics collected and broadcasted');
    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const totalUsage = currentUsage.user + currentUsage.system;
        
        const cpuPercent = (totalUsage / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  private generateDashboardStats(
    jobs: VeeamJobState[],
    repositories: VeeamRepositoryState[],
    sessions: VeeamSession[]
  ): DashboardStats {
    // Calculate job statistics
    const totalJobs = jobs.length;
    const runningJobs = jobs.filter(job => job.status === 'Running').length;
    const successfulJobs = jobs.filter(job => job.lastResult === 'Success').length;
    const failedJobs = jobs.filter(job => job.lastResult === 'Failed').length;
    const warningJobs = jobs.filter(job => job.lastResult === 'Warning').length;

    // Calculate repository statistics
    const totalRepositories = repositories.length;
    const totalCapacityGB = repositories.reduce((sum, repo) => sum + (repo.capacityGB || 0), 0);
    const totalUsedGB = repositories.reduce((sum, repo) => sum + (repo.usedSpaceGB || 0), 0);
    const totalFreeGB = repositories.reduce((sum, repo) => sum + (repo.freeGB || 0), 0);
    const storageUsagePercent = totalCapacityGB > 0 ? (totalUsedGB / totalCapacityGB) * 100 : 0;

    // Calculate session statistics
    const recentSessions = sessions.filter(session => {
      const sessionTime = new Date(session.creationTime || session.endTime || Date.now());
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return sessionTime > oneDayAgo;
    });

    return {
      totalJobs,
      activeJobs: runningJobs,
      successfulJobs,
      failedJobs,
      warningJobs,
      totalRepositories,
      totalCapacityTB: totalCapacityGB / 1024,
      usedCapacityTB: totalUsedGB / 1024,
      freeCapacityTB: totalFreeGB / 1024,
      capacityUsagePercent: Math.round(storageUsagePercent * 100) / 100,
    };
  }

  private async checkForAlerts(
    jobs: VeeamJobState[],
    repositories: VeeamRepositoryState[],
    sessions: VeeamSession[]
  ): Promise<void> {
    try {
      // Check for failed jobs
      const failedJobs = jobs.filter(job => job.lastResult === 'Failed');
      for (const job of failedJobs) {
        const alertId = `job-failed-${job.id}`;
        const existingAlert = await this.cacheService.get(`alert-${alertId}`);
        
        if (!existingAlert) {
          const alert: Alert = {
            id: alertId,
            ruleId: 'job-failure-rule',
            type: 'error',
            severity: 'high',
            title: 'Backup Job Failed',
            message: `Job "${job.name}" has failed. Last run: ${job.lastRun}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            resolved: false,
            metadata: {
              jobId: job.id,
              jobName: job.name,
              lastResult: job.lastResult,
              lastRun: job.lastRun,
            },
          };

          await this.alertService.createAlert(alert);
          await this.cacheService.set(`alert-${alertId}`, alert, 3600); // Cache for 1 hour
        }
      }

      // Check for repository storage warnings
      const lowStorageRepos = repositories.filter(repo => {
        if (!repo.capacityGB || !repo.freeGB) return false;
        const usagePercent = ((repo.capacityGB - repo.freeGB) / repo.capacityGB) * 100;
        return usagePercent > 85; // Alert when usage > 85%
      });

      for (const repo of lowStorageRepos) {
        const alertId = `repo-storage-${repo.id}`;
        const existingAlert = await this.cacheService.get(`alert-${alertId}`);
        
        if (!existingAlert) {
          const usagePercent = Math.round(((repo.capacityGB! - repo.freeGB!) / repo.capacityGB!) * 100);
          
          const alert: Alert = {
            id: alertId,
            ruleId: 'storage-threshold-rule',
            type: 'warning',
            severity: usagePercent > 95 ? 'high' : 'medium',
            title: 'Repository Storage Warning',
            message: `Repository "${repo.name}" is ${usagePercent}% full (${repo.freeGB}GB free of ${repo.capacityGB}GB total)`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            resolved: false,
            metadata: {
              repositoryId: repo.id,
              repositoryName: repo.name,
              usagePercent,
              freeGB: repo.freeGB,
              capacityGB: repo.capacityGB,
            },
          };

          await this.alertService.createAlert(alert);
          await this.cacheService.set(`alert-${alertId}`, alert, 3600);
        }
      }

      logger.debug('Alert checking completed');
    } catch (error) {
      logger.error('Error checking for alerts:', error);
    }
  }

  // Public methods for manual operations
  public async forceMonitoringCycle(): Promise<void> {
    logger.info('Forcing monitoring cycle...');
    await this.performMonitoringCycle();
  }

  public async generateTestAlerts(): Promise<void> {
    logger.info('Generating test alerts for demonstration...');
    
    const testAlerts: Alert[] = [
      {
        id: `test-critical-${Date.now()}`,
        ruleId: 'test-rule',
        type: 'error',
        severity: 'critical',
        title: 'Critical System Alert',
        message: 'This is a test critical alert to demonstrate real-time notifications.',
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
        metadata: {
          testAlert: true,
          source: 'monitoring-service'
        }
      },
      {
        id: `test-warning-${Date.now() + 1}`,
        ruleId: 'test-rule',
        type: 'warning',
        severity: 'high',
        title: 'High Priority Warning',
        message: 'Test warning alert - backup job may need attention.',
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
        metadata: {
          testAlert: true,
          jobName: 'Exchange-Backup-Daily'
        }
      },
      {
         id: `test-info-${Date.now() + 2}`,
         ruleId: 'test-rule',
         type: 'infrastructure_down',
         severity: 'medium',
         title: 'Infrastructure Alert',
         message: 'Test infrastructure alert - system maintenance scheduled.',
         timestamp: new Date().toISOString(),
         acknowledged: false,
         resolved: false,
         metadata: {
           testAlert: true,
           maintenanceWindow: '2024-01-15 02:00 AM'
         }
       }
    ];

    for (const alert of testAlerts) {
      await this.alertService.createAlert(alert);
      await this.cacheService.set(`alert-${alert.id}`, alert, 3600);
      // Small delay between alerts for better demonstration
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info('Test alerts generated successfully');
  }

  public async forceHealthCheck(): Promise<HealthCheck | null> {
    logger.info('Forcing health check...');
    await this.performHealthCheck();
    return await this.cacheService.get('health_check');
  }

  public async getSystemMetrics(): Promise<SystemMetrics | null> {
    return await this.cacheService.get('system_metrics');
  }

  public async getDashboardStats(): Promise<DashboardStats | null> {
    return await this.cacheService.get('dashboard_stats');
  }

  public isMonitoringRunning(): boolean {
    return this.isRunning;
  }

  public getMonitoringStatus(): {
    isRunning: boolean;
    intervals: {
      monitoring: boolean;
      healthCheck: boolean;
      metrics: boolean;
    };
  } {
    return {
      isRunning: this.isRunning,
      intervals: {
        monitoring: this.monitoringInterval !== null,
        healthCheck: this.healthCheckInterval !== null,
        metrics: this.metricsInterval !== null,
      },
    };
  }
}