import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, HardDrive, Cloud, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { useRepositories } from "@/hooks/useApi";

interface Repository {
  id: string;
  name: string;
  type: "primary" | "secondary" | "archive";
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  status: "healthy" | "warning" | "critical";
}



export const RepositoryChart = () => {
  const { data: repositories, isLoading, error } = useRepositories();

  const formatSize = (sizeInGB: number): string => {
    if (sizeInGB >= 1024) {
      return `${(sizeInGB / 1024).toFixed(1)} TB`;
    }
    return `${sizeInGB.toFixed(0)} GB`;
  };

  const getStatusColor = (status: Repository["status"]) => {
    switch (status) {
      case "healthy":
        return "bg-status-success text-white";
      case "warning":
        return "bg-status-warning text-white";
      case "critical":
        return "bg-status-error text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: Repository["type"]) => {
    switch (type) {
      case "primary":
        return Database;
      case "archive":
        return HardDrive;
      case "secondary":
        return Cloud;
      default:
        return Database;
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Storage Repositories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading repositories...</span>
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
            <Database className="h-5 w-5 text-primary" />
            Storage Repositories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-destructive">
            <XCircle className="h-6 w-6" />
            <span className="ml-2">Failed to load repository data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const repositoriesData = repositories?.data || [];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Storage Repositories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {repositoriesData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No storage repositories found
          </div>
        ) : (
          repositoriesData.map((repo: Repository) => {
            const usagePercent = (repo.usedSpace / repo.totalSpace) * 100;
            const TypeIcon = getTypeIcon(repo.type);
            
            return (
              <div key={repo.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{repo.name}</span>
                  </div>
                  <Badge className={getStatusColor(repo.status)}>
                    {repo.status === "critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {repo.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <Progress 
                    value={usagePercent} 
                    className="h-2"
                    aria-label={`${repo.name} storage usage`}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatSize(repo.usedSpace)} used</span>
                    <span>{formatSize(repo.totalSpace)} total</span>
                  </div>
                </div>
                
                <div className="pt-2 border-b last:border-b-0 border-border/50"></div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};