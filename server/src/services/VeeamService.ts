import axios, { AxiosInstance, AxiosResponse } from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { config } from '@/config/environment.js';
import {
  VeeamTokenResponse,
  VeeamJobState,
  VeeamRepositoryState,
  VeeamSession,
  VeeamInfrastructureServer,
  ApiResponse
} from '@/types/index.js';

interface TokenData {
  access_token: string;
  refresh_token: string;
  token_expiry: number;
}

export class VeeamService {
  private axiosInstance: AxiosInstance;
  private tokenData: TokenData | null = null;
  private tokenFilePath: string;

  constructor() {
    // Create axios instance with custom configuration
    this.axiosInstance = axios.create({
      baseURL: config.veeamBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': config.veeamApiVersion,
      },
      // Disable SSL verification if configured
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.veeamVerifySSL,
      }),
    });

    this.tokenFilePath = path.join(process.cwd(), 'tokens.json');
    this.loadTokens();

    // Add request interceptor to handle authentication
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (config.url?.includes('/oauth2/token')) {
          return config;
        }

        // Ensure we have a valid token
        await this.ensureValidToken();
        
        if (this.tokenData?.access_token) {
          config.headers.Authorization = `Bearer ${this.tokenData.access_token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshToken();
            error.config.headers.Authorization = `Bearer ${this.tokenData?.access_token}`;
            return this.axiosInstance.request(error.config);
          } catch (refreshError) {
            // If refresh fails, get new token
            await this.getAccessToken();
            error.config.headers.Authorization = `Bearer ${this.tokenData?.access_token}`;
            return this.axiosInstance.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = fs.readFileSync(this.tokenFilePath, 'utf8');
        this.tokenData = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load tokens:', error);
      this.tokenData = null;
    }
  }

  private saveTokens(): void {
    try {
      if (this.tokenData) {
        fs.writeFileSync(this.tokenFilePath, JSON.stringify(this.tokenData, null, 2));
      }
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  private deleteTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
      }
      this.tokenData = null;
    } catch (error) {
      console.error('Failed to delete tokens:', error);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenData?.token_expiry) {
      return true;
    }
    return Date.now() / 1000 > this.tokenData.token_expiry;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokenData || this.isTokenExpired()) {
      await this.getAccessToken();
    }
  }

  public async getAccessToken(): Promise<string> {
    try {
      const response: AxiosResponse<VeeamTokenResponse> = await this.axiosInstance.post(
        '/api/oauth2/token',
        new URLSearchParams({
          grant_type: 'password',
          username: config.veeamUsername,
          password: config.veeamPassword,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      this.tokenData = {
        access_token,
        refresh_token,
        token_expiry: Math.floor(Date.now() / 1000) + expires_in,
      };

      this.saveTokens();
      
      console.log(`Token obtained, expires at: ${new Date(this.tokenData.token_expiry * 1000).toISOString()}`);
      
      return access_token;
    } catch (error) {
      console.error('Failed to obtain access token:', error);
      throw new Error('Authentication failed');
    }
  }

  public async refreshToken(): Promise<string> {
    if (!this.tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      const response: AxiosResponse<VeeamTokenResponse> = await this.axiosInstance.post(
        '/api/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokenData.refresh_token,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      this.tokenData = {
        access_token,
        refresh_token,
        token_expiry: Math.floor(Date.now() / 1000) + expires_in,
      };

      this.saveTokens();
      
      return access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  // Job-related methods
  public async getJobStates(): Promise<ApiResponse<VeeamJobState[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/jobs/states');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get job states:', error);
      return {
        success: false,
        error: 'Failed to fetch job states',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getJobs(): Promise<ApiResponse<VeeamJobState[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/jobs');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get jobs:', error);
      return {
        success: false,
        error: 'Failed to fetch jobs',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getJobById(jobId: string): Promise<ApiResponse<VeeamJobState>> {
    try {
      const response = await this.axiosInstance.get(`/api/v1/jobs/${jobId}`);
      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      return {
        success: false,
        error: `Failed to fetch job ${jobId}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getJobSessions(jobId: string): Promise<ApiResponse<VeeamSession[]>> {
    try {
      const response = await this.axiosInstance.get(`/api/v1/jobs/${jobId}/sessions`);
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to get job sessions for ${jobId}:`, error);
      return {
        success: false,
        error: `Failed to fetch job sessions for ${jobId}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Repository-related methods
  public async getRepositoryStates(): Promise<ApiResponse<VeeamRepositoryState[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/backupInfrastructure/repositories/states');
      const repositories = response.data.data || [];
      
      // Calculate used space for each repository
      repositories.forEach((repo: VeeamRepositoryState) => {
        if (repo.capacityGB && repo.freeGB) {
          repo.usedSpaceGB = repo.capacityGB - repo.freeGB;
        }
      });
      
      return {
        success: true,
        data: repositories,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get repository states:', error);
      return {
        success: false,
        error: 'Failed to fetch repository states',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getRepositories(): Promise<ApiResponse<VeeamRepositoryState[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/backupInfrastructure/repositories');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get repositories:', error);
      return {
        success: false,
        error: 'Failed to fetch repositories',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Session-related methods
  public async getSessions(): Promise<ApiResponse<VeeamSession[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/sessions');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return {
        success: false,
        error: 'Failed to fetch sessions',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async getSessionStates(): Promise<ApiResponse<VeeamSession[]>> {
    try {
      // Use the regular sessions endpoint instead of states which causes GUID error
      const response = await this.axiosInstance.get('/api/v1/sessions');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get session states:', error);
      return {
        success: false,
        error: 'Failed to fetch session states',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Infrastructure-related methods
  public async getInfrastructureServers(): Promise<ApiResponse<VeeamInfrastructureServer[]>> {
    try {
      const response = await this.axiosInstance.get('/api/v1/infrastructure/servers');
      return {
        success: true,
        data: response.data.data || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get infrastructure servers:', error);
      return {
        success: false,
        error: 'Failed to fetch infrastructure servers',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const response = await this.axiosInstance.get('/api/v1/jobs/states');
      return response.status === 200;
    } catch (error) {
      console.error('Veeam health check failed:', error);
      return false;
    }
  }

  // Cleanup method
  public cleanup(): void {
    this.deleteTokens();
  }
}