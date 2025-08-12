import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Clock, CheckCircle, XCircle, AlertTriangle, Play, Loader2 } from "lucide-react";
import { useJobs } from "@/hooks/useApi";

interface JobStatus {
  id: string;
  name: string;
  status: "Success" | "Failed" | "Warning" | "Running" | "Stopped";
  lastRun: string;
  duration: string;
  dataProcessed: string;
  nextRun: string;
}



const getStatusBadge = (status: JobStatus["status"]) => {
  const variants = {
    Success: { variant: "default" as const, icon: CheckCircle, className: "bg-status-success text-white" },
    Failed: { variant: "destructive" as const, icon: XCircle, className: "bg-status-error text-white" },
    Warning: { variant: "default" as const, icon: AlertTriangle, className: "bg-status-warning text-white" },
    Running: { variant: "default" as const, icon: Play, className: "bg-status-info text-white animate-pulse" },
    Stopped: { variant: "secondary" as const, icon: Clock, className: "bg-muted text-muted-foreground" }
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
    </Badge>
  );
};

export const JobStatusTable = () => {
  const { data: jobs, isLoading, error } = useJobs();

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Backup Jobs Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading jobs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Backup Jobs Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-destructive">
            <XCircle className="h-6 w-6" />
            <span className="ml-2">Failed to load jobs data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const jobsData = jobs?.data || [];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Backup Jobs Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Data Processed</TableHead>
              <TableHead>Next Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobsData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No backup jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobsData.map((job: JobStatus) => (
                <TableRow key={job.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.lastRun}
                  </TableCell>
                  <TableCell className="text-sm">{job.duration}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {job.dataProcessed}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.nextRun}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};