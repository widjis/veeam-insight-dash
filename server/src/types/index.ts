// Veeam API Types
export interface VeeamTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface VeeamJobState {
  id: string;
  name: string;
  type: string;
  lastResult: 'Success' | 'Warning' | 'Failed' | 'None';
  lastRun: string;
  nextRun?: string;
  isEnabled: boolean;
  message?: string;
  progress?: number;
  status: 'Running' | 'Stopped' | 'Idle';
}

export interface VeeamRepositoryState {
  id: string;
  name: string;
  path: string;
  type: string;
  capacityGB: number;
  freeGB: number;
  usedSpaceGB: number;
  status: 'Available' | 'Unavailable' | 'Maintenance';
}

export interface VeeamSession {
  id: string;
  jobId: string;
  jobName: string;
  type: string;
  state: 'Running' | 'Stopped' | 'Failed' | 'Success' | 'Warning';
  result: 'Success' | 'Warning' | 'Failed' | 'None';
  creationTime: string;
  endTime?: string;
  progress?: {
    percent: number;
    processedObjects: number;
    totalObjects: number;
    transferredSize: number;
    totalSize: number;
  };
}

export interface VeeamInfrastructureServer {
  id: string;
  name: string;
  type: 'BackupServer' | 'ProxyServer' | 'RepositoryServer';
  status: 'Online' | 'Offline' | 'Warning';
  version?: string;
  description?: string;
}

// Dashboard Types
export interface DashboardStats {
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

export interface AlertRule {
  id: string;
  name: string;
  type: 'job_failure' | 'storage_threshold' | 'infrastructure_down' | 'long_running_job' | 'error' | 'warning';
  enabled: boolean;
  conditions: {
    threshold?: number;
    duration?: number;
    jobIds?: string[];
    repositoryIds?: string[];
  };
  actions: {
    email?: boolean;
    whatsapp?: boolean;
    webhook?: string;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  type: AlertRule['type'];
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Authentication Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'job_update' | 'repository_update' | 'alert' | 'system_status';
  data: any;
  timestamp: string;
}

export interface WebSocketClient {
  id: string;
  userId?: string;
  subscriptions: string[];
  lastPing: number;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Error Types
export interface ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: any;
}

// Monitoring Types
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

// Configuration Types
export interface VeeamConfig {
  baseUrl: string;
  username: string;
  password: string;
  apiVersion: string;
  verifySSL: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface MonitoringConfig {
  interval: number;
  alertCheckInterval: number;
  healthCheckInterval: number;
  metricsRetentionDays: number;
}

export interface Config {
  // Server
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  
  // Veeam API
  veeam: VeeamConfig;
  
  // Authentication
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  refreshTokenExpiresIn: string;
}

// Utility Types
export type JobStatus = VeeamJobState['lastResult'];
export type JobState = VeeamJobState['status'];
export type RepositoryStatus = VeeamRepositoryState['status'];
export type SessionState = VeeamSession['state'];
export type AlertSeverity = Alert['severity'];
export type UserRole = User['role'];