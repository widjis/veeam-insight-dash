import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { JobStatusTable } from "@/components/dashboard/JobStatusTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RepositoryChart } from "@/components/dashboard/RepositoryChart";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  HardDrive, 
  Clock,
  Activity,
  Database,
  Server,
  Loader2
} from "lucide-react";
import { useDashboardStats, useRepositories } from "@/hooks/useApi";
import heroImage from "@/assets/veeam-hero.jpg";

const Index = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: dashboardStats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: repositories, isLoading: reposLoading } = useRepositories();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dashboard-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Calculate derived values
  const stats = dashboardStats?.data;
  const repositoriesData = repositories?.data || [];
  const totalRepositories = repositoriesData.length;
  const usedCapacityTB = stats?.usedCapacityTB || 0;
  const capacityUsagePercent = stats?.capacityUsagePercent || 0;

  // Determine storage status based on usage percentage
  const getStorageStatus = (usage: number) => {
    if (usage >= 90) return "error";
    if (usage >= 75) return "warning";
    return "success";
  };

  return (
    <div className="min-h-screen bg-dashboard-bg">
      <Header />
      
      {/* Hero Section */}
      <div className="relative bg-gradient-primary text-white overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Veeam Monitoring Dashboard" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Backup Infrastructure Overview</h1>
            <p className="text-primary-foreground/80">
              Real-time monitoring and management of your Veeam backup environment
            </p>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsLoading ? (
            // Loading state for all cards
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-card border rounded-lg p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-8 w-8 bg-muted rounded"></div>
                </div>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </div>
            ))
          ) : statsError ? (
            // Error state
            <div className="col-span-full flex items-center justify-center py-8 text-destructive">
              <XCircle className="h-6 w-6 mr-2" />
              <span>Failed to load dashboard statistics</span>
            </div>
          ) : (
            // Actual data
            <>
              <StatusCard
                title="Active Jobs"
                value={stats?.activeJobs?.toString() || "0"}
                icon={Activity}
                trend={{ value: 5, label: "+5%" }}
                status="success"
              />
              <StatusCard
                title="Successful Backups"
                value={stats?.successfulJobs?.toString() || "0"}
                icon={CheckCircle}
                trend={{ value: 2, label: "+2%" }}
                status="success"
              />
              <StatusCard
                title="Failed Jobs"
                value={stats?.failedJobs?.toString() || "0"}
                icon={XCircle}
                trend={{ value: 1, label: "+1" }}
                status={stats?.failedJobs && stats.failedJobs > 0 ? "error" : "success"}
              />
              <StatusCard
                title="Storage Used"
                value={`${usedCapacityTB.toFixed(1)} TB`}
                icon={HardDrive}
                trend={{ value: capacityUsagePercent, label: `${capacityUsagePercent.toFixed(1)}%` }}
                status={getStorageStatus(capacityUsagePercent)}
              />
            </>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Job Status Table - spans 2 columns */}
          <div className="lg:col-span-2">
            <JobStatusTable />
          </div>
          
          {/* Activity Feed */}
          <div>
            <ActivityFeed />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Repository Chart */}
          <RepositoryChart />
          
          {/* Infrastructure Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reposLoading ? (
              // Loading state for infrastructure cards
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-card border rounded-lg p-6 animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-8 w-8 bg-muted rounded"></div>
                  </div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                </div>
              ))
            ) : (
              <>
                <StatusCard
                  title="Total Jobs"
                  value={stats?.totalJobs?.toString() || "0"}
                  icon={Server}
                  status="info"
                />
                <StatusCard
                  title="Warning Jobs"
                  value={stats?.warningJobs?.toString() || "0"}
                  icon={AlertTriangle}
                  status={stats?.warningJobs && stats.warningJobs > 0 ? "warning" : "success"}
                />
                <StatusCard
                  title="Repositories"
                  value={totalRepositories.toString()}
                  icon={Database}
                  status="info"
                />
                <StatusCard
                  title="Capacity Usage"
                  value={`${capacityUsagePercent.toFixed(1)}%`}
                  icon={Activity}
                  status={getStorageStatus(capacityUsagePercent)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
