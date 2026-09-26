import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';

/**
 * User type for request context
 * This represents the authenticated user attached to the request
 */
export interface User {
  id: string;
  supabaseId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  subscriptionTier: string; // 'free' | 'premium'
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/**
 * JWT payload from Supabase
 */
export interface SupabaseJwtPayload {
  sub: string;        // User ID
  email: string;
  role?: string;
  aud: string;
  exp: number;
  iat: number;
  iss?: string;
  phone?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/**
 * Request with authenticated user
 */
export interface RequestWithUser extends Request {
  user: User;
}