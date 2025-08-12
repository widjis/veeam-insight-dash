import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  status?: "success" | "warning" | "error" | "info";
  className?: string;
}

export const StatusCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  status = "info",
  className 
}: StatusCardProps) => {
  const statusStyles = {
    success: "border-status-success/20 bg-gradient-to-br from-success/5 to-success/10",
    warning: "border-status-warning/20 bg-gradient-to-br from-warning/5 to-warning/10", 
    error: "border-status-error/20 bg-gradient-to-br from-destructive/5 to-destructive/10",
    info: "border-status-info/20 bg-gradient-to-br from-info/5 to-info/10"
  };

  const iconStyles = {
    success: "text-status-success bg-success/10",
    warning: "text-status-warning bg-warning/10",
    error: "text-status-error bg-destructive/10", 
    info: "text-status-info bg-info/10"
  };

  return (
    <Card className={cn(
      "border-2 transition-all duration-300 hover:shadow-medium",
      statusStyles[status],
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-lg",
          iconStyles[status]
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className={cn(
              "font-medium",
              trend.value > 0 ? "text-status-success" : "text-status-error"
            )}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>{" "}
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
};