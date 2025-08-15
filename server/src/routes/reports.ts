import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { VeeamService } from '../services/VeeamService.js';
import { MonitoringService } from '../services/MonitoringService.js';
import { AlertService } from '../services/AlertService.js';
import { format as formatDate } from 'date-fns';
import { Parser } from 'json2csv';

const router = Router();

// Services will be injected from server.ts
let veeamService: any;
let monitoringService: any;

// Function to set services (called from server.ts)
export const setReportServices = (veeam: any, monitoring: any) => {
  veeamService = veeam;
  monitoringService = monitoring;
};

interface ReportRequest {
  type: 'summary' | 'detailed';
  format: 'html' | 'pdf' | 'csv';
  startDate: string;
  endDate: string;
  includeJobs?: boolean;
  includeRepositories?: boolean;
  includeAlerts?: boolean;
}

// Generate report endpoint
router.post('/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      type = 'summary',
      format = 'html',
      startDate,
      endDate,
      includeJobs = true,
      includeRepositories = true,
      includeAlerts = true
    }: ReportRequest = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Gather report data
    const reportData = await generateReportData({
      type,
      startDate: start,
      endDate: end,
      includeJobs,
      includeRepositories,
      includeAlerts
    });

    // Format the report based on requested format
    let formattedReport;
    let contentType;
    let filename;

    switch (format) {
      case 'html':
        formattedReport = generateHTMLReport(reportData, type);
        contentType = 'text/html';
        filename = `veeam-report-${formatDate(start, 'yyyy-MM-dd')}-to-${formatDate(end, 'yyyy-MM-dd')}.html`;
        break;
      case 'csv':
        formattedReport = generateCSVReport(reportData);
        contentType = 'text/csv';
        filename = `veeam-report-${formatDate(start, 'yyyy-MM-dd')}-to-${formatDate(end, 'yyyy-MM-dd')}.csv`;
        break;
      case 'pdf':
        // For now, return HTML that can be converted to PDF on frontend
        formattedReport = generateHTMLReport(reportData, type);
        contentType = 'text/html';
        filename = `veeam-report-${formatDate(start, 'yyyy-MM-dd')}-to-${formatDate(end, 'yyyy-MM-dd')}.pdf`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid format. Supported formats: html, pdf, csv'
        });
    }

    // Return JSON response with the report data
    return res.json({
      success: true,
      data: formattedReport,
      filename,
      contentType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get report preview endpoint
router.post('/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      type = 'summary',
      startDate,
      endDate,
      includeJobs = true,
      includeRepositories = true,
      includeAlerts = true
    }: Omit<ReportRequest, 'format'> = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const reportData = await generateReportData({
      type,
      startDate: start,
      endDate: end,
      includeJobs,
      includeRepositories,
      includeAlerts
    });

    return res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Error generating report preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get report history endpoint
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Mock report history data - in a real implementation, this would come from a database
    const reportHistory = [
      {
        id: '1',
        name: 'Daily Report - 2025-01-15',
        type: 'daily',
        format: 'pdf',
        generatedAt: '2025-01-15T08:00:00Z',
        size: '2.3 MB',
        status: 'completed'
      },
      {
        id: '2',
        name: 'Weekly Report - Week 2',
        type: 'weekly',
        format: 'html',
        generatedAt: '2025-01-14T09:30:00Z',
        size: '1.8 MB',
        status: 'completed'
      },
      {
        id: '3',
        name: 'Monthly Report - December 2024',
        type: 'monthly',
        format: 'csv',
        generatedAt: '2025-01-01T10:00:00Z',
        size: '856 KB',
        status: 'completed'
      },
      {
        id: '4',
        name: 'Custom Report - Q4 2024',
        type: 'custom',
        format: 'pdf',
        generatedAt: '2024-12-31T15:45:00Z',
        size: '4.1 MB',
        status: 'completed'
      },
      {
        id: '5',
        name: 'Daily Report - 2025-01-14',
        type: 'daily',
        format: 'html',
        generatedAt: '2025-01-14T08:00:00Z',
        size: '2.1 MB',
        status: 'completed'
      }
    ];

    return res.json({
      success: true,
      data: reportHistory,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching report history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch report history',
      timestamp: new Date().toISOString()
    });
  }
});

