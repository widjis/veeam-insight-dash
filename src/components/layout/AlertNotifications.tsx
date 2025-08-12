import React from 'react';
import { Bell, X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlerts } from '@/hooks/useAlerts';
import { Alert } from '@/services/websocket';
import { cn } from '@/lib/utils';

interface AlertNotificationsProps {
  className?: string;
}

const AlertNotifications: React.FC<AlertNotificationsProps> = ({ className }) => {
  const {
    alerts,
    unreadCount,
    isConnected,
    acknowledgeAlert,
    resolveAlert,
    clearAlert,
    clearAllAlerts,
  } = useAlerts();

  const getAlertIcon = (alert: Alert) => {
    switch (alert.type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 border-red-200 text-red-800';
      case 'high':
        return 'bg-orange-100 border-orange-200 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 border-yellow-200 text-yellow-800';
      case 'low':
      default:
        return 'bg-blue-100 border-blue-200 text-blue-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const hasUnreadAlerts = unreadCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800",
            className
          )}
        >
          <Bell className={cn(
            "w-5 h-5",
            hasUnreadAlerts ? "text-red-500" : "text-gray-600 dark:text-gray-400"
          )} />
          {hasUnreadAlerts && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          {!isConnected && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 max-h-96">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel className="flex items-center gap-2 p-0">
            <Bell className="w-4 h-4" />
            Alerts
            {!isConnected && (
              <Badge variant="destructive" className="text-xs">
                Disconnected
              </Badge>
            )}
          </DropdownMenuLabel>
          {activeAlerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllAlerts}
              className="h-6 px-2 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {activeAlerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No active alerts
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            {activeAlerts.map((alert) => (
              <DropdownMenuItem
                key={alert.id}
                className="p-0 focus:bg-transparent"
                onSelect={(e) => e.preventDefault()}
              >
                <div className={cn(
                  "w-full p-3 border-l-4 border-transparent",
                  !alert.acknowledged && "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
                  alert.severity === 'critical' && "border-l-red-500 bg-red-50 dark:bg-red-950/20",
                  alert.severity === 'high' && "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20"
                )}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getAlertIcon(alert)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {alert.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {alert.message}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getSeverityColor(alert.severity))}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(alert.timestamp)}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {!alert.acknowledged && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                acknowledgeAlert(alert.id);
                              }}
                              className="h-6 px-2 text-xs hover:bg-blue-100 dark:hover:bg-blue-900"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Ack
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              resolveAlert(alert.id);
                            }}
                            className="h-6 px-2 text-xs hover:bg-green-100 dark:hover:bg-green-900"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAlert(alert.id);
                            }}
                            className="h-6 px-2 text-xs hover:bg-red-100 dark:hover:bg-red-900"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        {activeAlerts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  // TODO: Navigate to alerts page
                  console.log('Navigate to alerts page');
                }}
              >
                View All Alerts
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AlertNotifications;