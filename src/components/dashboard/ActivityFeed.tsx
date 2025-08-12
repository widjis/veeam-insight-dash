import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertCircle, CheckCircle, Info, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/hooks/useApi";

interface ActivityItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
}



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
  const { data: activity, isLoading, error } = useActivity();

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading activity...</span>
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
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-destructive">
            <XCircle className="h-6 w-6" />
            <span className="ml-2">Failed to load activity data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activityData = activity?.data || [];

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
            {activityData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity found
              </div>
            ) : (
              activityData.map((item: ActivityItem) => {
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
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};