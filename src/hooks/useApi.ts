import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type ApiResponse, type LoginRequest, type AuthTokens } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

// Query keys for React Query
export const queryKeys = {
  dashboardStats: ['dashboard', 'stats'] as const,
  jobs: ['jobs'] as const,
  repositories: ['repositories'] as const,
  activity: ['activity'] as const,
  health: ['health'] as const,
};

// Dashboard stats hook
export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiClient.getDashboardStats(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
};

// Jobs hook
export const useJobs = () => {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => apiClient.getJobs(),
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

// Repositories hook
export const useRepositories = () => {
  return useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => apiClient.getRepositories(),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

// Activity hook
export const useActivity = () => {
  return useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => apiClient.getActivity(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
};

// Health check hook
export const useHealth = () => {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

// Login mutation hook
export const useLogin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiClient.login(credentials),
    onSuccess: (data: ApiResponse<AuthTokens>) => {
      if (data.success) {
        toast({
          title: 'Login Successful',
          description: 'Welcome to Veeam Insight Dashboard',
        });
        // Invalidate all queries to refetch with new auth
        queryClient.invalidateQueries();
      } else {
        toast({
          title: 'Login Failed',
          description: data.error || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Login Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });
};

// Logout hook
export const useLogout = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return () => {
    apiClient.logout();
    queryClient.clear(); // Clear all cached data
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out',
    });
  };
};

// Authentication status hook
export const useAuth = () => {
  return {
    isAuthenticated: apiClient.isAuthenticated(),
    logout: useLogout(),
  };
};

// Refresh all data hook
export const useRefreshData = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return () => {
    queryClient.invalidateQueries();
    toast({
      title: 'Data Refreshed',
      description: 'All dashboard data has been refreshed',
    });
  };
};