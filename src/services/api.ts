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
  type: string;
  lastResult: "Success" | "Failed" | "Warning" | "None";
  lastRun: string;
  nextRun?: string;
  isEnabled: boolean;
  status: "Running" | "Stopped" | "Idle";
  message?: string;
  progress?: number;
}

interface Repository {
  id: string;
  name: string;
  path: string;
  type: string;
  capacityGB: number;
  freeGB: number;
  usedSpaceGB: number;
  status: "Available" | "Unavailable" | "Maintenance";
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
      const response: AxiosResponse<ApiResponse<{ user: any; tokens: AuthTokens }>> = await this.axiosInstance.post(
        '/api/auth/login',
        credentials
      );
      
      if (response.data.success && response.data.data?.tokens) {
        this.saveTokens(response.data.data.tokens);
        return {
          success: true,
          data: response.data.data.tokens,
          timestamp: response.data.timestamp,
        };
      }
      
      return {
        success: false,
        error: response.data.error || 'Login failed',
        timestamp: response.data.timestamp,
      };
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
        '/api/veeam/jobs'
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
        '/api/veeam/repositories'
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

  async generateTestAlerts(): Promise<ApiResponse<{ message: string }>> {
    try {
      const response: AxiosResponse<ApiResponse<{ message: string }>> = await this.axiosInstance.post(
        '/api/dashboard/test-alerts'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to generate test alerts',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // WhatsApp API methods
  async getWhatsAppSettings(): Promise<ApiResponse<any>> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.get(
        '/api/settings/whatsapp'
      );
      
      // Transform defaultRecipients array to string for frontend form compatibility
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        if (Array.isArray(data.defaultRecipients)) {
          data.defaultRecipients = data.defaultRecipients.join(', ');
        }
      }
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch WhatsApp settings',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateWhatsAppSettings(settings: {
    apiUrl: string;
    apiToken: string;
    chatId: string;
    defaultRecipients: string;
    enabled: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      // Transform defaultRecipients string to array for backend validation
      const transformedSettings = {
        ...settings,
        defaultRecipients: settings.defaultRecipients 
          ? settings.defaultRecipients.split(',').map(r => r.trim()).filter(r => r.length > 0)
          : []
      };
      
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.put(
        '/api/settings/whatsapp',
        transformedSettings
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update WhatsApp settings',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testWhatsAppPersonal(data: { number: string; message: string }): Promise<ApiResponse<any>> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.post(
        '/api/settings/whatsapp/test-personal',
        data
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send WhatsApp personal message',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testWhatsAppGroup(data: { message: string }): Promise<ApiResponse<any>> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.post(
        '/api/settings/whatsapp/test-group',
        data
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send WhatsApp group message',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testWhatsAppConnection(): Promise<ApiResponse<any>> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.post(
        '/api/settings/whatsapp/test-connection'
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to test WhatsApp connection',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async sendWhatsAppReport(data: {
    recipients: string[];
    format: 'summary' | 'detailed';
    reportType?: 'daily' | 'weekly' | 'monthly';
  }): Promise<ApiResponse<any>> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.axiosInstance.post(
        '/api/settings/whatsapp/send-report',
        data
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to send WhatsApp report',
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