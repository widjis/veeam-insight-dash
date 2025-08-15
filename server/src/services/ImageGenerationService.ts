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
            .jobs-section {
              margin-top: 24px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 12px;
              color: #1f2937;
            }
            .job-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 12px;
              margin-bottom: 4px;
              background: #f9fafb;
              border-radius: 4px;
              border-left: 4px solid #e5e7eb;
            }
            .job-item.success { border-left-color: #10b981; }
            .job-item.warning { border-left-color: #f59e0b; }
            .job-item.error { border-left-color: #ef4444; }
            .job-name {
              font-weight: 500;
            }
            .job-status {
              font-size: 12px;
              padding: 2px 8px;
              border-radius: 12px;
              text-transform: uppercase;
              font-weight: 500;
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
            .footer {
              margin-top: 24px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              border-top: 1px solid #e5e7eb;
              padding-top: 16px;
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
    const dateRange = reportData.dateRange || {}
    
    const startDate = dateRange.startDate ? new Date(dateRange.startDate).toLocaleDateString() : 'N/A'
    const endDate = dateRange.endDate ? new Date(dateRange.endDate).toLocaleDateString() : 'N/A'
    
    // Generate summary cards
    const summaryCards = [
      { label: 'Total Jobs', value: summary.totalJobs || 0, class: 'info' },
      { label: 'Successful', value: summary.successfulJobs || 0, class: 'success' },
      { label: 'Failed', value: summary.failedJobs || 0, class: 'error' },
      { label: 'Warnings', value: summary.warningJobs || 0, class: 'warning' },
      { label: 'Repositories', value: summary.totalRepositories || 0, class: 'info' },
      { label: 'Active Alerts', value: summary.totalAlerts || 0, class: 'warning' }
    ]

    const summaryHTML = summaryCards.map(card => `
      <div class="summary-card">
        <div class="summary-value ${card.class}">${card.value}</div>
        <div class="summary-label">${card.label}</div>
      </div>
    `).join('')

    // Generate jobs list (limit to first 10 for image)
    const jobsHTML = jobs.slice(0, 10).map((job: any) => {
      const statusClass = job.result === 'Success' ? 'success' : 
                         job.result === 'Warning' ? 'warning' : 'error'
      const statusLabel = job.result === 'Success' ? 'status-success' : 
                         job.result === 'Warning' ? 'status-warning' : 'status-error'
      
      return `
        <div class="job-item ${statusClass}">
          <span class="job-name">${job.name || 'Unknown Job'}</span>
          <span class="job-status ${statusLabel}">${job.result || 'Unknown'}</span>
        </div>
      `
    }).join('')

    return `
      <div class="report-header">
        <div class="report-title">🔄 Veeam Backup Report</div>
        <div class="report-subtitle">📅 ${startDate} - ${endDate}</div>
      </div>
      
      <div class="summary-grid">
        ${summaryHTML}
      </div>
      
      ${jobs.length > 0 ? `
        <div class="jobs-section">
          <div class="section-title">Recent Jobs</div>
          ${jobsHTML}
          ${jobs.length > 10 ? `<div style="text-align: center; margin-top: 12px; color: #6b7280; font-size: 12px;">... and ${jobs.length - 10} more jobs</div>` : ''}
        </div>
      ` : ''}
      
      <div class="footer">
        Generated on ${new Date().toLocaleString()}<br>
        Veeam Insight Dashboard
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