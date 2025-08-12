import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment.js';
import { logger } from '@/utils/logger.js';
import { createError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role?: string;
  };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Access token is required', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw createError('Access token is required', 401);
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      req.user = {
        id: decoded.id || decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
      
      logger.debug(`User authenticated: ${req.user.username}`);
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token:', jwtError);
      throw createError('Invalid or expired token', 401);
    }
  } catch (error) {
    next(error);
  }
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      
      req.user = {
        id: decoded.id || decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
      
      logger.debug(`User optionally authenticated: ${req.user.username}`);
    } catch (jwtError) {
      logger.debug('Optional auth failed, continuing without authentication');
    }
    
    next();
  } catch (error) {
    next();
  }
};

export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    
    if (req.user.role !== requiredRole) {
      return next(createError('Insufficient permissions', 403));
    }
    
    next();
  };
};