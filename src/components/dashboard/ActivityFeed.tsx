import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
}

const mockActivity: ActivityItem[] = [
  {
    id: "1",
    type: "success", 
    title: "SQL Server Backup Completed",
    description: "Successfully backed up 2.3 TB in 45 minutes",
    timestamp: "2 minutes ago"
  },
  {
    id: "2",
    type: "error",
    title: "Exchange Backup Failed",
    description: "Connection timeout to Exchange server",
    timestamp: "15 minutes ago"
  },
  {
    id: "3",
    type: "warning",
    title: "Storage Repository Warning",
    description: "Repository 'Main Storage' is 85% full",
    timestamp: "1 hour ago"
  },
  {
    id: "4",
    type: "info",
    title: "Scheduled Maintenance",
    description: "Backup proxy server restart completed",
    timestamp: "2 hours ago"
  },
  {
    id: "5",
    type: "success",
    title: "File Server Backup Started",
    description: "Processing 890 GB of data",
    timestamp: "3 hours ago"
  }
];

const getActivityIcon = (type: ActivityItem["type"]) => {
  const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info
  };
  return iconMap[type];
};

const getActivityColor = (type: ActivityItem["type"]) => {
  const colorMap = {
    success: "text-status-success",
    error: "text-status-error", 
    warning: "text-status-warning",
    info: "text-status-info"
  };
  return colorMap[type];
};

export const ActivityFeed = () => {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {mockActivity.map((item) => {
              const Icon = getActivityIcon(item.type);
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={cn(
                    "p-1.5 rounded-full mt-0.5",
                    item.type === "success" && "bg-success/10",
                    item.type === "error" && "bg-destructive/10",
                    item.type === "warning" && "bg-warning/10", 
                    item.type === "info" && "bg-info/10"
                  )}>
                    <Icon className={cn("h-4 w-4", getActivityColor(item.type))} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {item.timestamp}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};