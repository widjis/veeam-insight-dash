import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import {
  DashboardStats,
  Alert,
  VeeamJobState,
  VeeamRepositoryState,
  SystemMetrics
} from '@/types/index.js';

export interface WebSocketEvents {
  // Client to server events
  'dashboard:subscribe': () => void;
  'dashboard:unsubscribe': () => void;
  'alerts:subscribe': () => void;
  'alerts:unsubscribe': () => void;
  'jobs:subscribe': () => void;
  'jobs:unsubscribe': () => void;
  'repositories:subscribe': () => void;
  'repositories:unsubscribe': () => void;
  
  // Server to client events
  'dashboard:stats': (data: DashboardStats) => void;
  'dashboard:error': (error: string) => void;
  'alerts:new': (alert: Alert) => void;
  'alerts:update': (alert: Alert) => void;
  'jobs:update': (jobs: VeeamJobState[]) => void;
  'repositories:update': (repositories: VeeamRepositoryState[]) => void;
  'system:metrics': (metrics: SystemMetrics) => void;
  'connection:status': (status: 'connected' | 'disconnected' | 'error') => void;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Set<string> = new Set();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      this.connectedClients.add(clientId);
      
      logger.info(`Client connected: ${clientId}`);
      
      // Send connection status
      socket.emit('connection:status', 'connected');

      // Dashboard subscription handlers
      socket.on('dashboard:subscribe', () => {
        this.addSubscription('dashboard', clientId);
        logger.debug(`Client ${clientId} subscribed to dashboard updates`);
      });

      socket.on('dashboard:unsubscribe', () => {
        this.removeSubscription('dashboard', clientId);
        logger.debug(`Client ${clientId} unsubscribed from dashboard updates`);
      });

      // Alerts subscription handlers
      socket.on('alerts:subscribe', () => {
        this.addSubscription('alerts', clientId);
        logger.debug(`Client ${clientId} subscribed to alerts`);
      });

      socket.on('alerts:unsubscribe', () => {
        this.removeSubscription('alerts', clientId);
        logger.debug(`Client ${clientId} unsubscribed from alerts`);
      });

      // Jobs subscription handlers
      socket.on('jobs:subscribe', () => {
        this.addSubscription('jobs', clientId);
        logger.debug(`Client ${clientId} subscribed to job updates`);
      });

      socket.on('jobs:unsubscribe', () => {
        this.removeSubscription('jobs', clientId);
        logger.debug(`Client ${clientId} unsubscribed from job updates`);
      });

      // Repositories subscription handlers
      socket.on('repositories:subscribe', () => {
        this.addSubscription('repositories', clientId);
        logger.debug(`Client ${clientId} subscribed to repository updates`);
      });

      socket.on('repositories:unsubscribe', () => {
        this.removeSubscription('repositories', clientId);
        logger.debug(`Client ${clientId} unsubscribed from repository updates`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.connectedClients.delete(clientId);
        this.removeClientFromAllSubscriptions(clientId);
        logger.info(`Client disconnected: ${clientId}, reason: ${reason}`);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error(`Socket error for client ${clientId}:`, error);
        socket.emit('connection:status', 'error');
      });
    });

    this.io.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private addSubscription(channel: string, clientId: string): void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);
  }

  private removeSubscription(channel: string, clientId: string): void {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  private removeClientFromAllSubscriptions(clientId: string): void {
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  private getSubscribers(channel: string): string[] {
    const subscribers = this.subscriptions.get(channel);
    return subscribers ? Array.from(subscribers) : [];
  }

  // Public methods for broadcasting data
  public broadcastDashboardStats(stats: DashboardStats): void {
    const subscribers = this.getSubscribers('dashboard');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('dashboard:stats', stats);
      logger.debug(`Broadcasted dashboard stats to ${subscribers.length} clients`);
    }
  }

  public broadcastDashboardError(error: string): void {
    const subscribers = this.getSubscribers('dashboard');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('dashboard:error', error);
      logger.debug(`Broadcasted dashboard error to ${subscribers.length} clients`);
    }
  }

  public broadcastNewAlert(alert: Alert): void {
    const subscribers = this.getSubscribers('alerts');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('alerts:new', alert);
      logger.debug(`Broadcasted new alert to ${subscribers.length} clients`);
    }
  }

  public broadcastAlertUpdate(alert: Alert): void {
    const subscribers = this.getSubscribers('alerts');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('alerts:update', alert);
      logger.debug(`Broadcasted alert update to ${subscribers.length} clients`);
    }
  }

  public broadcastJobsUpdate(jobs: VeeamJobState[]): void {
    const subscribers = this.getSubscribers('jobs');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('jobs:update', jobs);
      logger.debug(`Broadcasted jobs update to ${subscribers.length} clients`);
    }
  }

  public broadcastRepositoriesUpdate(repositories: VeeamRepositoryState[]): void {
    const subscribers = this.getSubscribers('repositories');
    if (subscribers.length > 0) {
      this.io.to(subscribers).emit('repositories:update', repositories);
      logger.debug(`Broadcasted repositories update to ${subscribers.length} clients`);
    }
  }

  public broadcastSystemMetrics(metrics: SystemMetrics): void {
    // Broadcast to all connected clients
    this.io.emit('system:metrics', metrics);
    logger.debug(`Broadcasted system metrics to ${this.connectedClients.size} clients`);
  }

  // Utility methods
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  public getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      stats[channel] = subscribers.size;
    }
    return stats;
  }

  public isClientConnected(clientId: string): boolean {
    return this.connectedClients.has(clientId);
  }

  // Send message to specific client
  public sendToClient(clientId: string, event: string, data: any): void {
    if (this.isClientConnected(clientId)) {
      this.io.to(clientId).emit(event, data);
    }
  }

  // Broadcast to all connected clients
  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service...');
    
    // Notify all clients about shutdown
    this.io.emit('connection:status', 'disconnected');
    
    // Close all connections
    this.io.close();
    
    // Clear internal state
    this.connectedClients.clear();
    this.subscriptions.clear();
    
    logger.info('WebSocket service shutdown complete');
  }
}