export async function generateReportData(options: {
  type: 'summary' | 'detailed';
  startDate: Date;
  endDate: Date;
  includeJobs: boolean;
  includeRepositories: boolean;
  includeAlerts: boolean;
}) {
  const { type, startDate, endDate, includeJobs, includeRepositories, includeAlerts } = options;
  
  const reportData: any = {
    metadata: {
      generatedAt: new Date().toISOString(),
      reportType: type,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    },
    summary: {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      warningJobs: 0,
      totalRepositories: 0,
      totalAlerts: 0,
      totalCapacityTB: 0,
      usedCapacityTB: 0,
      freeCapacityTB: 0,
      capacityUsagePercent: 0
    }
  };

  try {
    // Get dashboard statistics from monitoring service
    const stats = await monitoringService.getDashboardStats();
    if (stats) {
      reportData.summary = {
        totalJobs: stats.totalJobs || 0,
        successfulJobs: stats.successfulJobs || 0,
        failedJobs: stats.failedJobs || 0,
        warningJobs: stats.warningJobs || 0,
        totalRepositories: stats.totalRepositories || 0,
        totalCapacityTB: stats.totalCapacityTB || 0,
        usedCapacityTB: stats.usedCapacityTB || 0,
        freeCapacityTB: stats.freeCapacityTB || 0,
        capacityUsagePercent: stats.capacityUsagePercent || 0,
        totalAlerts: 0 // Will be updated below if alerts are included
      };
    }

    // Fetch detailed job data if requested
    if (includeJobs) {
      try {
        const jobsResponse = await veeamService.getJobStates();
        if (jobsResponse.success && jobsResponse.data) {
          // Filter jobs by date range if detailed report
           let jobs = jobsResponse.data;
           if (type === 'detailed') {
             jobs = jobs.filter((job: any) => {
               if (!job.lastRun) return false;
               const jobDate = new Date(job.lastRun);
               return jobDate >= startDate && jobDate <= endDate;
             });
           }
          reportData.jobs = jobs;
          
          // Get sessions for each job if detailed report
          if (type === 'detailed') {
            reportData.jobSessions = [];
            for (const job of jobs.slice(0, 10)) { // Limit to first 10 jobs for performance
              try {
                const sessionsResponse = await veeamService.getJobSessions(job.id);
                if (sessionsResponse.success && sessionsResponse.data) {
                  const filteredSessions = sessionsResponse.data.filter((session: any) => {
                     if (!session.creationTime) return false;
                     const sessionDate = new Date(session.creationTime);
                     return sessionDate >= startDate && sessionDate <= endDate;
                   });
                  reportData.jobSessions.push(...filteredSessions);
                }
              } catch (error) {
                console.warn(`Failed to fetch sessions for job ${job.id}:`, error);
              }
            }
          }
        } else {
          reportData.jobs = [];
        }
      } catch (error) {
        console.warn('Failed to fetch jobs for report:', error);
        reportData.jobs = [];
      }
    }

    // Fetch repository data if requested
    if (includeRepositories) {
      try {
        const repositoriesResponse = await veeamService.getRepositoryStates();
        if (repositoriesResponse.success && repositoriesResponse.data) {
          reportData.repositories = repositoriesResponse.data;
        } else {
          reportData.repositories = [];
        }
      } catch (error) {
        console.warn('Failed to fetch repositories for report:', error);
        reportData.repositories = [];
      }
    }

    // Fetch alert data if requested and AlertService is available
    if (includeAlerts) {
      try {
        // Get alerts from monitoring service's alert service
        const alertsResponse = await monitoringService.alertService.getAlerts(
          1, // page
          100, // limit
          {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            resolved: false // Only get unresolved alerts for reports
          }
        );
          
        if (alertsResponse.success && alertsResponse.data) {
          reportData.alerts = alertsResponse.data;
          reportData.summary.totalAlerts = alertsResponse.data.length;
        } else {
          // Fallback to mock data if no alerts found
          reportData.alerts = [
            {
              id: 'mock-1',
              type: 'job_failure',
              severity: 'high',
              title: 'Backup Job Failed',
              message: 'Daily VM Backup job has failed',
              timestamp: new Date().toISOString(),
              acknowledged: false,
              resolved: false
            }
          ];
          reportData.summary.totalAlerts = 1;
        }
      } catch (error) {
        console.warn('Failed to fetch alerts for report:', error);
        reportData.alerts = [];
      }
    }

    // Add system health information for detailed reports
    if (type === 'detailed') {
      try {
        const healthResponse = await veeamService.healthCheck();
        if (healthResponse.success) {
          reportData.systemHealth = healthResponse.data;
        }
      } catch (error) {
        console.warn('Failed to fetch system health for report:', error);
      }
    }

  } catch (error) {
    console.error('Error gathering report data:', error);
    // Continue with empty data rather than failing completely
  }

  return reportData;
}

