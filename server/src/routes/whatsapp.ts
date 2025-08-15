import { Router } from 'express'
import { PrismaClient } from '../generated/prisma'
import { z } from 'zod'
import { imageGenerationService } from '../services/ImageGenerationService.js'

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
    const { recipients, reportData, useImageReport } = req.body
    
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
          comprehensiveImageReport: false,
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
        
        imageBuffer = await imageGenerationService.generateReportImage(reportData, {
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
    
    // Format the report message
    const formatReportMessage = (data: any): string => {
      const summary = data.summary || {}
      const dateRange = `${data.dateRange?.startDate || 'N/A'} to ${data.dateRange?.endDate || 'N/A'}`
      
      return `🔄 *Veeam Backup Report*\n\n` +
             `📅 Period: ${dateRange}\n\n` +
             `📊 *Summary:*\n` +
             `• Total Jobs: ${summary.totalJobs || 0}\n` +
             `• ✅ Successful: ${summary.successfulJobs || 0}\n` +
             `• ❌ Failed: ${summary.failedJobs || 0}\n` +
             `• ⚠️ Warnings: ${summary.warningJobs || 0}\n` +
             `• 💾 Repositories: ${summary.totalRepositories || 0}\n` +
             `• 🚨 Active Alerts: ${summary.totalAlerts || 0}\n\n` +
             `Generated: ${new Date().toLocaleString()}`
    }
    

    
    // Helper function to format phone number
    const phoneNumberFormatter = (number: string): string => {
      // Remove all non-numeric characters
      let formatted = number.replace(/\D/g, '')
      
      // Add country code if not present
      if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substring(1)
      } else if (!formatted.startsWith('62')) {
        formatted = '62' + formatted
      }
      
      return formatted + '@c.us'
    }
    
    // Send WhatsApp messages to recipients
    const results = []
    const reportMessage = formatReportMessage(reportData)
    
    for (const recipient of recipients) {
      try {
        const formattedNumber = phoneNumberFormatter(recipient.trim())
        
        // Prepare payload
        const payload: any = {
          number: formattedNumber,
          message: reportMessage,
        }
        
        // If image report is available, add it to payload
        if (shouldUseImageReport && imageBuffer) {
          payload.image = imageBuffer.toString('base64')
          payload.caption = reportMessage
          console.log('Image report attached for:', formattedNumber)
        }
        
        // Send message to WhatsApp API
        const whatsappApiUrl = activeConfig.apiUrl || 'https://api.callmebot.com/whatsapp.php'
        
        const response = await fetch(whatsappApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (!response.ok) {
          throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`)
        }
        
        const responseData = await response.json()
        
        results.push({
          recipient: formattedNumber,
          success: true,
          response: responseData
        })
        
        console.log(`WhatsApp report sent successfully to ${formattedNumber}`)
      } catch (error: any) {
        console.error(`Failed to send WhatsApp report to ${recipient}:`, error)
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