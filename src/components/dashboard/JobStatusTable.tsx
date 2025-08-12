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
import { Clock, CheckCircle, XCircle, AlertTriangle, Play } from "lucide-react";

interface JobStatus {
  id: string;
  name: string;
  status: "Success" | "Failed" | "Warning" | "Running" | "Stopped";
  lastRun: string;
  duration: string;
  dataProcessed: string;
  nextRun: string;
}

const mockJobs: JobStatus[] = [
  {
    id: "1",
    name: "SQL Server Backup",
    status: "Success",
    lastRun: "2024-01-12 02:30:15",
    duration: "45m 32s",
    dataProcessed: "2.3 TB",
    nextRun: "2024-01-13 02:30:00"
  },
  {
    id: "2", 
    name: "File Server Backup",
    status: "Running",
    lastRun: "2024-01-12 03:15:00",
    duration: "12m 15s",
    dataProcessed: "890 GB",
    nextRun: "2024-01-13 03:15:00"
  },
  {
    id: "3",
    name: "Exchange Backup", 
    status: "Failed",
    lastRun: "2024-01-12 01:45:30",
    duration: "8m 22s",
    dataProcessed: "0 B",
    nextRun: "2024-01-13 01:45:00"
  },
  {
    id: "4",
    name: "VM Infrastructure",
    status: "Warning",
    lastRun: "2024-01-12 04:00:00",
    duration: "1h 25m",
    dataProcessed: "4.7 TB",
    nextRun: "2024-01-13 04:00:00"
  }
];

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
            {mockJobs.map((job) => (
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};