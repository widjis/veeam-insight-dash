import * as React from "react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import ScheduledReports from "@/components/ScheduledReports"

const SettingsSchema = z.object({
  alerts: z.object({
    enabled: z.boolean().default(true),
    notifyOnFailure: z.boolean().default(true),
    thresholds: z.object({
      repoWarn: z.coerce.number().min(50).max(99),
      repoCritical: z.coerce.number().min(60).max(100),
      longRunningMinutes: z.coerce.number().min(1).max(1440),
    }),
    resending: z.object({
      enabled: z.boolean().default(true),
      resendInterval: z.coerce.number().min(1).max(1440).default(15),
      maxResends: z.coerce.number().min(1).max(10).default(3),
    }),
    channels: z.object({
      email: z.boolean().default(true),
      emailRecipients: z.string().optional().default(""),
      whatsapp: z.boolean().default(false),
      whatsappRecipients: z.string().optional().default(""),
      webhook: z.boolean().default(false),
      webhookUrl: z.string().url().optional().or(z.literal("")).default(""),
    }),
  }),
  whatsapp: z.object({
    enabled: z.boolean().default(false),
    apiUrl: z.string().url().optional().or(z.literal("")).default(""),
    apiToken: z.string().optional().default(""),
    chatId: z.string().optional().default(""),
    defaultRecipients: z.string().optional().default(""),
  }),
  reporting: z.object({
    dailySummary: z.boolean().default(true),
    weeklyTrend: z.boolean().default(true),
    monthlyCapacity: z.boolean().default(false),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
    timezone: z.string().default("UTC"),
    format: z.enum(["html", "pdf", "csv"]).default("html"),
    recipients: z.string().optional().default(""),
    whatsappEnabled: z.boolean().default(false),
    whatsappRecipients: z.string().optional().default(""),
    whatsappFormat: z.enum(["summary", "detailed"]).default("summary"),
    whatsappImageReport: z.boolean().default(false),
  }),
  general: z.object({
    pollIntervalSec: z.coerce.number().min(10).max(3600).default(60),
    soundAlerts: z.boolean().default(false),
  }),
})

export type SettingsValues = z.infer<typeof SettingsSchema>

const DEFAULT_SETTINGS: SettingsValues = {
  alerts: {
    enabled: true,
    notifyOnFailure: true,
    thresholds: {
      repoWarn: 80,
      repoCritical: 90,
      longRunningMinutes: 60,
    },
    resending: {
      enabled: true,
      resendInterval: 15,
      maxResends: 3,
    },
    channels: {
      email: true,
      emailRecipients: "alerts@example.com",
      whatsapp: false,
      whatsappRecipients: "",
      webhook: false,
      webhookUrl: "",
    },
  },
  whatsapp: {
    enabled: false,
    apiUrl: "",
    apiToken: "",
    chatId: "",
    defaultRecipients: "",
  },
  reporting: {
    dailySummary: true,
    weeklyTrend: true,
    monthlyCapacity: false,
    timeOfDay: "09:00",
    timezone: "UTC",
    format: "html",
    recipients: "ops@example.com, backup@example.com",
    whatsappEnabled: false,
    whatsappRecipients: "",
    whatsappFormat: "summary",
    whatsappImageReport: false,
  },
  general: {
    pollIntervalSec: 60,
    soundAlerts: false,
  },
}

const STORAGE_KEY = "veeam-settings"

