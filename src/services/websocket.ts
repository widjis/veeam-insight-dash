import io, { Socket } from 'socket.io-client';

interface Alert {
  id: string;
  ruleId: string;
  type: 'error' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  metadata?: Record<string, any>;
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

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  uptime: number;
  timestamp: string;
}

type WebSocketEventHandlers = {
  'alerts:new': (alert: Alert) => void;
  'alerts:update': (alert: Alert) => void;
  'dashboard:stats': (stats: DashboardStats) => void;
  'dashboard:error': (error: string) => void;
  'jobs:update': (jobs: JobStatus[]) => void;
  'repositories:update': (repositories: Repository[]) => void;
  'system:metrics': (metrics: SystemMetrics) => void;
  'connection:status': (status: string) => void;
};

class WebSocketService {
  private socket: typeof Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor() {
    this.connect();
  }

  private connect(): void {
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;
    console.log('WebSocket connecting to:', wsUrl);
    
    this.socket = io(wsUrl, {
      transports: ['polling', 'websocket'],
      timeout: 60000,
      forceNew: false,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connection:status', 'connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.emit('connection:status', 'disconnected');
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emit('connection:status', 'error');
      this.handleReconnect();
    });

    // Set up event forwarding
    const events: (keyof WebSocketEventHandlers)[] = [
      'alerts:new',
      'alerts:update',
      'dashboard:stats',
      'dashboard:error',
      'jobs:update',
      'repositories:update',
      'system:metrics',
      'connection:status'
    ];

    events.forEach(event => {
      this.socket!.on(event, (data: any) => {
        this.emit(event, data);
      });
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('connection:status', 'failed');
    }
  }

  public subscribe(event: string): void {
    if (!this.socket) return;
    
    switch (event) {
      case 'alerts':
        this.socket.emit('alerts:subscribe');
        break;
      case 'dashboard':
        this.socket.emit('dashboard:subscribe');
        break;
      case 'jobs':
        this.socket.emit('jobs:subscribe');
        break;
      case 'repositories':
        this.socket.emit('repositories:subscribe');
        break;
    }
  }

  public unsubscribe(event: string): void {
    if (!this.socket) return;
    
    switch (event) {
      case 'alerts':
        this.socket.emit('alerts:unsubscribe');
        break;
      case 'dashboard':
        this.socket.emit('dashboard:unsubscribe');
        break;
      case 'jobs':
        this.socket.emit('jobs:unsubscribe');
        break;
      case 'repositories':
        this.socket.emit('repositories:unsubscribe');
        break;
    }
  }

  public on<K extends keyof WebSocketEventHandlers>(event: K, handler: WebSocketEventHandlers[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  public off<K extends keyof WebSocketEventHandlers>(event: K, handler: WebSocketEventHandlers[K]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
  }
}

// Create and export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;

// Export types
export type { Alert, DashboardStats, JobStatus, Repository, SystemMetrics, WebSocketEventHandlers };