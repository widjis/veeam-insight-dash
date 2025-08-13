import * as React from "react"
import { useEffect } from "react"
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
    apiUrl: "http://10.60.10.59:8192",
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

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      // Load from localStorage first
      const saved = localStorage.getItem(STORAGE_KEY)
      let settings = DEFAULT_SETTINGS
      if (saved) {
        try {
          settings = JSON.parse(saved)
        } catch (e) {
          // ignore parse errors
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
            settings.whatsapp = result.data
          } else {
            console.error('Failed to load WhatsApp settings:', result.error)
          }
        } catch (error) {
          console.error('Failed to load WhatsApp settings:', error)
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
      
      // Save to localStorage for other settings
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="America/New_York">America/New_York</SelectItem>
                                <SelectItem value="Europe/London">Europe/London</SelectItem>
                                <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
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
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
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
                    <Button type="submit">Save changes</Button>
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
    </div>
  )
}

export default Settings