const Settings = () => {
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [reportConfigs, setReportConfigs] = useState<any[]>([])
  const [loadingReportConfigs, setLoadingReportConfigs] = useState(false)

  const form = useForm<SettingsValues>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: DEFAULT_SETTINGS,
    mode: "onChange",
  })

  // SEO: title, meta description, canonical
  useEffect(() => {
    document.title = "Settings | Veeam Monitoring"
    const desc =
      "Configure alerts, reporting schedules, and general preferences for your Veeam monitoring dashboard."

    let meta = document.querySelector('meta[name="description"]') as
      | HTMLMetaElement
      | null
    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "description"
      document.head.appendChild(meta)
    }
    meta.content = desc

    let canonical = document.querySelector('link[rel="canonical"]') as
      | HTMLLinkElement
      | null
    if (!canonical) {
      canonical = document.createElement("link")
      canonical.rel = "canonical"
      document.head.appendChild(canonical)
    }
    canonical.href = window.location.href
  }, [])

  // Load existing report configurations from database
  const loadReportConfigs = async () => {
    if (!isAuthenticated) return
    
    setLoadingReportConfigs(true)
    try {
      const result = await apiClient.getReportConfigs()
      if (result.success && result.data) {
        setReportConfigs(result.data)
        return result.data
      } else {
        console.error('Failed to load report configurations:', result.error)
        return []
      }
    } catch (error) {
      console.error('Failed to load report configurations:', error)
      return []
    } finally {
      setLoadingReportConfigs(false)
    }
  }

  // Save report configurations to database
  const saveReportConfigurations = async (reportingSettings: any) => {
    const reportTypes = [
      { type: 'DAILY_SUMMARY' as const, enabled: reportingSettings.dailySummary, name: 'Daily Summary Report' },
      { type: 'WEEKLY_TREND' as const, enabled: reportingSettings.weeklyTrend, name: 'Weekly Trend Report' },
      { type: 'MONTHLY_CAPACITY' as const, enabled: reportingSettings.monthlyCapacity, name: 'Monthly Capacity Report' }
    ]

    for (const reportType of reportTypes) {
      try {
        // Find existing config for this type
        const existingConfig = reportConfigs.find(c => c.type === reportType.type)
        
        const configData = {
          name: reportType.name,
          type: reportType.type,
          enabled: reportType.enabled,
          deliveryTime: reportingSettings.timeOfDay,
          timezone: reportingSettings.timezone,
          emailRecipients: reportingSettings.recipients,
          reportFormat: reportingSettings.format.toUpperCase() as 'HTML' | 'PDF' | 'CSV',
          whatsappEnabled: reportingSettings.whatsappEnabled,
          whatsappRecipients: reportingSettings.whatsappRecipients,
          whatsappFormat: reportingSettings.whatsappFormat.toUpperCase() as 'SUMMARY' | 'DETAILED',
          whatsappImageReport: reportingSettings.whatsappImageReport
        }

        if (existingConfig) {
          // Update existing configuration
          const updateResult = await apiClient.updateReportConfig(existingConfig.id, {
            enabled: configData.enabled,
            deliveryTime: configData.deliveryTime,
            timezone: configData.timezone,
            emailRecipients: configData.emailRecipients,
            reportFormat: configData.reportFormat,
            whatsappEnabled: configData.whatsappEnabled,
            whatsappRecipients: configData.whatsappRecipients,
            whatsappFormat: configData.whatsappFormat,
            whatsappImageReport: configData.whatsappImageReport
          })
          
          if (!updateResult.success) {
            throw new Error(`Failed to update ${reportType.name}: ${updateResult.error}`)
          }
        } else {
          // Create new configuration
          const createResult = await apiClient.createReportConfig(configData)
          
          if (!createResult.success) {
            throw new Error(`Failed to create ${reportType.name}: ${createResult.error}`)
          }
        }
      } catch (error) {
        console.error(`Error saving ${reportType.name}:`, error)
        throw error
      }
    }

    // Reload configurations to update state
    await loadReportConfigs()
  }

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      // Start with default settings
      let settings = { ...DEFAULT_SETTINGS }
      
      // Load from localStorage (but exclude WhatsApp settings as they come from backend)
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const savedSettings = JSON.parse(saved)
          // Merge all settings except WhatsApp (which comes from backend)
          settings = {
            ...savedSettings,
            whatsapp: settings.whatsapp // Keep default WhatsApp settings
          }
        } catch (e) {
          console.warn('Failed to parse saved settings from localStorage:', e)
        }
      }
      
      // Load WhatsApp settings from backend only if authenticated
      if (isAuthenticated) {
        try {
          console.log('Loading WhatsApp settings from backend...')
          const result = await apiClient.getWhatsAppSettings()
          console.log('WhatsApp settings result:', result)
          if (result.success && result.data) {
            console.log('WhatsApp settings data:', result.data)
            // Ensure we completely replace WhatsApp settings with backend data
            settings.whatsapp = {
              enabled: result.data.enabled ?? false,
              apiUrl: result.data.apiUrl ?? '',
              apiToken: result.data.apiToken ?? '',
              chatId: result.data.chatId ?? '',
              defaultRecipients: result.data.defaultRecipients ?? ''
            }
          } else {
            console.error('Failed to load WhatsApp settings:', result.error)
          }
        } catch (error) {
          console.error('Failed to load WhatsApp settings:', error)
        }

        // Load existing report configurations and update form with database values
        const configs = await loadReportConfigs()
        if (configs && configs.length > 0) {
          // Update settings with database values
          const dailyConfig = configs.find(c => c.type === 'DAILY_SUMMARY')
          const weeklyConfig = configs.find(c => c.type === 'WEEKLY_TREND')
          const monthlyConfig = configs.find(c => c.type === 'MONTHLY_CAPACITY')
          
          if (dailyConfig || weeklyConfig || monthlyConfig) {
            // Use the first available config for shared settings (time, timezone, etc.)
            const primaryConfig = dailyConfig || weeklyConfig || monthlyConfig
            
            settings.reporting = {
              ...settings.reporting,
              dailySummary: dailyConfig?.enabled ?? settings.reporting.dailySummary,
              weeklyTrend: weeklyConfig?.enabled ?? settings.reporting.weeklyTrend,
              monthlyCapacity: monthlyConfig?.enabled ?? settings.reporting.monthlyCapacity,
              timeOfDay: primaryConfig?.deliveryTime || settings.reporting.timeOfDay,
              timezone: primaryConfig?.timezone || settings.reporting.timezone,
              format: primaryConfig?.reportFormat?.toLowerCase() || settings.reporting.format,
              recipients: primaryConfig?.emailRecipients || settings.reporting.recipients,
              whatsappEnabled: primaryConfig?.whatsappEnabled ?? settings.reporting.whatsappEnabled,
              whatsappRecipients: primaryConfig?.whatsappRecipients || settings.reporting.whatsappRecipients,
              whatsappFormat: primaryConfig?.whatsappFormat?.toLowerCase() || settings.reporting.whatsappFormat,
              whatsappImageReport: primaryConfig?.whatsappImageReport ?? settings.reporting.whatsappImageReport,
            }
          }
        }
      } else {
        console.log('User not authenticated, skipping WhatsApp settings load')
      }
      
      console.log('Final settings before form reset:', settings)
      form.reset(settings)
    }
    
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const handleTestAlerts = async () => {
    try {
      const response = await apiClient.generateTestAlerts()
      if (response.success) {
        toast({
          title: "Test Alerts Generated",
          description: "Check the notification bell for test alerts.",
        })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to generate test alerts",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate test alerts",
        variant: "destructive",
      })
    }
  }

  const handleTestWhatsAppPersonal = async () => {
    try {
      const result = await apiClient.testWhatsAppPersonal({
        number: '6285712612218', // Example number
        message: 'Test message from Veeam Insight Dashboard'
      })
      
      if (result.success) {
        toast({
          title: "WhatsApp Test Sent",
          description: "Personal WhatsApp message sent successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to send WhatsApp message",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send WhatsApp test message",
        variant: "destructive",
      })
    }
  }

  const handleTestWhatsAppGroup = async () => {
    try {
      const result = await apiClient.testWhatsAppGroup({
        message: 'Test group message from Veeam Insight Dashboard'
      })
      
      if (result.success) {
        toast({
          title: "WhatsApp Group Test Sent",
          description: "Group WhatsApp message sent successfully.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to send WhatsApp group message",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send WhatsApp group test message",
        variant: "destructive",
      })
    }
  }

  const handleTestWhatsAppConnection = async () => {
    try {
      const result = await apiClient.testWhatsAppConnection()
      
      if (result.success) {
        toast({
          title: "WhatsApp Connection OK",
          description: "WhatsApp API connection is working.",
        })
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "WhatsApp API connection failed",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test WhatsApp connection",
        variant: "destructive",
      })
    }
  }

  const handleTestWhatsAppReport = async () => {
    try {
      const reportFormat = form.watch("reporting.whatsappFormat")
      const recipients = form.watch("reporting.whatsappRecipients")
      
      if (!recipients || recipients.trim() === "") {
        toast({
          title: "Error",
          description: "Please add WhatsApp recipients first",
          variant: "destructive",
        })
        return
      }

      // Parse recipients (comma-separated phone numbers)
      const recipientList = recipients.split(',').map(r => r.trim()).filter(r => r.length > 0)
      
      if (recipientList.length === 0) {
        toast({
          title: "Error",
          description: "Please provide valid WhatsApp recipients",
          variant: "destructive",
        })
        return
      }

      const result = await apiClient.sendWhatsAppReport({
        recipients: recipientList,
        format: reportFormat,
        reportType: 'daily'
      })
      
      if (result.success) {
        toast({
          title: "WhatsApp Report Sent",
          description: `Test ${reportFormat} report sent successfully to ${result.data?.successCount || 0}/${recipientList.length} recipients.`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to send WhatsApp report",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send WhatsApp test report",
        variant: "destructive",
      })
    }
  }

  const handlePreviewReport = async () => {
    try {
      toast({
        title: "Generating Preview",
        description: "Creating report preview...",
      })

      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const result = await apiClient.previewReport({
        type: 'summary',
        startDate: yesterday.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        includeJobs: true,
        includeRepositories: true,
        includeAlerts: true,
      })

      if (result.success && result.data) {
        setPreviewContent(result.data)
        setPreviewModalOpen(true)
        
        toast({
          title: "Preview Generated",
          description: "Report preview is ready.",
        })
      } else {
        throw new Error(result.error || 'Failed to generate preview')
      }
    } catch (error: any) {
      console.error('Preview generation failed:', error)
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate report preview.",
        variant: "destructive",
      })
    }
  }

  const handleSendEmailNow = async () => {
    try {
      const emailRecipients = form.getValues("reporting.recipients")
      if (!emailRecipients || emailRecipients.trim() === "") {
        toast({
          title: "Email Recipients Required",
          description: "Please enter email recipients before sending.",
          variant: "destructive",
        })
        return
      }

      // Parse recipients (comma-separated)
      const recipients = emailRecipients.split(',').map(r => r.trim()).filter(r => r.length > 0)
      
      if (recipients.length === 0) {
        toast({
          title: "Invalid Recipients",
          description: "Please enter valid email recipients.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Sending Email Report",
        description: `Sending report to ${recipients.length} recipient(s)...`,
      })

      const result = await apiClient.sendEmailReport({
        recipients,
        subject: `Veeam Report - ${new Date().toLocaleDateString()}`,
        format: 'summary',
        reportType: 'daily',
        reportFormat: form.getValues("reporting.format") || 'html',
      })

      if (result.success) {
        toast({
          title: "Email Sent",
          description: `Report sent successfully to ${recipients.length} recipient(s).`,
        })
      } else {
        throw new Error(result.error || 'Failed to send email report')
      }
    } catch (error: any) {
      console.error('Email send failed:', error)
      toast({
        title: "Email Send Failed",
        description: error.message || "Failed to send email report. Please check your email settings.",
        variant: "destructive",
      })
    }
  }

  const handleSendWhatsAppNow = async () => {
    try {
      console.log('Starting WhatsApp send process...')
      
      const whatsappRecipients = form.getValues("reporting.whatsappRecipients")
      console.log('WhatsApp recipients:', whatsappRecipients)
      
      if (!whatsappRecipients || whatsappRecipients.trim() === "") {
        toast({
          title: "WhatsApp Recipients Required",
          description: "Please enter WhatsApp recipients before sending.",
          variant: "destructive",
        })
        return
      }

      // Parse recipients (comma-separated)
      const recipients = whatsappRecipients.split(',').map(r => r.trim()).filter(r => r.length > 0)
      console.log('Parsed recipients:', recipients)
      
      if (recipients.length === 0) {
        toast({
          title: "Invalid Recipients",
          description: "Please enter valid WhatsApp recipients.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Sending WhatsApp Report",
        description: `Sending report to ${recipients.length} recipient(s)...`,
      })

      // Fetch dashboard data for report
      console.log('Fetching dashboard data...')
      const dashboardResponse = await apiClient.getDashboardStats()
      console.log('Dashboard response:', dashboardResponse)
      
      if (!dashboardResponse.success) {
        throw new Error('Failed to fetch dashboard data')
      }

      // Fetch jobs data
      console.log('Fetching jobs data...')
      const jobsResponse = await apiClient.getJobs()
      console.log('Jobs response:', jobsResponse)
      
      if (!jobsResponse.success) {
        throw new Error('Failed to fetch jobs data')
      }

      // Fetch repositories data
      console.log('Fetching repositories data...')
      const reposResponse = await apiClient.getRepositories()
      console.log('Repositories response:', reposResponse)
      
      if (!reposResponse.success) {
        throw new Error('Failed to fetch repositories data')
      }

      // Generate report data
      const reportData = {
        summary: {
          totalJobs: jobsResponse.data?.length || 0,
          successfulJobs: jobsResponse.data?.filter((job: any) => job.lastResult === 'Success').length || 0,
          failedJobs: jobsResponse.data?.filter((job: any) => job.lastResult === 'Failed').length || 0,
          warningJobs: jobsResponse.data?.filter((job: any) => job.lastResult === 'Warning').length || 0,
          totalRepositories: reposResponse.data?.length || 0,
          totalCapacity: reposResponse.data?.reduce((sum: number, repo: any) => sum + (repo.capacity || 0), 0) || 0,
          usedCapacity: reposResponse.data?.reduce((sum: number, repo: any) => sum + (repo.used || 0), 0) || 0
        },
        dateRange: {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString(), // Last 24 hours
          endDate: new Date().toLocaleDateString()
        },
        jobs: jobsResponse.data || [],
        repositories: reposResponse.data || []
      }
      
      console.log('Generated report data:', reportData)

      const result = await apiClient.sendWhatsAppReport({
        recipients,
        format: form.getValues("reporting.whatsappFormat") || "summary",
        reportType: 'daily',
        useImageReport: form.getValues("reporting.whatsappImageReport") || false,
        reportData
      })
      
      console.log('WhatsApp send result:', result)

      if (result.success) {
        toast({
          title: "WhatsApp Sent",
          description: `Report sent successfully to ${result.data?.successCount || 0}/${recipients.length} recipient(s).`,
        })
      } else {
        throw new Error(result.error || 'Failed to send WhatsApp report')
      }
    } catch (error: any) {
      console.error('WhatsApp send failed:', error)
      toast({
        title: "WhatsApp Send Failed",
        description: error.message || "Failed to send WhatsApp report. Please check your WhatsApp settings.",
        variant: "destructive",
      })
    }
  }

  const onSubmit = async (values: SettingsValues) => {
    try {
      // Save WhatsApp settings to backend (always save, regardless of enabled state)
      const result = await apiClient.updateWhatsAppSettings({
        apiUrl: values.whatsapp.apiUrl,
        apiToken: values.whatsapp.apiToken,
        chatId: values.whatsapp.chatId,
        defaultRecipients: values.whatsapp.defaultRecipients,
        enabled: values.whatsapp.enabled,
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save WhatsApp settings')
      }

      // Save report configurations to database
      await saveReportConfigurations(values.reporting)
      
      // Save to localStorage for other settings (exclude WhatsApp and reporting as they're managed by backend)
      const settingsForLocalStorage = {
        ...values,
        whatsapp: undefined, // Don't save WhatsApp settings to localStorage
        reporting: undefined // Don't save reporting settings to localStorage
      }
      delete settingsForLocalStorage.whatsapp
      delete settingsForLocalStorage.reporting
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsForLocalStorage))
      
      toast({ title: "Settings saved", description: "Your preferences have been updated." })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      })
    }
  }

  const onRestoreDefaults = () => {
    form.reset(DEFAULT_SETTINGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    toast({ title: "Defaults restored", description: "Reverted to default settings." })
  }

  const disabledAlerts = !form.watch("alerts.enabled")
  const emailEnabled = form.watch("alerts.channels.email")
  const whatsappEnabled = form.watch("alerts.channels.whatsapp")
  const webhookEnabled = form.watch("alerts.channels.webhook")

  return (
    <div className="min-h-screen bg-dashboard-bg">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage alerts, reporting, and general preferences.
          </p>
        </header>

        <Tabs defaultValue="alerts" className="mt-4">
          <TabsList>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="scheduled-reports">Scheduled Reports</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              {/* Alerts */}
              <TabsContent value="alerts" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Alerting</CardTitle>
                    <CardDescription>
                      Configure thresholds and notification channels for immediate alerts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="alerts.enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Enable Alerts</FormLabel>
                            <FormDescription>
                              Turn on to receive alert notifications.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="alerts.thresholds.repoWarn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Repository Warning %</FormLabel>
                            <FormControl>
                              <Input type="number" min={50} max={99} disabled={disabledAlerts} {...field} />
                            </FormControl>
                            <FormDescription>Warn when storage exceeds this percentage.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="alerts.thresholds.repoCritical"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Repository Critical %</FormLabel>
                            <FormControl>
                              <Input type="number" min={60} max={100} disabled={disabledAlerts} {...field} />
                            </FormControl>
                            <FormDescription>Critical alert above this percentage.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="alerts.thresholds.longRunningMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Long-running Job (min)</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={1440} disabled={disabledAlerts} {...field} />
                            </FormControl>
                            <FormDescription>Alert for jobs running longer than this.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="alerts.notifyOnFailure"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Notify on Job Failure</FormLabel>
                            <FormDescription>Send an alert as soon as a job fails.</FormDescription>
                          </div>
                          <FormControl>
                            <Switch disabled={disabledAlerts} checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Alert Resending Configuration */}
                    <Card className="border-dashboard-border">
                      <CardHeader>
                        <CardTitle className="text-base">Alert Resending</CardTitle>
                        <CardDescription>
                          Configure automatic resending of unacknowledged alerts.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="alerts.resending.enabled"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>Enable Alert Resending</FormLabel>
                                <FormDescription>
                                  Automatically resend alerts if not acknowledged within the specified interval.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch disabled={disabledAlerts} checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="alerts.resending.resendInterval"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Resend Interval (minutes)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min={1} 
                                    max={1440} 
                                    disabled={disabledAlerts || !form.watch("alerts.resending.enabled")} 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormDescription>
                                  How often to resend unacknowledged alerts (1-1440 minutes).
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="alerts.resending.maxResends"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maximum Resends</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min={1} 
                                    max={10} 
                                    disabled={disabledAlerts || !form.watch("alerts.resending.enabled")} 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormDescription>
                                  Maximum number of resend attempts (1-10).
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-dashboard-border">
                        <CardHeader>
                          <CardTitle className="text-base">Email Channel</CardTitle>
                          <CardDescription>Send alerts via email.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="alerts.channels.email"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel>Enable Email</FormLabel>
                                <FormControl>
                                  <Switch disabled={disabledAlerts} checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="alerts.channels.emailRecipients"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Recipients</FormLabel>
                                <FormControl>
                                  <Textarea
                                    rows={3}
                                    placeholder="comma,separated@example.com"
                                    disabled={disabledAlerts || !emailEnabled}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>Comma-separated email addresses.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-dashboard-border">
                        <CardHeader>
                          <CardTitle className="text-base">WhatsApp Channel</CardTitle>
                          <CardDescription>Send alerts via WhatsApp messages.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="alerts.channels.whatsapp"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel>Enable WhatsApp</FormLabel>
                                <FormControl>
                                  <Switch disabled={disabledAlerts} checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="alerts.channels.whatsappRecipients"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Recipients</FormLabel>
                                <FormControl>
                                  <Textarea
                                    rows={3}
                                    placeholder="+6281234567890, +6287654321098"
                                    disabled={disabledAlerts || !whatsappEnabled}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>Comma-separated phone numbers with country code (e.g., +62 for Indonesia).</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-dashboard-border">
                        <CardHeader>
                          <CardTitle className="text-base">Webhook Channel</CardTitle>
                          <CardDescription>Send alerts to a webhook (e.g., Slack, Teams).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="alerts.channels.webhook"
                            render={({ field }) => (
                              <FormItem className="flex items-center justify-between">
                                <FormLabel>Enable Webhook</FormLabel>
                                <FormControl>
                                  <Switch disabled={disabledAlerts} checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="alerts.channels.webhookUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Webhook URL</FormLabel>
                                <FormControl>
                                  <Input
                                    type="url"
                                    placeholder="https://hooks.slack.com/..."
                                    disabled={disabledAlerts || !webhookEnabled}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>HTTPS endpoint that will receive JSON payloads.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        toast({
                          title: "Test alert sent",
                          description: "This is a preview of your alert configuration.",
                        })
                      }
                    >
                      Send test alert
                    </Button>
                    <Button type="submit">Save changes</Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* WhatsApp */}
              <TabsContent value="whatsapp" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>WhatsApp Configuration</CardTitle>
                    <CardDescription>
                      Configure WhatsApp API settings for sending messages and notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="whatsapp.enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Enable WhatsApp</FormLabel>
                            <FormDescription>
                              Turn on to enable WhatsApp messaging functionality.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="whatsapp.apiUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API URL</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="http://10.60.10.59:8192" 
                                disabled={!form.watch("whatsapp.enabled")} 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>WhatsApp API server URL.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="whatsapp.apiToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Token</FormLabel>
                            <FormControl>
                              <Input 
                                type="password" 
                                placeholder="Enter API token" 
                                disabled={!form.watch("whatsapp.enabled")} 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>Authentication token for WhatsApp API (optional if no auth required).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="whatsapp.chatId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Group Chat ID</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter group chat ID for group messages" 
                              disabled={!form.watch("whatsapp.enabled")} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Chat ID for sending group messages.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="whatsapp.defaultRecipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Recipients</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter phone numbers separated by commas (e.g., 6285712612218, 6281234567890)" 
                              disabled={!form.watch("whatsapp.enabled")} 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Default phone numbers for personal messages (with country code).</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestWhatsAppConnection}
                        disabled={!form.watch("whatsapp.enabled")}
                      >
                        Test Connection
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestWhatsAppPersonal}
                        disabled={!form.watch("whatsapp.enabled")}
                      >
                        Test Personal Message
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestWhatsAppGroup}
                        disabled={!form.watch("whatsapp.enabled")}
                      >
                        Test Group Message
                      </Button>
                    </div>
                    <Button type="submit">Save changes</Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Reporting */}
              <TabsContent value="reporting" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reporting</CardTitle>
                    <CardDescription>
                      Schedule summary reports and choose recipients.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="reporting.dailySummary"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Daily Summary</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reporting.weeklyTrend"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Weekly Trend</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reporting.monthlyCapacity"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Monthly Capacity</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="reporting.timeOfDay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormDescription>Time of day to send reports.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reporting.timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                                <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                                <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                                <SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB +7)</SelectItem>
                                <SelectItem value="Asia/Makassar">Asia/Makassar (WITA +8)</SelectItem>
                                <SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT +9)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Used to schedule report delivery.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reporting.format"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Format</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="html">HTML</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                                <SelectItem value="csv">CSV</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Preferred report format.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reporting.recipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Recipients</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder="comma,separated@example.com" {...field} />
                          </FormControl>
                          <FormDescription>Comma-separated email addresses.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* WhatsApp Reporting Section */}
                    <div className="space-y-4 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">WhatsApp Reporting</h4>
                          <p className="text-sm text-muted-foreground">Send daily monitoring reports via WhatsApp</p>
                        </div>
                        <FormField
                          control={form.control}
                          name="reporting.whatsappEnabled"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {form.watch("reporting.whatsappEnabled") && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="reporting.whatsappRecipients"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>WhatsApp Recipients</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      rows={3} 
                                      placeholder="+6281234567890, +6287654321098" 
                                      {...field} 
                                    />
                                  </FormControl>
                                  <FormDescription>Comma-separated phone numbers with country code.</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="reporting.whatsappFormat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>WhatsApp Report Format</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select format" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="summary">Summary (Brief)</SelectItem>
                                      <SelectItem value="detailed">Detailed (Full Stats)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>Choose report detail level for WhatsApp.</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="border-t pt-4">
                            <FormField
                              control={form.control}
                              name="reporting.whatsappImageReport"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-base">Comprehensive Image Report</FormLabel>
                                    <FormDescription>
                                      Generate visual report as image from HTML capture for WhatsApp delivery. 
                                      This creates a comprehensive visual summary of all monitoring data.
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    {/* Generate Report Now Section */}
                    <div className="w-full">
                      <h4 className="text-sm font-medium mb-3">Generate Report Now</h4>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePreviewReport}
                          className="flex-1 min-w-[140px]"
                        >
                          Report Preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleSendEmailNow}
                          className="flex-1 min-w-[140px]"
                        >
                          Send to Email Now
                        </Button>
                        {form.watch("reporting.whatsappEnabled") && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleSendWhatsAppNow}
                            disabled={!form.watch("reporting.whatsappEnabled")}
                            className="flex-1 min-w-[140px]"
                          >
                            Send to WhatsApp Now
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Test Section */}
                    <div className="w-full">
                      <h4 className="text-sm font-medium mb-3">Test Reports</h4>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            toast({
                              title: "Test email report sent",
                              description: "A preview email report has been generated (mock).",
                            })
                          }
                        >
                          Test Email Report
                        </Button>
                        {form.watch("reporting.whatsappEnabled") && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestWhatsAppReport}
                            disabled={!form.watch("whatsapp.enabled")}
                          >
                            Test WhatsApp Report
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Save Button */}
                    <div className="flex justify-end w-full">
                      <Button type="submit">Save changes</Button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* General */}
              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>General</CardTitle>
                    <CardDescription>
                      Global preferences for the monitoring dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="general.pollIntervalSec"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Polling Interval (sec)</FormLabel>
                            <FormControl>
                              <Input type="number" min={10} max={3600} {...field} />
                            </FormControl>
                            <FormDescription>
                              How often to refresh data during active monitoring.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="general.soundAlerts"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <div>
                              <FormLabel>Sound Alerts</FormLabel>
                              <FormDescription>Play a sound for critical alerts.</FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={onRestoreDefaults}>
                      Restore defaults
                    </Button>
                    <Button type="submit">Save changes</Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Scheduled Reports */}
              <TabsContent value="scheduled-reports" className="space-y-6">
                <ScheduledReports />
              </TabsContent>

              {/* Testing */}
              <TabsContent value="testing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Alert Testing</CardTitle>
                    <CardDescription>
                      Test the real-time alert notification system by generating sample alerts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <h4 className="font-medium mb-2">Generate Test Alerts</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          This will create sample alerts (critical, warning, and infrastructure) to test the notification system.
                          Check the notification bell in the header to see the alerts appear in real-time.
                        </p>
                        <Button 
                          type="button" 
                          onClick={handleTestAlerts}
                          className="w-full sm:w-auto"
                        >
                          Generate Test Alerts
                        </Button>
                      </div>
                      
                      <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">How it works</h4>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                          <li>• Alerts appear in real-time via WebSocket connection</li>
                          <li>• Critical alerts may play sound notifications (if enabled)</li>
                          <li>• Alerts can be acknowledged or resolved from the notification dropdown</li>
                          <li>• Test alerts are marked with metadata for identification</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Global actions */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onRestoreDefaults}>
                  Restore defaults
                </Button>
                <Button type="submit">Save all</Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </main>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>
              Preview of the generated report content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md p-4 bg-white min-h-0">
            <div 
              dangerouslySetInnerHTML={{ __html: previewContent }}
              className="prose prose-sm max-w-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Settings
