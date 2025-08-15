import { Router } from 'express'
import { PrismaClient } from '../generated/prisma'
import { z } from 'zod'
import { imageGenerationService } from '../services/ImageGenerationService.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
// import FormData from 'form-data' // Using native FormData instead

const router = Router()
const prisma = new PrismaClient()

// Validation schemas
const whatsappConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
  apiUrl: z.string().url().optional(),
  accessToken: z.string().optional(),
  phoneNumberId: z.string().optional(),
  enableImageReports: z.boolean().default(false),
  comprehensiveImageReport: z.boolean().default(false),
  imageQuality: z.enum(['low', 'medium', 'high']).default('high'),
  maxImageWidth: z.number().int().min(100).max(2000).default(1200),
  maxImageHeight: z.number().int().min(100).max(2000).default(800),
  defaultRecipients: z.array(z.string()).default([]),
  reportMessageTemplate: z.string().optional(),
  alertMessageTemplate: z.string().optional(),
})

const updateWhatsappConfigSchema = whatsappConfigSchema.partial()

// GET /api/whatsapp/config - Get all WhatsApp configurations
router.get('/config', async (req, res) => {
  try {
    const configs = await prisma.whatsAppConfig.findMany({
      orderBy: { createdAt: 'desc' }
    })
    
    res.json({
      success: true,
      data: configs
    })
  } catch (error) {
    console.error('Error fetching WhatsApp configs:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch WhatsApp configurations'
    })
  }
})

// GET /api/whatsapp/config/active - Get active WhatsApp configuration
router.get('/config/active', async (req, res) => {
  try {
    const activeConfig = await prisma.whatsAppConfig.findFirst({
      where: { isActive: true }
    })
    
    if (!activeConfig) {
      return res.status(404).json({
        success: false,
        error: 'No active WhatsApp configuration found'
      })
    }
    
    return res.json({
      success: true,
      data: activeConfig
    })
  } catch (error) {
    console.error('Error fetching active WhatsApp config:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active WhatsApp configuration'
    })
  }
})

// POST /api/whatsapp/config - Create new WhatsApp configuration
router.post('/config', async (req, res) => {
  try {
    const validatedData = whatsappConfigSchema.parse(req.body)
    
    // If this config is set to active, deactivate others
    if (validatedData.isActive) {
      await prisma.whatsAppConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }
    
    const config = await prisma.whatsAppConfig.create({
      data: {
        ...validatedData,
        createdBy: req.headers['x-user-id'] as string || 'system'
      }
    })
    
    return res.status(201).json({
      success: true,
      data: config
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      })
    }
    
    console.error('Error creating WhatsApp config:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create WhatsApp configuration'
    })
  }
})

// PUT /api/whatsapp/config/:id - Update WhatsApp configuration
router.put('/config/:id', async (req, res) => {
  try {
    const { id } = req.params
    const validatedData = updateWhatsappConfigSchema.parse(req.body)
    
    // If this config is set to active, deactivate others
    if (validatedData.isActive) {
      await prisma.whatsAppConfig.updateMany({
        where: { 
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      })
    }
    
    const config = await prisma.whatsAppConfig.update({
      where: { id },
      data: validatedData
    })
    
    return res.json({
      success: true,
      data: config
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      })
    }
    
    console.error('Error updating WhatsApp config:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update WhatsApp configuration'
    })
  }
})

// DELETE /api/whatsapp/config/:id - Delete WhatsApp configuration
router.delete('/config/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    await prisma.whatsAppConfig.delete({
      where: { id }
    })
    
    res.json({
      success: true,
      message: 'WhatsApp configuration deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting WhatsApp config:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete WhatsApp configuration'
    })
  }
})