// Generate HTML report
function generateHTMLReport(data: any, type: 'summary' | 'detailed'): string {
  const { metadata, summary, jobs = [], repositories = [], alerts = [] } = data;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veeam Backup Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #0066cc;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #0066cc;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #0066cc;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .status-success { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Veeam Backup & Replication Report</h1>
        <p><strong>Report Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
        <p><strong>Period:</strong> ${formatDate(new Date(metadata.period.start), 'MMM dd, yyyy')} - ${formatDate(new Date(metadata.period.end), 'MMM dd, yyyy')}</p>
        <p><strong>Generated:</strong> ${formatDate(new Date(metadata.generatedAt), 'MMM dd, yyyy HH:mm:ss')}</p>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Jobs</h3>
                <div class="value">${summary.totalJobs}</div>
            </div>
            <div class="summary-card">
                <h3>Successful Jobs</h3>
                <div class="value status-success">${summary.successfulJobs}</div>
            </div>
            <div class="summary-card">
                <h3>Failed Jobs</h3>
                <div class="value status-failed">${summary.failedJobs}</div>
            </div>
            <div class="summary-card">
                <h3>Warning Jobs</h3>
                <div class="value status-warning">${summary.warningJobs}</div>
            </div>
            <div class="summary-card">
                <h3>Repositories</h3>
                <div class="value">${summary.totalRepositories}</div>
            </div>
            <div class="summary-card">
                <h3>Active Alerts</h3>
                <div class="value">${summary.totalAlerts}</div>
            </div>
        </div>
    </div>

    ${jobs.length > 0 ? `
    <div class="section">
        <h2>Backup Jobs</h2>
        <table>
            <thead>
                <tr>
                    <th>Job Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Last Run</th>
                    <th>Next Run</th>
                </tr>
            </thead>
            <tbody>
                ${jobs.map((job: any) => `
                <tr>
                    <td>${job.name || 'N/A'}</td>
                    <td>${job.type || 'N/A'}</td>
                    <td class="status-${(job.status || 'unknown').toLowerCase()}">${job.status || 'Unknown'}</td>
                    <td>${job.lastRun ? formatDate(new Date(job.lastRun), 'MMM dd, yyyy HH:mm') : 'N/A'}</td>
                    <td>${job.nextRun ? formatDate(new Date(job.nextRun), 'MMM dd, yyyy HH:mm') : 'N/A'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${repositories.length > 0 ? `
    <div class="section">
        <h2>Backup Repositories</h2>
        <table>
            <thead>
                <tr>
                    <th>Repository Name</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Free Space</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${repositories.map((repo: any) => `
                <tr>
                    <td>${repo.name || 'N/A'}</td>
                    <td>${repo.type || 'N/A'}</td>
                    <td>${repo.capacity || 'N/A'}</td>
                    <td>${repo.freeSpace || 'N/A'}</td>
                    <td class="status-${(repo.status || 'unknown').toLowerCase()}">${repo.status || 'Unknown'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${alerts.length > 0 ? `
    <div class="section">
        <h2>Recent Alerts</h2>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Severity</th>
                    <th>Timestamp</th>
                </tr>
            </thead>
            <tbody>
                ${alerts.map((alert: any) => `
                <tr>
                    <td>${alert.type || 'N/A'}</td>
                    <td>${alert.message || 'N/A'}</td>
                    <td class="status-${alert.severity || 'unknown'}">${alert.severity || 'Unknown'}</td>
                    <td>${alert.timestamp ? formatDate(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss') : 'N/A'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>This report was automatically generated by Veeam Insight Dashboard</p>
        <p>For more information, please contact your system administrator</p>
    </div>
</body>
</html>
  `;

  return html;
}

// Generate CSV report
function generateCSVReport(data: any): string {
  const { summary, jobs = [], repositories = [], alerts = [] } = data;
  
  // Prepare data for CSV
  const csvData = [];
  
  // Add summary section
  csvData.push({ Section: 'Summary', Name: 'Total Jobs', Value: summary.totalJobs });
  csvData.push({ Section: 'Summary', Name: 'Successful Jobs', Value: summary.successfulJobs });
  csvData.push({ Section: 'Summary', Name: 'Failed Jobs', Value: summary.failedJobs });
  csvData.push({ Section: 'Summary', Name: 'Warning Jobs', Value: summary.warningJobs });
  csvData.push({ Section: 'Summary', Name: 'Total Repositories', Value: summary.totalRepositories });
  csvData.push({ Section: 'Summary', Name: 'Total Alerts', Value: summary.totalAlerts });
  
  // Add jobs
  jobs.forEach((job: any) => {
    csvData.push({
      Section: 'Jobs',
      Name: job.name || 'N/A',
      Type: job.type || 'N/A',
      Status: job.status || 'Unknown',
      'Last Run': job.lastRun || 'N/A',
      'Next Run': job.nextRun || 'N/A'
    });
  });
  
  // Add repositories
  repositories.forEach((repo: any) => {
    csvData.push({
      Section: 'Repositories',
      Name: repo.name || 'N/A',
      Type: repo.type || 'N/A',
      Capacity: repo.capacity || 'N/A',
      'Free Space': repo.freeSpace || 'N/A',
      Status: repo.status || 'Unknown'
    });
  });
  
  // Add alerts
  alerts.forEach((alert: any) => {
    csvData.push({
      Section: 'Alerts',
      Type: alert.type || 'N/A',
      Message: alert.message || 'N/A',
      Severity: alert.severity || 'Unknown',
      Timestamp: alert.timestamp || 'N/A'
    });
  });
  
  // Convert to CSV
  const parser = new Parser();
  return parser.parse(csvData);
}

export default router;