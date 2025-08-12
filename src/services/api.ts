import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface JobStatus {
  id: string;
  name: string;
  status: "Success" | "Failed" | "Warning" | "Running" | "Stopped";
  lastRun: string;
  duration: string;
  dataProcessed: string;
  nextRun: string;
}

interface Repository {
  id: string;
  name: string;
  type: "primary" | "secondary" | "archive";
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  status: "healthy" | "warning" | "critical";
}

interface ActivityItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  successfulJobs: number;
  failedJobs: number;
  warningJobs: number;
  totalRepositories: number;
  totalCapacityTB: number;
  usedCapacityTB: number;
  freeCapacityTB: number;
  capacityUsagePercent: number;
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load tokens from localStorage
    this.loadTokens();

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.accessToken && !config.url?.includes('/auth/')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshAccessToken();
            error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.axiosInstance.request(error.config);
          } catch (refreshError) {
            this.logout();
            // Let components handle authentication state through React Query
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private loadTokens(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  private saveTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('tokenExpiry', (Date.now() + tokens.expiresIn * 1000).toString());
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthTokens>> {
    try {
      const response: AxiosResponse<ApiResponse<AuthTokens>> = await this.axiosInstance.post(
        '/api/auth/login',
        credentials
      );
      
      if (response.data.success && response.data.data) {
        this.saveTokens(response.data.data);
      }
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response: AxiosResponse<ApiResponse<AuthTokens>> = await this.axiosInstance.post(
        '/api/auth/refresh',
        { refreshToken: this.refreshToken }
      );
      
      if (response.data.success && response.data.data) {
        this.saveTokens(response.data.data);
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  logout(): void {
    this.clearTokens();
  }

  isAuthenticated(): boolean {
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (!this.accessToken || !tokenExpiry) {
      return false;
    }
    return Date.now() < parseInt(tokenExpiry);
  }

  // Dashboard API methods
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const response: AxiosResponse<ApiResponse<DashboardStats>> = await this.axiosInstance.get(
        '/api/dashboard/stats'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch dashboard stats',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getJobs(): Promise<ApiResponse<JobStatus[]>> {
    try {
      const response: AxiosResponse<ApiResponse<JobStatus[]>> = await this.axiosInstance.get(
        '/api/veeam/jobs/states'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch jobs',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getRepositories(): Promise<ApiResponse<Repository[]>> {
    try {
      const response: AxiosResponse<ApiResponse<Repository[]>> = await this.axiosInstance.get(
        '/api/veeam/repositories/states'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch repositories',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getActivity(): Promise<ApiResponse<ActivityItem[]>> {
    try {
      const response: AxiosResponse<ApiResponse<ActivityItem[]>> = await this.axiosInstance.get(
        '/api/dashboard/activity'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch activity',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; uptime: number }>> {
    try {
      const response: AxiosResponse<ApiResponse<{ status: string; uptime: number }>> = await this.axiosInstance.get(
        '/health'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Health check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;

// Export types for use in components
export type {
  ApiResponse,
  LoginRequest,
  AuthTokens,
  JobStatus,
  Repository,
  ActivityItem,
  DashboardStats,
};