// POST /api/whatsapp/send-report - Send report via WhatsApp
router.post('/send-report', async (req, res) => {
  try {
    const { recipients, reportData, useImageReport, format = 'summary' } = req.body
    
    // Validate required parameters
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty'
      })
    }
    
    if (!reportData) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required'
      })
    }
    
    // Ensure reportData has proper structure with defaults
    // Transform repository data to match ImageGenerationService expectations
    const transformedRepositories = (reportData.repositories || []).map((repo: any) => {
      const capacityGB = repo.capacityGB || repo.capacity || 0
      const usedSpaceGB = repo.usedSpaceGB || repo.used || 0
      const usagePercent = capacityGB > 0 ? parseFloat(((usedSpaceGB / capacityGB) * 100).toFixed(2)) : 0
      
      return {
        ...repo,
        // Convert GB to TB for display
        capacity: parseFloat((capacityGB / 1024).toFixed(2)),
        used: parseFloat((usedSpaceGB / 1024).toFixed(2)),
        usagePercent,
        // Keep original fields for compatibility
        capacityGB,
        usedSpaceGB
      }
    })
    
    const normalizedReportData = {
      summary: reportData.summary || {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        warningJobs: 0,
        totalRepositories: 0,
        totalAlerts: 0
      },
      dateRange: reportData.dateRange || {
        startDate: null,
        endDate: null
      },
      jobs: reportData.jobs || [],
      repositories: transformedRepositories
    }
    
    // Get active WhatsApp configuration
    let activeConfig
    try {
      activeConfig = await prisma.whatsAppConfig.findFirst({
        where: { isActive: true }
      })
    } catch (dbError: any) {
      // Handle case where whatsapp_configs table doesn't exist
      if (dbError.code === 'P2021' || dbError.message?.includes('does not exist')) {
        console.warn('WhatsApp configs table does not exist, using default configuration')
        activeConfig = {
          apiUrl: 'http://localhost:8192/send-message',
          comprehensiveImageReport: true,
          imageQuality: 'high',
          maxImageWidth: 1200,
          maxImageHeight: 800
        }
      } else {
        throw dbError
      }
    }
    
    if (!activeConfig) {
      return res.status(404).json({
        success: false,
        error: 'No active WhatsApp configuration found'
      })
    }
    
    // Check if comprehensive image report is enabled and requested
    const shouldUseImageReport = useImageReport && activeConfig.comprehensiveImageReport
    
    let imageBuffer: Buffer | null = null
    if (shouldUseImageReport) {
      try {
        console.log('Generating comprehensive image report with config:', {
          imageQuality: activeConfig.imageQuality,
          maxWidth: activeConfig.maxImageWidth,
          maxHeight: activeConfig.maxImageHeight
        })
        
        imageBuffer = await imageGenerationService.generateReportImage(normalizedReportData, {
           width: activeConfig.maxImageWidth,
           height: activeConfig.maxImageHeight,
           quality: activeConfig.imageQuality as 'low' | 'medium' | 'high',
           format: 'png'
         })
        
        console.log(`Generated image report: ${imageBuffer.length} bytes`)
      } catch (imageError) {
        console.error('Failed to generate image report, falling back to text:', imageError)
      }
    }
    
    // Advanced analytics calculations
    const calculateAdvancedAnalytics = (data: any) => {
      const summary = data.summary || {}
      const jobs = data.jobs || []
      const repositories = data.repositories || []
      
      // Performance metrics
      const totalJobs = summary.totalJobs || 0
      const successRate = totalJobs > 0 ? ((summary.successfulJobs || 0) / totalJobs * 100).toFixed(2) : '0.00'
      const failureRate = totalJobs > 0 ? ((summary.failedJobs || 0) / totalJobs * 100).toFixed(2) : '0.00'
      const warningRate = totalJobs > 0 ? ((summary.warningJobs || 0) / totalJobs * 100).toFixed(2) : '0.00'
      
      // System health indicators
      const totalCapacity = repositories.reduce((sum: number, repo: any) => sum + (repo.capacity || 0), 0)
      const totalUsed = repositories.reduce((sum: number, repo: any) => sum + (repo.used || 0), 0)
      const overallUsage = totalCapacity > 0 ? ((totalUsed / totalCapacity) * 100).toFixed(2) : '0.00'
      
      // Repository health analysis
      const criticalRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) > 85).length
      const warningRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) > 70 && (repo.usagePercent || 0) <= 85).length
      const healthyRepos = repositories.filter((repo: any) => (repo.usagePercent || 0) <= 70).length
      
      // Performance trends (based on job results)
      const recentFailures = jobs.filter((job: any) => job.result === 'Failed' || job.lastResult === 'Failed').length
      const recentWarnings = jobs.filter((job: any) => job.result === 'Warning' || job.lastResult === 'Warning').length
      
      // System health score (0-100)
       let healthScore = 100
       healthScore -= (parseFloat(failureRate) * 2) // Failures heavily impact health
       healthScore -= (parseFloat(warningRate) * 1) // Warnings moderately impact health
       healthScore -= (criticalRepos * 10) // Critical repos impact health
       healthScore -= (warningRepos * 5) // Warning repos moderately impact health
       const finalHealthScore = Math.max(0, Math.min(100, healthScore)).toFixed(1)
      
      return {
         successRate,
         failureRate,
         warningRate,
         overallUsage,
         totalCapacity: totalCapacity.toFixed(2),
         totalUsed: totalUsed.toFixed(2),
         criticalRepos,
         warningRepos,
         healthyRepos,
         recentFailures,
         recentWarnings,
         healthScore: finalHealthScore
       }
    }
    
    // Format the report message with advanced analytics
    const formatReportMessage = (data: any, format: string = 'summary'): string => {
      const summary = data.summary || {}
      const analytics = calculateAdvancedAnalytics(data)
      const dateRange = `${data.dateRange?.startDate || 'N/A'} to ${data.dateRange?.endDate || 'N/A'}`
      
      // Determine dynamic icon based on system status
      let reportIcon = '✅' // Default: green checkmark for healthy system
      if (analytics.recentFailures > 0 || parseFloat(analytics.failureRate) > 0) {
        reportIcon = '🚨' // Red alert for failures
      } else if (analytics.recentWarnings > 0 || parseFloat(analytics.warningRate) > 0 || analytics.criticalRepos > 0) {
        reportIcon = '⚠️' // Yellow warning for warnings or critical repos
      } else if (parseFloat(analytics.healthScore) < 80) {
        reportIcon = '⚠️' // Yellow warning for low health score
      }
      
      let message = `${reportIcon} *Veeam Backup Report*\n\n` +
                   `📅 Period: ${dateRange}\n\n`
      
      if (format === 'summary') {
        // Summary format - brief overview
        message += `📊 *Summary:*\n` +
                  `• Total Jobs: ${summary.totalJobs || 0}\n` +
                  `• ✅ Successful: ${summary.successfulJobs || 0}\n` +
                  `• ❌ Failed: ${summary.failedJobs || 0}\n` +
                  `• ⚠️ Warnings: ${summary.warningJobs || 0}\n\n`
        
        // Basic storage info for summary
        message += `💾 *Storage:*\n` +
                  `• Total Capacity: ${analytics.totalCapacity}TB\n` +
                  `• Used: ${analytics.totalUsed}TB (${analytics.overallUsage}%)\n\n`
        
        // Only show critical issues in summary
        if (analytics.recentFailures > 0) {
          message += `🚨 *Critical Issues:*\n` +
                    `• ${analytics.recentFailures} failed job(s) need attention\n\n`
        }
        
      } else {
         // Detailed format - comprehensive analytics
         message += `📊 *Performance Summary:*\n` +
                   `• Total Jobs: ${summary.totalJobs || 0}\n` +
                   `• ✅ Success Rate: ${analytics.successRate}%\n` +
                   `• ❌ Failure Rate: ${analytics.failureRate}%\n` +
                   `• ⚠️ Warning Rate: ${analytics.warningRate}%\n` +
                   `• 🚨 Active Alerts: ${summary.totalAlerts || 0}\n\n` +
                   `🏥 *System Health Score: ${analytics.healthScore}/100*\n\n`
        
        // Add storage analytics
         message += `💾 *Storage Analytics:*\n` +
                   `• Total Capacity: ${analytics.totalCapacity}TB\n` +
                   `• Total Used: ${analytics.totalUsed}TB\n` +
                   `• Overall Usage: ${analytics.overallUsage}%\n\n`
        
        // Add repository health breakdown
         if (data.repositories && data.repositories.length > 0) {
          message += `🗄️ *Repository Health:*\n` +
                    `• 🟢 Healthy: ${analytics.healthyRepos} repos (≤70%)\n` +
                    `• 🟡 Warning: ${analytics.warningRepos} repos (70-85%)\n` +
                    `• 🔴 Critical: ${analytics.criticalRepos} repos (>85%)\n\n`
          
          // Show top repositories by usage
          const topRepos = data.repositories
            .sort((a: any, b: any) => (b.usagePercent || 0) - (a.usagePercent || 0))
            .slice(0, 3)
          
          if (topRepos.length > 0) {
            message += `📊 *Top Repository Usage:*\n`
            topRepos.forEach((repo: any) => {
              const capacityTB = repo.capacity ? repo.capacity.toFixed(2) : '0.00'
              const usedTB = repo.used ? repo.used.toFixed(2) : '0.00'
              const usagePercent = repo.usagePercent ? repo.usagePercent.toFixed(2) : '0.00'
              const statusIcon = parseFloat(usagePercent) > 85 ? '🔴' : parseFloat(usagePercent) > 70 ? '🟡' : '🟢'
              
              message += `• ${statusIcon} ${repo.name || 'Unknown'}: ${usedTB}TB / ${capacityTB}TB (${usagePercent}%)\n`
            })
            message += `\n`
          }
        }
        
        // Add performance trends and critical issues
        if (analytics.recentFailures > 0 || analytics.recentWarnings > 0) {
          message += `⚠️ *Performance Trends:*\n`
          
          if (analytics.recentFailures > 0) {
            const failedJobs = data.jobs.filter((job: any) => job.result === 'Failed' || job.lastResult === 'Failed')
            message += `• 🔴 Recent Failures: ${analytics.recentFailures}\n`
            
            // Show top 3 failed jobs with details
            const topFailedJobs = failedJobs.slice(0, 3)
            topFailedJobs.forEach((job: any) => {
              const jobType = job.type || 'Backup'
              const duration = job.duration || 'Unknown'
              message += `  - ${job.name || 'Unknown Job'} (${jobType})\n`
              if (job.message) {
                message += `    Error: ${job.message.substring(0, 50)}${job.message.length > 50 ? '...' : ''}\n`
              }
            })
          }
          
          if (analytics.recentWarnings > 0) {
            const warningJobs = data.jobs.filter((job: any) => job.result === 'Warning' || job.lastResult === 'Warning')
            message += `• 🟡 Recent Warnings: ${analytics.recentWarnings}\n`
            
            // Show top 3 warning jobs with details
            const topWarningJobs = warningJobs.slice(0, 3)
            topWarningJobs.forEach((job: any) => {
              const jobType = job.type || 'Backup'
              const duration = job.duration || 'Unknown'
              message += `  - ${job.name || 'Unknown Job'} (${jobType})\n`
              if (job.message) {
                message += `    Warning: ${job.message.substring(0, 50)}${job.message.length > 50 ? '...' : ''}\n`
              }
            })
          }
          
          message += `\n`
        }
        
        // Add system recommendations based on health score
        if (parseFloat(analytics.healthScore) < 80) {
          message += `💡 *Recommendations:*\n`
          
          if (analytics.criticalRepos > 0) {
            message += `• 🔴 ${analytics.criticalRepos} repository(ies) need immediate attention (>85% full)\n`
          }
          
          if (parseFloat(analytics.failureRate) > 10) {
            message += `• 🚨 High failure rate detected - review backup configurations\n`
          }
          
          if (parseFloat(analytics.overallUsage) > 80) {
            message += `• 💾 Consider expanding storage capacity (${analytics.overallUsage}% used)\n`
          }
          
          message += `\n`
        }
      }
      
      message += `Generated: ${new Date().toLocaleString()}`
      
      return message
    }
    

    
    // Helper function to format phone number for Baileys API
    const phoneNumberFormatter = (number: string): string => {
      // Remove all non-numeric characters
      let formatted = number.replace(/\D/g, '')
      
      // Add country code if not present
      if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1)
      } else if (!formatted.startsWith('62')) {
        formatted = '62' + formatted
      }
      
      // Return in WhatsApp format for Baileys
      return formatted + '@c.us'
    }
    
    // Send WhatsApp messages to recipients
    const results = []
    const reportMessage = formatReportMessage(normalizedReportData, format)
    
    for (const recipient of recipients) {
      // Declare payload and tempImagePath outside try-catch for cleanup access
      let payload: any;
      let tempImagePath: string | null = null;
      
      try {
        const formattedNumber = phoneNumberFormatter(recipient.trim())
        
        // Direct WhatsApp API endpoint that works
        const whatsappApiUrl = activeConfig.apiUrl || 'http://localhost:8192/send-message'
        
        // Prepare FormData for multipart/form-data request (Python requests compatible)
        let formData;
        
        // If image report is available, send as image with caption
        if (shouldUseImageReport && imageBuffer) {
          // Save image to temporary file for form upload
          try {
            // Use server temp directory instead of system temp
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const tempDir = path.join(__dirname, '../../temp');
            
            // Ensure temp directory exists
            await fs.promises.mkdir(tempDir, { recursive: true });
            
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            tempImagePath = path.join(tempDir, `whatsapp-report-${timestamp}-${randomId}.png`);
            
            // Write image buffer to temporary file
            await fs.promises.writeFile(tempImagePath, imageBuffer);
            
            console.log(`📁 Temporary image saved: ${tempImagePath} (${imageBuffer.length} bytes)`);
          } catch (fileError) {
            console.error('Failed to save temporary image file:', fileError);
            throw new Error('Failed to save image temporarily');
          }
          
          // Create FormData using native FormData (like fetch)
          formData = new FormData();
          
          // Add form data fields exactly as in working curl command
          formData.append('number', formattedNumber.replace('@c.us', ''));
          formData.append('message', reportMessage);
          
          // Add image as Blob (native FormData approach)
          const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
          formData.append('image', imageBlob, path.basename(tempImagePath));
          
          console.log('📤 Sending image report with Python-compatible format to:', formattedNumber)
          console.log('📋 Temporary image file path:', tempImagePath)
        } else {
          // Send text message using native FormData
          formData = new FormData();
          
          // Add form data fields exactly as in working curl command
          formData.append('number', formattedNumber.replace('@c.us', ''));
          formData.append('message', reportMessage);
          
          console.log('📤 Sending text report with native FormData to:', formattedNumber)
        }
        
        console.log(`Sending WhatsApp message to ${formattedNumber} via Baileys API using form-data`)
        
        const response = await fetch(whatsappApiUrl, {
          method: 'POST',
          headers: {
            'X-Forwarded-For': '10.170.50.2'
            // No need to set Content-Type, fetch will set it automatically for FormData
          },
          body: formData,
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        // Get response text first
        const responseText = await response.text()
        
        if (!response.ok) {
          throw new Error(`WhatsApp API error: ${response.status} ${response.statusText} - ${responseText}`)
        }
        
        let responseData
        try {
          responseData = JSON.parse(responseText)
        } catch (jsonError) {
          // If JSON parsing fails, log the raw response
          console.error(`WhatsApp API returned non-JSON response: ${responseText}`)
          throw new Error(`WhatsApp API returned invalid response: ${responseText}`)
        }
        
        results.push({
          recipient: formattedNumber,
          success: true,
          response: responseData
        })
        
        console.log(`✅ WhatsApp report sent successfully to ${formattedNumber}`)
        
        // Keep temporary file for user inspection (don't delete)
        if (tempImagePath) {
          console.log(`📋 Temporary file preserved for inspection: ${tempImagePath}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to send WhatsApp report to ${recipient}:`, error)
        
        // Keep temporary image file even on error for inspection
        if (tempImagePath) {
          console.log(`📋 Temporary file preserved after error for inspection: ${tempImagePath}`);
        }
        
        results.push({
          recipient,
          success: false,
          error: error.message
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    return res.json({
      success: successCount > 0,
      message: `Report sent to ${successCount}/${recipients.length} recipient(s)`,
      data: {
        recipients,
        imageReport: shouldUseImageReport,
        totalRecipients: recipients.length,
        successCount,
        failureCount: recipients.length - successCount,
        results,
        config: {
          imageQuality: activeConfig.imageQuality,
          maxWidth: activeConfig.maxImageWidth,
          maxHeight: activeConfig.maxImageHeight
        }
      }
    })
  } catch (error) {
    console.error('Error sending WhatsApp report:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp report'
    })
  }
})

export default router