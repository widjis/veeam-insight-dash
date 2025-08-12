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
  Server
} from "lucide-react";
import heroImage from "@/assets/veeam-hero.jpg";

const Index = () => {
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
          <StatusCard
            title="Active Jobs"
            value="12"
            icon={Clock}
            status="info"
            trend={{ value: 8, label: "vs last week" }}
          />
          <StatusCard
            title="Successful Backups"
            value="9"
            icon={CheckCircle}
            status="success"
            trend={{ value: 12, label: "this week" }}
          />
          <StatusCard
            title="Failed Jobs"
            value="1"
            icon={XCircle}
            status="error"
            trend={{ value: -33, label: "vs last week" }}
          />
          <StatusCard
            title="Storage Used"
            value="67.2 TB"
            icon={HardDrive}
            status="warning"
            trend={{ value: 15, label: "this month" }}
          />
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
            <StatusCard
              title="Backup Servers"
              value="3"
              icon={Server}
              status="success"
            />
            <StatusCard
              title="Proxy Servers"
              value="5"
              icon={Database}
              status="success"
            />
            <StatusCard
              title="Repositories"
              value="8"
              icon={HardDrive}
              status="info"
            />
            <StatusCard
              title="License Usage"
              value="78%"
              icon={Activity}
              status="warning"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
