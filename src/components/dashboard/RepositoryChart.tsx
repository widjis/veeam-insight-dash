import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Server, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface Repository {
  id: string;
  name: string;
  type: "primary" | "secondary" | "archive";
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  status: "healthy" | "warning" | "critical";
}

const mockRepositories: Repository[] = [
  {
    id: "1",
    name: "Primary Storage",
    type: "primary",
    totalSpace: 10240, // GB
    usedSpace: 7168,
    freeSpace: 3072,
    status: "warning"
  },
  {
    id: "2", 
    name: "Archive Storage",
    type: "archive",
    totalSpace: 25600,
    usedSpace: 12800,
    freeSpace: 12800,
    status: "healthy"
  },
  {
    id: "3",
    name: "Cloud Repository",
    type: "secondary",
    totalSpace: 51200,
    usedSpace: 45568,
    freeSpace: 5632,
    status: "critical"
  }
];

const formatSize = (sizeInGB: number): string => {
  if (sizeInGB >= 1024) {
    return `${(sizeInGB / 1024).toFixed(1)} TB`;
  }
  return `${sizeInGB} GB`;
};

const getRepositoryIcon = (type: Repository["type"]) => {
  const iconMap = {
    primary: HardDrive,
    secondary: Server,
    archive: Database
  };
  return iconMap[type];
};

const getStatusColor = (status: Repository["status"], usagePercent: number) => {
  if (status === "critical" || usagePercent >= 90) return "bg-status-error";
  if (status === "warning" || usagePercent >= 80) return "bg-status-warning";
  return "bg-status-success";
};

export const RepositoryChart = () => {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          Storage Repositories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {mockRepositories.map((repo) => {
          const usagePercent = Math.round((repo.usedSpace / repo.totalSpace) * 100);
          const Icon = getRepositoryIcon(repo.type);
          
          return (
            <div key={repo.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{repo.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {repo.type} repository
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{usagePercent}% used</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSize(repo.freeSpace)} free
                  </div>
                </div>
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
        })}
      </CardContent>
    </Card>
  );
};