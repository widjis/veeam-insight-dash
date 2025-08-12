import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import { authMiddleware } from '@/middleware/auth.js';
import {
  User,
  AuthTokens,
  LoginRequest,
  RefreshTokenRequest,
  ApiResponse
} from '@/types/index.js';

const router = Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Mock user database (in production, this would be a real database)
const users: User[] = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@veeam.local',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'operator',
    email: 'operator@veeam.local',
    role: 'operator',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    username: 'viewer',
    email: 'viewer@veeam.local',
    role: 'viewer',
    createdAt: new Date().toISOString(),
  },
];

// Mock password storage (in production, these would be properly hashed)
const passwords: Record<string, string> = {
  admin: '$2b$10$rQZ8kHWKtGY5uFJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5u', // 'admin123'
  operator: '$2b$10$rQZ8kHWKtGY5uFJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5u', // 'operator123'
  viewer: '$2b$10$rQZ8kHWKtGY5uFJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5uJ5u', // 'viewer123'
};

// Helper functions
function generateTokens(user: User): AuthTokens {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const refreshPayload = {
    userId: user.id,
    type: 'refresh',
  };

  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
  const refreshToken = jwt.sign(refreshPayload, config.jwtRefreshSecret, { expiresIn: '7d' });

  return {
    accessToken,
    refreshToken,
    expiresIn: 86400, // 24 hours in seconds
  };
}

function findUserByUsername(username: string): User | undefined {
  return users.find(user => user.username === username);
}

function findUserById(id: string): User | undefined {
  return users.find(user => user.id === id);
}

async function verifyPassword(username: string, password: string): Promise<boolean> {
  // Simple admin/admin authentication for development
  const expectedPasswords: Record<string, string> = {
    admin: 'admin',
    operator: 'operator123',
    viewer: 'viewer123',
  };
  
  return password === expectedPasswords[username];
}

// Routes

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return tokens
 * @access Public
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;

    // Validate input
    if (!username || !password) {
      const response: ApiResponse = {
        success: false,
        error: 'Username and password are required',
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    // Find user
    const user = findUserByUsername(username);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString(),
      };
      return res.status(401).json(response);
    }

    // Verify password
    const isValidPassword = await verifyPassword(username, password);
    if (!isValidPassword) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString(),
      };
      return res.status(401).json(response);
    }

    // Generate tokens
    const tokens = generateTokens(user);

    // Update last login
    user.lastLogin = new Date().toISOString();

    logger.info(`User logged in: ${username}`);

    const response: ApiResponse<{ user: Omit<User, 'id'>; tokens: AuthTokens }> = {
      success: true,
      data: {
        user: {
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
        tokens,
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Login error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken }: RefreshTokenRequest = req.body;

    if (!refreshToken) {
      const response: ApiResponse = {
        success: false,
        error: 'Refresh token is required',
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(response);
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid refresh token',
        timestamp: new Date().toISOString(),
      };
      return res.status(401).json(response);
    }

    // Find user
    const user = findUserById(decoded.userId);
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString(),
      };
      return res.status(401).json(response);
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    logger.info(`Token refreshed for user: ${user.username}`);

    const response: ApiResponse<AuthTokens> = {
      success: true,
      data: tokens,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Token refresh error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user (invalidate tokens)
 * @access Private
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // In a real implementation, you would add the token to a blacklist
    // For now, we'll just return success
    
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Logout error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user information
 * @access Private
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    // The user should be attached to req by the auth middleware
    const user = (req as any).user;
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not authenticated',
        timestamp: new Date().toISOString(),
      };
      return res.status(401).json(response);
    }

    const response: ApiResponse<Omit<User, 'id'>> = {
      success: true,
      data: {
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Get user info error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

/**
 * @route GET /api/auth/users
 * @desc Get all users (admin only)
 * @access Private (Admin)
 */
router.get('/users', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    
    if (!currentUser || currentUser.role !== 'admin') {
      const response: ApiResponse = {
        success: false,
        error: 'Access denied. Admin role required.',
        timestamp: new Date().toISOString(),
      };
      return res.status(403).json(response);
    }

    const usersWithoutIds = users.map(user => ({
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));

    const response: ApiResponse<Omit<User, 'id'>[]> = {
      success: true,
      data: usersWithoutIds,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    logger.error('Get users error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    return res.status(500).json(response);
  }
});

export default router;