import * as React from "react"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, Download, FileText, Mail, MessageSquare, RefreshCw, Eye } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/services/api"
import { cn } from "@/lib/utils"

interface ReportData {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  format: 'html' | 'pdf' | 'csv'
  generatedAt: string
  size: string
  status: 'completed' | 'generating' | 'failed'
}

interface JobSummary {
  name: string
  status: 'Success' | 'Failed' | 'Warning' | 'Running'
  lastRun: string
  duration: string
  dataSize: string
}

interface RepositorySummary {
  name: string
  totalCapacity: number
  usedSpace: number
  freeSpace: number
  usagePercent: number
}

const Reports = () => {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [reports, setReports] = useState<ReportData[]>([])
  const [selectedReportType, setSelectedReportType] = useState<string>('daily')
  const [selectedFormat, setSelectedFormat] = useState<string>('html')
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    to: new Date()
  })
  const [jobSummary, setJobSummary] = useState<JobSummary[]>([])
  const [repositorySummary, setRepositorySummary] = useState<RepositorySummary[]>([])
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

  // Load real data from API
  useEffect(() => {
    const loadReportHistory = async () => {
      try {
        const result = await apiClient.getReportHistory()
        if (result.success && result.data) {
          setReports(result.data)
        } else {
          console.error('Failed to load report history:', result.error)
          setReports([])
          toast({
            title: "Error",
            description: "Failed to load report history",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error('Failed to load report history:', error)
        setReports([])
        toast({
          title: "Error",
          description: "Failed to load report history",
          variant: "destructive",
        })
      }
    }

    loadReportHistory()

    // Load job summary from API
    const loadJobSummary = async () => {
      try {
        const result = await apiClient.getJobs()
        if (result.success && result.data) {
          const jobSummary: JobSummary[] = result.data.map(job => ({
             name: job.name,
             status: job.lastResult === 'None' ? 'Warning' : job.lastResult as 'Success' | 'Failed' | 'Warning' | 'Running',
             lastRun: job.lastRun,
             duration: '45m 23s', // This would need to be calculated from job data
             dataSize: '2.5 GB' // This would need to come from job statistics
           }))
          setJobSummary(jobSummary)
        } else {
          console.error('Failed to load job summary:', result.error)
          setJobSummary([])
        }
      } catch (error) {
        console.error('Failed to load job summary:', error)
        setJobSummary([])
        toast({
          title: "Error",
          description: "Failed to load job summary",
          variant: "destructive",
        })
      }
    }

    // Load repository summary from API
    const loadRepositorySummary = async () => {
      try {
        const result = await apiClient.getRepositories()
        if (result.success && result.data) {
          const repoSummary: RepositorySummary[] = result.data.map(repo => ({
            name: repo.name,
            totalCapacity: repo.capacityGB,
            usedSpace: repo.usedSpaceGB,
            freeSpace: repo.freeGB,
            usagePercent: Math.round((repo.usedSpaceGB / repo.capacityGB) * 100)
          }))
          setRepositorySummary(repoSummary)
        } else {
          console.error('Failed to load repository summary:', result.error)
          setRepositorySummary([])
        }
      } catch (error) {
        console.error('Failed to load repository summary:', error)
        setRepositorySummary([])
        toast({
          title: "Error",
          description: "Failed to load repository summary",
          variant: "destructive",
        })
      }
    }

    loadJobSummary()
    loadRepositorySummary()
    // Fetch real dashboard stats
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await apiClient.getDashboardStats()
      if (response.success) {
        setDashboardStats(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    }
  }

  const handleGenerateReport = async () => {
    if (selectedReportType === 'custom' && (!dateRange.from || !dateRange.to)) {
      toast({
        title: "Error",
        description: "Please select a date range for custom reports",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    
    try {
      // Generate report name
      const reportName = `${selectedReportType.charAt(0).toUpperCase() + selectedReportType.slice(1)} Report - ${format(new Date(), 'yyyy-MM-dd')}`
      
      // Create new report using the generate endpoint
      const generateResult = await apiClient.generateNewReport({
        name: reportName,
        type: selectedReportType,
        format: selectedFormat,
        includeJobs: true,
        includeRepositories: true,
        includeAlerts: true,
      })

      if (generateResult.success && generateResult.data) {
        // Add the new report to the local state
        setReports(prev => [generateResult.data, ...prev])

        // Generate the actual report content for download/preview
        const startDate = selectedReportType === 'custom' && dateRange.from 
          ? dateRange.from.toISOString().split('T')[0]
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const endDate = selectedReportType === 'custom' && dateRange.to
          ? dateRange.to.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

        const contentResult = await apiClient.generateReport({
          type: 'detailed',
          format: selectedFormat as 'html' | 'pdf' | 'csv',
          startDate,
          endDate,
          includeJobs: true,
          includeRepositories: true,
          includeAlerts: true,
        })

        if (contentResult.success && contentResult.data) {
          // Handle different formats
          if (selectedFormat === 'csv') {
            // Create CSV blob and download
            const blob = new Blob([contentResult.data], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${reportName}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
          } else if (selectedFormat === 'pdf') {
            // Handle PDF download (assuming base64 response)
            const binaryString = atob(contentResult.data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${reportName}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
          } else {
            // HTML format - open in new window
            const newWindow = window.open('', '_blank')
            if (newWindow) {
              newWindow.document.write(contentResult.data)
              newWindow.document.close()
            }
          }
        }

        toast({
          title: "Success",
          description: `${selectedReportType.charAt(0).toUpperCase() + selectedReportType.slice(1)} report generated successfully`,
        })
      } else {
        throw new Error(generateResult.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadReport = async (report: ReportData) => {
    try {
      toast({
        title: "Download Started",
        description: `Downloading ${report.name}...`,
      })

      // Generate the report with the same parameters
      const result = await apiClient.generateReport({
        type: 'detailed',
        format: report.format as 'html' | 'pdf' | 'csv',
        startDate: new Date(report.generatedAt).toISOString().split('T')[0],
        endDate: new Date(report.generatedAt).toISOString().split('T')[0],
        includeJobs: true,
        includeRepositories: true,
        includeAlerts: true,
      })

      if (result.success && result.data) {
        // Create a blob from the response data
        let blob: Blob
        let filename: string
        
        if (report.format === 'csv') {
          blob = new Blob([result.data], { type: 'text/csv' })
          filename = `${report.name}.csv`
        } else if (report.format === 'pdf') {
          // Assuming the API returns base64 encoded PDF
          const binaryString = atob(result.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          blob = new Blob([bytes], { type: 'application/pdf' })
          filename = `${report.name}.pdf`
        } else {
          // HTML format
          blob = new Blob([result.data], { type: 'text/html' })
          filename = `${report.name}.html`
        }

        // Create download link and trigger download
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast({
          title: "Download Complete",
          description: `${report.name} has been downloaded successfully.`,
        })
      } else {
        throw new Error(result.error || 'Failed to generate report')
      }
    } catch (error: any) {
      console.error('Download failed:', error)
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download report. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEmailReport = async (report: ReportData) => {
    try {
      // For now, use a default email recipient - in a real app, this would come from settings
      const defaultRecipients = ['admin@company.com']; // This should be configurable
      
      toast({
        title: "Sending Email Report",
        description: `Sending ${report.name} via email...`,
      })

      const result = await apiClient.sendEmailReport({
        recipients: defaultRecipients,
        subject: `Veeam Report: ${report.name} - ${new Date(report.generatedAt).toLocaleDateString()}`,
        format: 'summary',
        reportType: report.type as 'daily' | 'weekly' | 'monthly',
        reportFormat: report.format as 'html' | 'pdf' | 'csv',
      })

      if (result.success) {
        toast({
          title: "Email Sent",
          description: `${report.name} has been sent via email successfully.`,
        })
      } else {
        throw new Error(result.error || 'Failed to send email report')
      }
    } catch (error: any) {
      console.error('Email send failed:', error)
      toast({
        title: "Email Send Failed",
        description: error.message || "Failed to send report via email. Please configure email settings first.",
        variant: "destructive",
      })
    }
  }

  const handleWhatsAppReport = async (report: ReportData) => {
    try {
      // First check if WhatsApp is configured
      const whatsappSettings = await apiClient.getWhatsAppSettings()
      
      if (!whatsappSettings.success || !whatsappSettings.data?.enabled) {
        toast({
          title: "WhatsApp Not Configured",
          description: "Please configure WhatsApp settings in the Settings page first.",
          variant: "destructive",
        })
        return
      }

      if (!whatsappSettings.data.defaultRecipients) {
        toast({
          title: "No Recipients",
          description: "Please add WhatsApp recipients in the Settings page first.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Sending WhatsApp Report",
        description: `Sending ${report.name} via WhatsApp...`,
      })

      // Send the report via WhatsApp
      const recipients = Array.isArray(whatsappSettings.data.defaultRecipients) 
        ? whatsappSettings.data.defaultRecipients 
        : whatsappSettings.data.defaultRecipients.split(',').map((r: string) => r.trim())
      const result = await apiClient.sendWhatsAppReport({
        recipients,
        format: 'summary',
        reportType: report.type as 'daily' | 'weekly' | 'monthly',
        useImageReport: false, // Default to text report for historical reports
      })

      if (result.success) {
        toast({
          title: "WhatsApp Sent",
          description: `${report.name} summary has been sent via WhatsApp successfully.`,
        })
      } else {
        throw new Error(result.error || 'Failed to send WhatsApp report')
      }
    } catch (error: any) {
      console.error('WhatsApp send failed:', error)
      toast({
        title: "WhatsApp Send Failed",
        description: error.message || "Failed to send report via WhatsApp. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePreviewReport = async () => {
    setIsGeneratingPreview(true)
    
    try {
      toast({
        title: "Generating Preview",
        description: "Creating report preview...",
      })

      const startDate = selectedReportType === 'custom' && dateRange.from 
        ? dateRange.from.toISOString().split('T')[0]
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const endDate = selectedReportType === 'custom' && dateRange.to
        ? dateRange.to.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]

      const result = await apiClient.previewReport({
        type: 'summary',
        startDate,
        endDate,
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
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case 'Failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'Warning':
        return <Badge variant="secondary" className="bg-yellow-500">Warning</Badge>
      case 'Running':
        return <Badge variant="outline">Running</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      case 'generating':
        return <Badge variant="secondary">Generating</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
              <p className="text-muted-foreground">
                Generate and manage backup reports
              </p>
            </div>
            <Button onClick={fetchDashboardStats} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          <Tabs defaultValue="generate" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate">Generate Report</TabsTrigger>
              <TabsTrigger value="history">Report History</TabsTrigger>
              <TabsTrigger value="preview">Live Preview</TabsTrigger>
            </TabsList>

            {/* Generate Report Tab */}
            <TabsContent value="generate" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generate New Report</CardTitle>
                  <CardDescription>
                    Create a new backup report with customizable parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-type">Report Type</Label>
                      <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily Summary</SelectItem>
                          <SelectItem value="weekly">Weekly Trend</SelectItem>
                          <SelectItem value="monthly">Monthly Capacity</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="format">Format</Label>
                      <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedReportType === 'custom' && (
                      <>
                        <div className="space-y-2">
                          <Label>From Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateRange.from && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={dateRange.from}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label>To Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateRange.to && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={dateRange.to}
                                onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handlePreviewReport} 
                    disabled={isGeneratingPreview}
                    variant="outline"
                    className="flex-1 min-w-[140px]"
                  >
                    {isGeneratingPreview ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Previewing...
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Preview Report
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleGenerateReport} 
                    disabled={isGenerating}
                    className="flex-1 min-w-[140px]"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Report History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Report History</CardTitle>
                  <CardDescription>
                    View and manage previously generated reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.name}</TableCell>
                          <TableCell className="capitalize">{report.type}</TableCell>
                          <TableCell className="uppercase">{report.format}</TableCell>
                          <TableCell>{format(new Date(report.generatedAt), "MMM dd, yyyy HH:mm")}</TableCell>
                          <TableCell>{report.size}</TableCell>
                          <TableCell>{getReportStatusBadge(report.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadReport(report)}
                                disabled={report.status !== 'completed'}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEmailReport(report)}
                                disabled={report.status !== 'completed'}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleWhatsAppReport(report)}
                                disabled={report.status !== 'completed'}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Live Preview Tab */}
            <TabsContent value="preview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Job Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Job Summary</CardTitle>
                    <CardDescription>Current backup job status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Data Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobSummary.map((job, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{job.name}</TableCell>
                            <TableCell>{getStatusBadge(job.status)}</TableCell>
                            <TableCell>{job.duration}</TableCell>
                            <TableCell>{job.dataSize}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Repository Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Repository Summary</CardTitle>
                    <CardDescription>Storage capacity overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {repositorySummary.map((repo, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{repo.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {repo.usagePercent}% used
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full transition-all",
                                repo.usagePercent > 90 ? "bg-red-500" :
                                repo.usagePercent > 80 ? "bg-yellow-500" : "bg-green-500"
                              )}
                              style={{ width: `${repo.usagePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Used: {repo.usedSpace} GB</span>
                            <span>Free: {repo.freeSpace} GB</span>
                            <span>Total: {repo.totalCapacity} GB</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dashboard Stats */}
              {dashboardStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>System Overview</CardTitle>
                    <CardDescription>Real-time dashboard statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{dashboardStats.totalJobs}</div>
                        <div className="text-sm text-muted-foreground">Total Jobs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{dashboardStats.successfulJobs}</div>
                        <div className="text-sm text-muted-foreground">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{dashboardStats.failedJobs}</div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{dashboardStats.totalRepositories}</div>
                        <div className="text-sm text-muted-foreground">Repositories</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
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

export default Reports