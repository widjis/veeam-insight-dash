import React, { useState, useEffect } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Plus, Edit, Trash2, Play, Pause, Calendar } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/services/api"

const ScheduledReportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["daily", "weekly", "monthly"]),
  schedule: z.string().min(1, "Schedule is required"),
  includeJobs: z.boolean().default(true),
  includeRepositories: z.boolean().default(true),
  includeAlerts: z.boolean().default(true),
  dateRange: z.enum(["1d", "7d", "30d"]).default("1d"),
  customDays: z.coerce.number().min(1).max(365).optional(),
  timezone: z.string().default("UTC"),
  delivery: z.object({
    email: z.object({
      enabled: z.boolean().default(true),
      recipients: z.string().optional().default(""),
      format: z.enum(["html", "pdf", "csv"]).default("html"),
    }),
    whatsapp: z.object({
      enabled: z.boolean().default(false),
      recipients: z.string().optional(),
      format: z.enum(["summary", "detailed"]).default("summary"),
    }),
  }),
}).refine((data) => {
  // If email is enabled, recipients must be provided
  if (data.delivery.email.enabled && (!data.delivery.email.recipients || data.delivery.email.recipients.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Email recipients are required when email delivery is enabled",
  path: ["delivery", "email", "recipients"]
})

type ScheduledReportFormData = z.infer<typeof ScheduledReportSchema>

interface ScheduledReport {
  id: string
  name: string
  description?: string
  type: "daily" | "weekly" | "monthly"
  schedule: string
  enabled: boolean
  includeJobs: boolean
  includeRepositories: boolean
  includeAlerts: boolean
  dateRange: "1d" | "7d" | "30d"
  customDays?: number
  timezone: string
  delivery: {
    email: {
      enabled: boolean
      recipients: string
      format: "html" | "pdf" | "csv"
    }
    whatsapp: {
      enabled: boolean
      recipients?: string
      format: "summary" | "detailed"
    }
  }
  lastRun?: string
  nextRun?: string
}

const ScheduledReports = () => {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)
  const { toast } = useToast()

  const form = useForm<ScheduledReportFormData>({
    resolver: zodResolver(ScheduledReportSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "daily",
      schedule: "09:00",
      includeJobs: true,
      includeRepositories: true,
      includeAlerts: true,
      dateRange: "1d",
      timezone: "UTC",
      delivery: {
        email: {
          enabled: true,
          recipients: "",
          format: "html",
        },
        whatsapp: {
          enabled: false,
          recipients: "",
          format: "summary",
        },
      },
    },
  })

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/scheduled-reports')
      // Handle the backend response format: { success: boolean, data: array }
      if (response.success && Array.isArray(response.data)) {
        setReports(response.data)
      } else {
        console.warn('Invalid response format:', response)
        setReports([])
      }
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
      // Set empty array on error to prevent undefined access
      setReports([])
      toast({
        title: "Error",
        description: "Failed to fetch scheduled reports",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const onSubmit = async (data: ScheduledReportFormData) => {
    try {
      if (editingReport) {
        await apiClient.put(`/api/scheduled-reports/${editingReport.id}`, data)
        toast({
          title: "Success",
          description: "Scheduled report updated successfully",
        })
      } else {
        await apiClient.post('/api/scheduled-reports', data)
        toast({
          title: "Success",
          description: "Scheduled report created successfully",
        })
      }
      setDialogOpen(false)
      setEditingReport(null)
      form.reset()
      fetchReports()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save scheduled report",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report)
    form.reset({
      name: report.name,
      description: report.description || "",
      type: report.type,
      schedule: report.schedule,
      includeJobs: report.includeJobs,
      includeRepositories: report.includeRepositories,
      includeAlerts: report.includeAlerts,
      dateRange: report.dateRange,
      customDays: report.customDays,
      timezone: report.timezone,
      delivery: report.delivery,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/api/scheduled-reports/${id}`)
      toast({
        title: "Success",
        description: "Scheduled report deleted successfully",
      })
      fetchReports()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete scheduled report",
        variant: "destructive",
      })
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiClient.patch(`/api/scheduled-reports/${id}/toggle`, { enabled })
      toast({
        title: "Success",
        description: `Scheduled report ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
      fetchReports()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle scheduled report",
        variant: "destructive",
      })
    }
  }

  const handleTrigger = async (id: string) => {
    try {
      await apiClient.post(`/api/scheduled-reports/${id}/trigger`)
      toast({
        title: "Success",
        description: "Report generation triggered successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger report generation",
        variant: "destructive",
      })
    }
  }

  const getScheduleDisplay = (type: string, schedule: string) => {
    switch (type) {
      case 'daily':
        return `Daily at ${schedule}`
      case 'weekly':
        return `Weekly on ${schedule}`
      case 'monthly':
        return `Monthly on ${schedule}`
      default:
        return schedule
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Scheduled Reports</h3>
          <p className="text-sm text-muted-foreground">
            Manage automated report generation and delivery
          </p>
        </div>
        <Button onClick={() => {
          setEditingReport(null)
          form.reset()
          setDialogOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Report
        </Button>
        
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? 'Edit Scheduled Report' : 'Create Scheduled Report'}
              </DialogTitle>
              <DialogDescription>
                Configure automated report generation and delivery settings.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Daily Summary Report" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Report description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule</FormLabel>
                        <FormControl>
                          <Input 
                            type={form.watch('type') === 'daily' ? 'time' : 'text'}
                            placeholder={form.watch('type') === 'daily' ? '09:00' : 'Monday'}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {form.watch('type') === 'daily' && 'Time of day (HH:MM)'}
                          {form.watch('type') === 'weekly' && 'Day of week'}
                          {form.watch('type') === 'monthly' && 'Day of month'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Range</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1d">Last 24 hours</SelectItem>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timezone"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Report Content</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="includeJobs"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Include Jobs</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="includeRepositories"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Include Repositories</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="includeAlerts"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Include Alerts</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Email Delivery</h4>
                    <FormField
                      control={form.control}
                      name="delivery.email.enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch("delivery.email.enabled") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="delivery.email.recipients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Recipients {!form.watch("delivery.email.enabled") && "(Optional)"}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="email1@example.com, email2@example.com" 
                              {...field} 
                              disabled={!form.watch("delivery.email.enabled")}
                            />
                          </FormControl>
                          <FormDescription>Comma-separated email addresses</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="delivery.email.format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Format</FormLabel>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">WhatsApp Delivery</h4>
                    <FormField
                      control={form.control}
                      name="delivery.whatsapp.enabled"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch('delivery.whatsapp.enabled') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="delivery.whatsapp.recipients"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp Recipients</FormLabel>
                            <FormControl>
                              <Textarea placeholder="+6281234567890, +6287654321098" {...field} />
                            </FormControl>
                            <FormDescription>Comma-separated phone numbers with country code</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="delivery.whatsapp.format"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp Format</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="summary">Summary</SelectItem>
                                <SelectItem value="detailed">Detailed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingReport ? 'Update Report' : 'Create Report'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading scheduled reports...</div>
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Scheduled Reports</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Create your first scheduled report to automate report generation and delivery.
            </p>
            <Button onClick={() => {
              setEditingReport(null)
              form.reset()
              setDialogOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {report.name}
                      <Badge variant={report.enabled ? "default" : "secondary"}>
                        {report.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </CardTitle>
                    {report.description && (
                      <CardDescription>{report.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrigger(report.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(report.id, !report.enabled)}
                    >
                      {report.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(report)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Schedule:</span>
                    <br />
                    {getScheduleDisplay(report.type, report.schedule)}
                  </div>
                  <div>
                    <span className="font-medium">Content:</span>
                    <br />
                    {[
                      report.includeJobs && "Jobs",
                      report.includeRepositories && "Repositories",
                      report.includeAlerts && "Alerts",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div>
                    <span className="font-medium">Delivery:</span>
                    <br />
                    {[
                      report.delivery.email.enabled && "Email",
                      report.delivery.whatsapp.enabled && "WhatsApp",
                    ]
                      .filter(Boolean)
                      .join(", ") || "None"}
                  </div>
                </div>
                {(report.lastRun || report.nextRun) && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    {report.lastRun && (
                      <span className="mr-4">Last run: {new Date(report.lastRun).toLocaleString()}</span>
                    )}
                    {report.nextRun && (
                      <span>Next run: {new Date(report.nextRun).toLocaleString()}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default ScheduledReports