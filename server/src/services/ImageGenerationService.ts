import puppeteer, { Browser, Page, ScreenshotOptions } from 'puppeteer'
import { logger } from '../utils/logger.js'

export interface ImageGenerationOptions {
  width?: number
  height?: number
  quality?: 'low' | 'medium' | 'high'
  format?: 'png' | 'jpeg'
}

export class ImageGenerationService {
  private static instance: ImageGenerationService
  private browser: Browser | null = null

  private constructor() {}

  public static getInstance(): ImageGenerationService {
    if (!ImageGenerationService.instance) {
      ImageGenerationService.instance = new ImageGenerationService()
    }
    return ImageGenerationService.instance
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        })
        logger.info('Puppeteer browser launched successfully')
      } catch (error) {
        logger.error('Failed to launch puppeteer browser:', error)
        throw error
      }
    }
    return this.browser
  }

  public async generateImageFromHTML(
    html: string,
    options: ImageGenerationOptions = {}
  ): Promise<Buffer> {
    const {
      width = 1200,
      height = 800,
      quality = 'high',
      format = 'png'
    } = options

    let page: Page | null = null

    try {
      const browser = await this.getBrowser()
      page = await browser.newPage()

      // Set viewport
      await page.setViewport({ width, height })

      // Set content with proper styling
      const styledHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              color: #333;
              line-height: 1.6;
              padding: 20px;
            }
            .report-container {
              max-width: ${width - 40}px;
              margin: 0 auto;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              padding: 24px;
            }
            .report-header {
              text-align: center;
              margin-bottom: 24px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 16px;
            }
            .report-title {
              font-size: 24px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 8px;
            }
            .report-subtitle {
              font-size: 14px;
              color: #6b7280;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .summary-card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 16px;
              text-align: center;
            }
            .summary-value {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .summary-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .success { color: #10b981; }
            .warning { color: #f59e0b; }
            .error { color: #ef4444; }
            .info { color: #3b82f6; }
            .report-stats {
              display: flex;
              justify-content: center;
              gap: 20px;
              margin-top: 8px;
              font-size: 12px;
              color: #6b7280;
            }
            .stat-item {
              background: #f3f4f6;
              padding: 4px 8px;
              border-radius: 12px;
            }
            .card-icon {
              font-size: 20px;
              margin-bottom: 8px;
            }
            .charts-section {
              margin: 24px 0;
            }
            .chart-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .chart-container {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 16px;
            }
            .chart-title {
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 12px;
              color: #374151;
              text-align: center;
            }
            .storage-chart {
              position: relative;
              height: 120px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .storage-ring {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              position: relative;
              background: conic-gradient(#10b981 0deg, #10b981 var(--used-angle), #e5e7eb var(--used-angle), #e5e7eb 360deg);
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .storage-ring::before {
              content: '';
              width: 50px;
              height: 50px;
              background: white;
              border-radius: 50%;
              position: absolute;
            }
            .storage-percentage {
              position: absolute;
              font-size: 14px;
              font-weight: bold;
              color: #374151;
              z-index: 1;
            }
            .storage-legend {
              margin-top: 12px;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
            }
            .legend-item {
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .legend-color {
              width: 8px;
              height: 8px;
              border-radius: 2px;
            }
            .success-chart {
              height: 120px;
              display: flex;
              align-items: end;
              justify-content: center;
              gap: 8px;
              padding: 0 20px;
            }
            .success-bar {
              width: 24px;
              border-radius: 4px 4px 0 0;
              position: relative;
              display: flex;
              align-items: end;
              justify-content: center;
            }
            .bar-label {
              position: absolute;
              bottom: -20px;
              font-size: 10px;
              color: #6b7280;
              text-align: center;
              width: 100%;
            }
            .bar-value {
              position: absolute;
              top: -20px;
              font-size: 10px;
              font-weight: 600;
              color: #374151;
              text-align: center;
              width: 100%;
            }
            .repository-section {
              margin: 24px 0;
            }
            .repository-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .repository-item {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 12px;
            }
            .repo-name {
              font-weight: 600;
              font-size: 13px;
              color: #374151;
              margin-bottom: 4px;
            }
            .repo-usage {
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 6px;
            }
            .repo-bar {
              height: 6px;
              background: #e5e7eb;
              border-radius: 3px;
              overflow: hidden;
            }
            .repo-fill {
              height: 100%;
              border-radius: 3px;
              transition: width 0.3s ease;
            }
            .jobs-section {
              margin-top: 24px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 12px;
              color: #1f2937;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .jobs-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }
            .job-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 12px;
              background: #f9fafb;
              border-radius: 6px;
              border-left: 4px solid #e5e7eb;
            }
            .job-item.success { border-left-color: #10b981; }
            .job-item.warning { border-left-color: #f59e0b; }
            .job-item.error { border-left-color: #ef4444; }
            .job-info {
              flex: 1;
              min-width: 0;
            }
            .job-name {
              font-weight: 500;
              font-size: 12px;
              color: #374151;
              display: block;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .job-details {
              font-size: 10px;
              color: #6b7280;
              display: block;
              margin-top: 2px;
            }
            .job-status {
              font-size: 10px;
              padding: 3px 6px;
              border-radius: 8px;
              text-transform: uppercase;
              font-weight: 600;
              white-space: nowrap;
            }
            .status-success {
              background: #d1fae5;
              color: #065f46;
            }
            .status-warning {
              background: #fef3c7;
              color: #92400e;
            }
            .status-error {
              background: #fee2e2;
              color: #991b1b;
            }
            .jobs-more {
              text-align: center;
              margin-top: 12px;
              color: #6b7280;
              font-size: 11px;
              font-style: italic;
            }
            .footer {
              margin-top: 32px;
              border-top: 2px solid #e5e7eb;
              padding-top: 16px;
            }
            .footer-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 11px;
              color: #6b7280;
            }
            
            /* Enhanced Chart Styles */
            .chart-container {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin: 15px 0;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border: 1px solid #e5e7eb;
            }
            
            .chart-title {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 15px;
              text-align: center;
            }
            
            /* Repository Charts */
            .repository-charts {
              display: flex;
              justify-content: center;
              gap: 20px;
              margin: 20px 0;
              flex-wrap: wrap;
            }
            
            .repo-chart {
              display: flex;
              flex-direction: column;
              align-items: center;
              min-width: 100px;
            }
            
            .repo-chart-name {
              font-size: 12px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 8px;
              text-align: center;
              max-width: 100px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .repo-chart-ring {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              margin-bottom: 8px;
            }
            
            .repo-chart-ring::before {
              content: '';
              position: absolute;
              width: 50px;
              height: 50px;
              background: white;
              border-radius: 50%;
              z-index: 1;
            }
            
            .repo-chart-percentage {
              font-size: 14px;
              font-weight: 700;
              color: #1f2937;
              z-index: 2;
            }
            
            .repo-chart-details {
              font-size: 10px;
              color: #6b7280;
              text-align: center;
            }
            
            .chart-note {
              text-align: center;
              font-size: 11px;
              color: #6b7280;
              margin-top: 10px;
            }
            
            .no-data {
              text-align: center;
              color: #6b7280;
              font-style: italic;
              padding: 20px;
            }
            
            /* Enhanced Success Rate Chart */
            .success-chart {
              display: flex;
              justify-content: center;
              align-items: flex-end;
              gap: 15px;
              height: 120px;
              margin: 20px 0;
            }
            
            .success-bar {
              width: 40px;
              border-radius: 4px 4px 0 0;
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-end;
              color: white;
              font-weight: 600;
            }
            
            .bar-value {
              font-size: 10px;
              margin-bottom: 5px;
            }
            
            .bar-label {
              position: absolute;
              bottom: -20px;
              font-size: 10px;
              color: #6b7280;
              white-space: nowrap;
            }
            
            /* Enhanced Repository Status */
            .repository-section {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin: 15px 0;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border: 1px solid #e5e7eb;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 15px;
              text-align: center;
            }
            
            .repository-grid {
              display: grid;
              gap: 12px;
            }
            
            .repository-item {
              background: #f9fafb;
              border-radius: 8px;
              padding: 12px;
              border: 1px solid #e5e7eb;
            }
            
            .repo-name {
              font-weight: 600;
              color: #1f2937;
              font-size: 14px;
              margin-bottom: 4px;
            }
            
            .repo-usage {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            
            .repo-bar {
              width: 100%;
              height: 6px;
              background: #e5e7eb;
              border-radius: 3px;
              overflow: hidden;
            }
            
            .repo-fill {
              height: 100%;
              border-radius: 3px;
              transition: width 0.3s ease;
            }
            
            /* Performance Trends Section */
            .performance-trends-section {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin: 15px 0;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border: 1px solid #e5e7eb;
            }
            
            .health-overview {
              display: flex;
              gap: 20px;
              margin-bottom: 20px;
              align-items: center;
            }
            
            .health-score-display {
              text-align: center;
              padding: 15px;
              border-radius: 8px;
              min-width: 120px;
            }
            
            .health-excellent {
              background: linear-gradient(135deg, #d1fae5, #a7f3d0);
              border: 2px solid #10b981;
            }
            
            .health-good {
              background: linear-gradient(135deg, #fef3c7, #fde68a);
              border: 2px solid #f59e0b;
            }
            
            .health-poor {
              background: linear-gradient(135deg, #fee2e2, #fecaca);
              border: 2px solid #ef4444;
            }
            
            .health-score-value {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
            }
            
            .health-score-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            
            .health-score-status {
              font-size: 12px;
              font-weight: 600;
              color: #374151;
              margin-top: 4px;
            }
            
            .health-metrics {
              flex: 1;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            
            .metric-item {
              background: #f9fafb;
              padding: 10px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .metric-label {
              font-size: 11px;
              color: #6b7280;
              font-weight: 500;
            }
            
            .metric-value {
              font-size: 14px;
              font-weight: bold;
              color: #1f2937;
            }
            
            .recommendations {
              border-top: 1px solid #e5e7eb;
              padding-top: 15px;
            }
            
            .recommendations-title {
              font-size: 14px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 10px;
            }
            
            .recommendations-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            
            .recommendation-item {
              background: #f9fafb;
              padding: 10px 12px;
              border-radius: 6px;
              border-left: 4px solid #3b82f6;
              font-size: 12px;
              color: #374151;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            ${html}
          </div>
        </body>
        </html>
      `

      await page.setContent(styledHTML, { waitUntil: 'networkidle0' })

      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate screenshot
      const screenshotOptions: ScreenshotOptions = {
        type: format,
        fullPage: true
      }

      if (format === 'jpeg') {
        const qualityMap = { low: 60, medium: 80, high: 95 }
        screenshotOptions.quality = qualityMap[quality]
      }

      const imageBuffer = await page.screenshot(screenshotOptions)
      
      logger.info(`Generated ${format} image: ${width}x${height}, quality: ${quality}`)
      
      return imageBuffer as Buffer
    } catch (error) {
      logger.error('Error generating image from HTML:', error)
      throw error
    } finally {
      if (page) {
        await page.close()
      }
    }
  }

  public async generateReportImage(
    reportData: any,
    options: ImageGenerationOptions = {}
  ): Promise<Buffer> {
    const html = this.formatReportHTML(reportData)
    return this.generateImageFromHTML(html, options)
  }

  private formatReportHTML(reportData: any): string {
    const summary = reportData.summary || {}
    const jobs = reportData.jobs || []
    const repositories = reportData.repositories || []
    const dateRange = reportData.dateRange || {}
    
    const startDate = dateRange.startDate ? new Date(dateRange.startDate).toLocaleDateString() : 'N/A'
    const endDate = dateRange.endDate ? new Date(dateRange.endDate).toLocaleDateString() : 'N/A'
    
    // Calculate advanced analytics
    const totalJobs = summary.totalJobs || 0
    const successRate = totalJobs > 0 ? Math.round((summary.successfulJobs || 0) / totalJobs * 100) : 0
    const failureRate = totalJobs > 0 ? Math.round((summary.failedJobs || 0) / totalJobs * 100) : 0
    const warningRate = totalJobs > 0 ? Math.round((summary.warningJobs || 0) / totalJobs * 100) : 0
    
    // System health indicators
    const totalCapacity = repositories.reduce((sum: number, repo: any) => sum + (repo.capacity || 0), 0)
    const totalUsed = repositories.reduce((sum: number, repo: any) => sum + (repo.used || 0), 0)
    const overallUsage = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0
    
    // Repository health analysis
    const criticalRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) > 85).length
    const warningRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) > 70 && (repo.usagePercent || 0) <= 85).length
    const healthyRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) <= 70).length
    
    // System health score calculation
    let healthScore = 100
    healthScore -= (failureRate * 2) // Failures heavily impact health
    healthScore -= (warningRate * 1) // Warnings moderately impact health
    healthScore -= (criticalRepos * 10) // Critical repos impact health
    healthScore -= (warningRepos * 5) // Warning repos moderately impact health
    const finalHealthScore = Math.max(0, Math.min(100, healthScore))
    
    // Generate enhanced summary cards with advanced analytics
    const healthClass = finalHealthScore >= 90 ? 'success' : finalHealthScore >= 70 ? 'warning' : 'error'
    const summaryCards = [
      { label: 'Total Jobs', value: totalJobs, class: 'info', icon: '📊' },
      { label: 'Success Rate', value: `${successRate}%`, class: 'success', icon: '✅' },
      { label: 'System Health', value: `${finalHealthScore}/100`, class: healthClass, icon: '🏥' },
      { label: 'Failed Jobs', value: summary.failedJobs || 0, class: 'error', icon: '❌' },
      { label: 'Storage Usage', value: `${overallUsage}%`, class: overallUsage > 80 ? 'error' : overallUsage > 60 ? 'warning' : 'success', icon: '💾' },
      { label: 'Critical Repos', value: criticalRepos, class: criticalRepos > 0 ? 'error' : 'success', icon: '🔴' }
    ]

    const summaryHTML = summaryCards.map(card => `
      <div class="summary-card">
        <div class="card-icon">${card.icon}</div>
        <div class="summary-value ${card.class}">${card.value}</div>
        <div class="summary-label">${card.label}</div>
      </div>
    `).join('')

    // Generate success rate chart
    const successChartHTML = this.generateSuccessRateChart(successRate, failureRate, warningRate)
    
    // Generate individual repository charts (replace total storage chart)
    const repositoryChartsHTML = this.generateRepositoryCharts(repositories)
    
    // Generate repository status
    const repositoryHTML = this.generateRepositoryStatus(repositories)
    
    // Generate jobs list with priority: Failed > Warning > Success > Unknown (limit to first 8 for better layout)
    const prioritizedJobs = [...jobs].sort((a, b) => {
      const getPriority = (job: any) => {
        const result = job.result || job.lastResult || 'Unknown'
        if (result === 'Failed') return 1
        if (result === 'Warning') return 2
        if (result === 'Success') return 3
        return 4 // Unknown status has lowest priority
      }
      return getPriority(a) - getPriority(b)
    })
    
    const jobsHTML = prioritizedJobs.slice(0, 8).map((job: any) => {
      const result = job.result || job.lastResult || 'Unknown'
      const statusClass = result === 'Success' ? 'success' : 
                         result === 'Warning' ? 'warning' : 'error'
      const statusLabel = result === 'Success' ? 'status-success' : 
                         result === 'Warning' ? 'status-warning' : 'status-error'
      const sizeInfo = job.transferredSize ? ` (${job.transferredSize})` : ''
      
      return `
        <div class="job-item ${statusClass}">
          <div class="job-info">
            <span class="job-name">${job.name || 'Unknown Job'}</span>
            <span class="job-details">${job.type || 'Backup'}${sizeInfo}</span>
          </div>
          <span class="job-status ${statusLabel}">${result}</span>
        </div>
      `
    }).join('')

    // Determine dynamic icon based on system status
    let reportIcon = '✅' // Default: green checkmark for healthy system
    const recentFailures = jobs.filter((job: any) => job.result === 'Failed' || job.lastResult === 'Failed').length
    const recentWarnings = jobs.filter((job: any) => job.result === 'Warning' || job.lastResult === 'Warning').length
    
    if (recentFailures > 0 || failureRate > 0) {
      reportIcon = '🚨' // Red alert for failures
    } else if (recentWarnings > 0 || warningRate > 0 || criticalRepos > 0) {
      reportIcon = '⚠️' // Yellow warning for warnings or critical repos
    } else if (finalHealthScore < 80) {
      reportIcon = '⚠️' // Yellow warning for low health score
    }

    return `
      <div class="report-header">
        <div class="report-title">${reportIcon} Veeam Backup Report</div>
        <div class="report-subtitle">📅 ${startDate} - ${endDate}</div>
        <div class="report-stats">
          <span class="stat-item">📈 Success Rate: ${successRate}%</span>
          <span class="stat-item">🏥 Health Score: ${finalHealthScore}/100</span>
          <span class="stat-item">💾 Storage: ${overallUsage}% Used</span>
          <span class="stat-item">🗄️ Repos: ${healthyRepos}/${repositories.length || 0} Healthy</span>
        </div>
      </div>
      
      <div class="summary-grid">
        ${summaryHTML}
      </div>
      
      <div class="charts-section">
        <div class="chart-row">
          ${successChartHTML}
          ${repositoryChartsHTML}
        </div>
      </div>
      
      ${repositoryHTML}
      
      ${this.generatePerformanceTrends(jobs, repositories, finalHealthScore, criticalRepos, warningRepos, overallUsage, failureRate)}
      
      ${jobs.length > 0 ? `
        <div class="jobs-section">
          <div class="section-title">📋 Recent Job Status</div>
          <div class="jobs-grid">
            ${jobsHTML}
          </div>
          ${jobs.length > 8 ? `<div class="jobs-more">... and ${jobs.length - 8} more jobs</div>` : ''}
        </div>
      ` : ''}
      
      <div class="footer">
        <div class="footer-content">
          <span>Generated on ${new Date().toLocaleString()}</span>
          <span>Veeam Insight Dashboard</span>
        </div>
      </div>
    `
  }

  private generateRepositoryCharts(repositories: any[]): string {
    if (!repositories || repositories.length === 0) {
      return `
        <div class="chart-container">
          <div class="chart-title">🗄️ Repository Storage</div>
          <div class="no-data">No repository data available</div>
        </div>
      `
    }
    
    // Show top 3 repositories by capacity
    const topRepos = repositories
      .filter(repo => repo.capacity && repo.capacity > 0)
      .sort((a, b) => (b.capacity || 0) - (a.capacity || 0))
      .slice(0, 3)
    
    const repoCharts = topRepos.map(repo => {
      const usagePercent = repo.usagePercent || 0
      const color = usagePercent > 80 ? '#ef4444' : usagePercent > 60 ? '#f59e0b' : '#10b981'
      const capacity = repo.capacity ? repo.capacity.toFixed(2) : '0.00'
      const used = repo.used ? repo.used.toFixed(2) : '0.00'
      
      return `
        <div class="repo-chart">
          <div class="repo-chart-name">${repo.name || 'Repository'}</div>
          <div class="repo-chart-ring" style="background: conic-gradient(${color} 0deg, ${color} ${usagePercent * 3.6}deg, #e5e7eb ${usagePercent * 3.6}deg, #e5e7eb 360deg);">
            <div class="repo-chart-percentage">${usagePercent.toFixed(2)}%</div>
          </div>
          <div class="repo-chart-details">
            <div>${used}TB / ${capacity}TB</div>
          </div>
        </div>
      `
    }).join('')
    
    return `
      <div class="chart-container">
        <div class="chart-title">🗄️ Repository Storage Usage</div>
        <div class="repository-charts">
          ${repoCharts}
        </div>
        ${repositories.length > 3 ? `<div class="chart-note">Showing top 3 of ${repositories.length} repositories</div>` : ''}
      </div>
    `
  }

  private generateSuccessRateChart(successRate: number, failureRate: number, warningRate: number): string {
    const maxHeight = 80
    const successHeight = Math.round((successRate / 100) * maxHeight)
    const failureHeight = Math.round((failureRate / 100) * maxHeight)
    const warningHeight = Math.round((warningRate / 100) * maxHeight)
    
    return `
      <div class="chart-container">
        <div class="chart-title">📊 Job Success Rate</div>
        <div class="success-chart">
          <div class="success-bar" style="height: ${successHeight}px; background: #10b981;">
            <div class="bar-value">${successRate}%</div>
            <div class="bar-label">Success</div>
          </div>
          <div class="success-bar" style="height: ${warningHeight}px; background: #f59e0b;">
            <div class="bar-value">${warningRate}%</div>
            <div class="bar-label">Warning</div>
          </div>
          <div class="success-bar" style="height: ${failureHeight}px; background: #ef4444;">
            <div class="bar-value">${failureRate}%</div>
            <div class="bar-label">Failed</div>
          </div>
        </div>
      </div>
    `
  }

  private generatePerformanceTrends(jobs: any[], repositories: any[], healthScore: number, criticalRepos: number, warningRepos: number, overallUsage: number, failureRate: number): string {
    const recentFailures = jobs.filter((job: any) => job.result === 'Failed' || job.lastResult === 'Failed').length
    const recentWarnings = jobs.filter((job: any) => job.result === 'Warning' || job.lastResult === 'Warning').length
    
    // Generate recommendations based on system health
    const recommendations = []
    
    if (criticalRepos > 0) {
      recommendations.push(`🔴 ${criticalRepos} repository(ies) need immediate attention (>85% full)`)
    }
    
    if (failureRate > 10) {
      recommendations.push(`🚨 High failure rate detected (${failureRate}%) - review backup configurations`)
    }
    
    if (overallUsage > 80) {
      recommendations.push(`💾 Consider expanding storage capacity (${overallUsage}% used)`)
    }
    
    if (recentFailures > 0) {
      recommendations.push(`⚠️ ${recentFailures} recent job failures require investigation`)
    }
    
    // Only show section if there are recommendations or health score is low
    if (recommendations.length === 0 && healthScore >= 80) {
      return ''
    }
    
    const recommendationsHTML = recommendations.length > 0 ? 
      recommendations.map(rec => `<div class="recommendation-item">${rec}</div>`).join('') :
      '<div class="recommendation-item">🟢 System is operating within normal parameters</div>'
    
    const healthStatusClass = healthScore >= 90 ? 'health-excellent' : healthScore >= 70 ? 'health-good' : 'health-poor'
    const healthStatusText = healthScore >= 90 ? 'Excellent' : healthScore >= 70 ? 'Good' : 'Needs Attention'
    
    return `
      <div class="performance-trends-section">
        <div class="section-title">📊 Performance Analysis & Recommendations</div>
        <div class="health-overview">
          <div class="health-score-display ${healthStatusClass}">
            <div class="health-score-value">${healthScore}</div>
            <div class="health-score-label">System Health Score</div>
            <div class="health-score-status">${healthStatusText}</div>
          </div>
          <div class="health-metrics">
            <div class="metric-item">
              <span class="metric-label">🟢 Healthy Repos:</span>
              <span class="metric-value">${repositories.length - criticalRepos - warningRepos}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">🟡 Warning Repos:</span>
              <span class="metric-value">${warningRepos}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">🔴 Critical Repos:</span>
              <span class="metric-value">${criticalRepos}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">📈 Overall Usage:</span>
              <span class="metric-value">${overallUsage}%</span>
            </div>
          </div>
        </div>
        <div class="recommendations">
          <div class="recommendations-title">💡 System Recommendations:</div>
          <div class="recommendations-list">
            ${recommendationsHTML}
          </div>
        </div>
      </div>
    `
  }

  private generateRepositoryStatus(repositories: any[]): string {
    if (!repositories || repositories.length === 0) {
      return ''
    }
    
    const repoItems = repositories.slice(0, 4).map((repo: any) => {
      const usagePercent = repo.usagePercent || 0
      const fillColor = usagePercent > 80 ? '#ef4444' : usagePercent > 60 ? '#f59e0b' : '#10b981'
      const capacity = repo.capacity ? `${repo.capacity}TB` : 'N/A'
      const used = repo.used ? `${repo.used}TB` : 'N/A'
      
      return `
        <div class="repository-item">
          <div class="repo-name">${repo.name || 'Repository'}</div>
          <div class="repo-usage">${used} / ${capacity} (${usagePercent}%)</div>
          <div class="repo-bar">
            <div class="repo-fill" style="width: ${usagePercent}%; background: ${fillColor};"></div>
          </div>
        </div>
      `
    }).join('')
    
    return `
      <div class="repository-section">
        <div class="section-title">🗄️ Repository Status</div>
        <div class="repository-grid">
          ${repoItems}
        </div>
        ${repositories.length > 4 ? `<div class="jobs-more">... and ${repositories.length - 4} more repositories</div>` : ''}
      </div>
    `
  }

  public async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close()
        this.browser = null
        logger.info('Puppeteer browser closed')
      } catch (error) {
        logger.error('Error closing puppeteer browser:', error)
      }
    }
  }
}

export const imageGenerationService = ImageGenerationService.getInstance()