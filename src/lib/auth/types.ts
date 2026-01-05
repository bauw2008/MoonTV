/**
 * Vidora 认证框架类型定义
 */

export enum AuthLevel {
  PUBLIC = 'public',
  USER = 'user',
  ADMIN = 'admin',
  OWNER = 'owner',
}

export enum StorageType {
  LOCAL = 'local',
  REDIS = 'redis',
  UPSTASH = 'upstash',
  Kvrocks = 'kvrocks',
}

export interface Permission {
  resource: string;
  actions: PermissionAction[];
  conditions?: Record<string, any>;
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGE = 'manage',
  ADMIN = 'admin',
}

export interface AuthUser {
  username: string;
  role: UserRole;
  lastActivity: number;
  loginTime?: number;
  metadata?: Record<string, any>;
  permissions?: Array<{
    resource: string;
    actions: string[];
  }>;
  tags?: string[];
  permissionVersion?: number;
}

// 客户端认证状态
export interface ClientAuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  accessToken?: string;
  refreshToken?: string;
  lastActivity: number;
}

export interface AuthConfig {
  apiBaseUrl: string;
  tokenRefreshThreshold: number;
  sessionTimeout: number;
  autoRefresh: boolean;
  storageKey: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: AuthUser | null;
  tokens: TokenPair | null;
  error: string | null;
  pending?: boolean;
  message?: string;
}

// 认证结果类型
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  tokens?: TokenPair;
  metadata?: {
    timestamp: number;
    sessionId?: string;
  };
}

// 认证错误代码
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// 认证异常类
export class AuthException extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'AuthException';
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// JWT相关类型（从jsonwebtoken库导入）
export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}

export interface SignOptions {
  expiresIn?: string | number | undefined;
  issuer?: string | undefined;
  audience?: string | string[] | undefined;
  algorithm?: string | undefined;
}

export interface TokenPayload {
  sub?: string;
  username?: string;
  role: UserRole;
  permissions?: string[];
  iat?: number;
  exp?: number;
  type?: 'access' | 'refresh';
  sessionId?: string;
}

export type UserRole = 'owner' | 'admin' | 'user';

export interface TVBoxUser {
  username: string;
  role: UserRole;
  permissions: TVBoxPermissions;
  lastActivity: number;
}

export interface TVBoxPermissions {
  canAccessSources: boolean;
  canAccessAdmin: boolean;
  maxConnections: number;
}

export interface FrameworkStatus {
  initialized: boolean;
  timestamp: number;
}

export interface CacheEntry {
  user: AuthUser;
  expires: number;
  createdAt: number;
}

export interface CacheStats {
  total: number;
  valid: number;
  expired: number;
}

export interface SecurityCheck {
  allowed: boolean;
  reason?: string;
}

export interface RateLimitEntry {
  attempts: number;
  windowStart: number;
  lockedUntil: number | null;
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
}

export interface IAuthStorage {
  getType(): StorageType;
  setSession(sessionId: string, user: AuthUser, ttl?: number): Promise<void>;
  getSession(sessionId: string): Promise<AuthUser | null>;
  removeSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
}

export interface IPermissionService {
  hasPermission(
    user: AuthUser,
    resource: string,
    action: PermissionAction,
  ): boolean;
  getUserPermissions(user: AuthUser): Permission[];
  addUserPermission(user: AuthUser, permission: Permission): void;
  removeUserPermission(user: AuthUser, permission: Permission): void;
}

export interface ITokenService {
  generateAccessToken(user: AuthUser): Promise<string>;
  generateRefreshToken(user: AuthUser): Promise<string>;
  verifyAccessToken(token: string): Promise<AuthUser | null>;
  refreshAccessToken(token: string): Promise<string | null>;
  revokeToken(token: string): void;
}
