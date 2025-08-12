import {
  ApiResponse,
  VeeamJobState,
  VeeamRepositoryState,
  VeeamSession,
  VeeamInfrastructureServer
} from '@/types/index.js';

export class MockVeeamService {
  private mockJobs: VeeamJobState[] = [
    {
      id: '1',
      name: 'Daily VM Backup',
      type: 'Backup',
      lastResult: 'Success',
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isEnabled: true,
      status: 'Idle'
    },
    {
      id: '2',
      name: 'Weekly Archive',
      type: 'Backup',
      lastResult: 'Warning',
      lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isEnabled: true,
      status: 'Idle',
      message: 'Some files were skipped'
    },
    {
      id: '3',
      name: 'Critical System Backup',
      type: 'Backup',
      lastResult: 'Failed',
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      isEnabled: true,
      status: 'Idle',
      message: 'Network timeout error'
    }
  ];

  private mockRepositories: VeeamRepositoryState[] = [
    {
      id: 'repo1',
      name: 'Primary Backup Repository',
      path: '/backup/primary',
      type: 'NTFS',
      capacityGB: 50000,
      freeGB: 20000,
      usedSpaceGB: 30000,
      status: 'Available'
    },
    {
      id: 'repo2',
      name: 'Archive Repository',
      path: '/backup/archive',
      type: 'NTFS',
      capacityGB: 60000,
      freeGB: 25000,
      usedSpaceGB: 35000,
      status: 'Available'
    }
  ];

  private mockSessions: VeeamSession[] = [
    {
      id: 'session1',
      jobId: '1',
      jobName: 'Daily VM Backup',
      type: 'Backup',
      state: 'Stopped',
      result: 'Success',
      creationTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      progress: {
        percent: 100,
        processedObjects: 50,
        totalObjects: 50,
        transferredSize: 1024 * 1024 * 1024 * 10, // 10GB
        totalSize: 1024 * 1024 * 1024 * 10
      }
    },
    {
      id: 'session2',
      jobId: '2',
      jobName: 'Weekly Archive',
      type: 'Backup',
      state: 'Running',
      result: 'None',
      creationTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      progress: {
        percent: 65,
        processedObjects: 32,
        totalObjects: 50,
        transferredSize: 1024 * 1024 * 1024 * 6.5, // 6.5GB
        totalSize: 1024 * 1024 * 1024 * 10
      }
    }
  ];

  private mockInfrastructure: VeeamInfrastructureServer[] = [
    {
      id: 'server1',
      name: 'Veeam Backup Server',
      type: 'BackupServer',
      status: 'Online',
      version: '12.0.0.1420',
      description: 'Primary backup server'
    },
    {
      id: 'proxy1',
      name: 'Backup Proxy 1',
      type: 'ProxyServer',
      status: 'Online',
      version: '12.0.0.1420',
      description: 'VM backup proxy'
    }
  ];

  public async getAccessToken(): Promise<string> {
    // Mock token
    return 'mock-access-token';
  }

  public async refreshToken(): Promise<string> {
    // Mock refresh
    return 'mock-refreshed-token';
  }

  public async getJobStates(): Promise<ApiResponse<VeeamJobState[]>> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: this.mockJobs,
      timestamp: new Date().toISOString(),
    };
  }

  public async getJobs(): Promise<ApiResponse<VeeamJobState[]>> {
    return this.getJobStates();
  }

  public async getJobById(jobId: string): Promise<ApiResponse<VeeamJobState>> {
    const job = this.mockJobs.find(j => j.id === jobId);
    
    if (!job) {
      return {
        success: false,
        error: `Job with ID ${jobId} not found`,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };
  }

  public async getJobSessions(jobId: string): Promise<ApiResponse<VeeamSession[]>> {
    const sessions = this.mockSessions.filter(s => s.jobId === jobId);
    
    return {
      success: true,
      data: sessions,
      timestamp: new Date().toISOString(),
    };
  }

  public async getRepositoryStates(): Promise<ApiResponse<VeeamRepositoryState[]>> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: this.mockRepositories,
      timestamp: new Date().toISOString(),
    };
  }

  public async getRepositories(): Promise<ApiResponse<VeeamRepositoryState[]>> {
    return this.getRepositoryStates();
  }

  public async getSessions(): Promise<ApiResponse<VeeamSession[]>> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: this.mockSessions,
      timestamp: new Date().toISOString(),
    };
  }

  public async getSessionStates(): Promise<ApiResponse<VeeamSession[]>> {
    return this.getSessions();
  }

  public async getInfrastructureServers(): Promise<ApiResponse<VeeamInfrastructureServer[]>> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: this.mockInfrastructure,
      timestamp: new Date().toISOString(),
    };
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }

  public cleanup(): void {
    // No cleanup needed for mock service
  }
}