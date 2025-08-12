import { useState, useEffect, useCallback } from 'react';
import { webSocketService, Alert } from '@/services/websocket';
import { useToast } from '@/hooks/use-toast';

interface UseAlertsReturn {
  alerts: Alert[];
  unreadCount: number;
  isConnected: boolean;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  clearAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  subscribeToAlerts: () => void;
  unsubscribeFromAlerts: () => void;
}

export function useAlerts(): UseAlertsReturn {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  // Handle new alerts
  const handleNewAlert = useCallback((alert: Alert) => {
    setAlerts(prev => {
      // Check if alert already exists
      const exists = prev.some(a => a.id === alert.id);
      if (exists) {
        return prev.map(a => a.id === alert.id ? alert : a);
      }
      return [alert, ...prev];
    });

    // Show toast notification for new alerts
    const variant = alert.severity === 'high' || alert.severity === 'critical' ? 'destructive' : 'default';
    const duration = alert.severity === 'critical' ? 10000 : 5000;

    toast({
      title: alert.title,
      description: alert.message,
      variant,
      duration,
    });

    // Play sound for critical alerts if enabled
    if (alert.severity === 'critical') {
      const soundEnabled = localStorage.getItem('soundAlerts') === 'true';
      if (soundEnabled) {
        playAlertSound();
      }
    }
  }, [toast]);

  // Handle alert updates
  const handleAlertUpdate = useCallback((updatedAlert: Alert) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === updatedAlert.id ? updatedAlert : alert
      )
    );
  }, []);

  // Handle connection status
  const handleConnectionStatus = useCallback((status: string) => {
    setIsConnected(status === 'connected');
    
    if (status === 'connected') {
      console.log('WebSocket connected - subscribing to alerts');
      webSocketService.subscribe('alerts');
    } else if (status === 'disconnected' || status === 'error') {
      console.log('WebSocket disconnected');
    }
  }, []);

  // Subscribe to alerts
  const subscribeToAlerts = useCallback(() => {
    webSocketService.subscribe('alerts');
  }, []);

  // Unsubscribe from alerts
  const unsubscribeFromAlerts = useCallback(() => {
    webSocketService.unsubscribe('alerts');
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      // TODO: Call API to acknowledge alert
      // For now, just update locally
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() }
            : alert
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Resolve alert
  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      // TODO: Call API to resolve alert
      // For now, just update locally
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, resolved: true, resolvedAt: new Date().toISOString() }
            : alert
        )
      );
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve alert',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Clear alert from local state
  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Play alert sound
  const playAlertSound = useCallback(() => {
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Failed to play alert sound:', error);
    }
  }, []);

  // Calculate unread count
  const unreadCount = alerts.filter(alert => !alert.acknowledged && !alert.resolved).length;

  // Set up WebSocket event listeners
  useEffect(() => {
    webSocketService.on('alerts:new', handleNewAlert);
    webSocketService.on('alerts:update', handleAlertUpdate);
    webSocketService.on('connection:status', handleConnectionStatus);

    // Initial connection status
    setIsConnected(webSocketService.isConnected());

    // Subscribe to alerts if connected
    if (webSocketService.isConnected()) {
      webSocketService.subscribe('alerts');
    }

    return () => {
      webSocketService.off('alerts:new', handleNewAlert);
      webSocketService.off('alerts:update', handleAlertUpdate);
      webSocketService.off('connection:status', handleConnectionStatus);
      webSocketService.unsubscribe('alerts');
    };
  }, [handleNewAlert, handleAlertUpdate, handleConnectionStatus]);

  return {
    alerts,
    unreadCount,
    isConnected,
    acknowledgeAlert,
    resolveAlert,
    clearAlert,
    clearAllAlerts,
    subscribeToAlerts,
    unsubscribeFromAlerts,
  };
}

export default useAlerts;