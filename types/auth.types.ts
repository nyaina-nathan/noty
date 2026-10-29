export interface PublicUser {
  id: string;
  username: string;
  email: string;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface UpdateMeInput {
  username?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  user: PublicUser;
}

export interface RefreshResult {
  accessToken: string;
  /** `null` when the existing refresh token was kept (not yet due to rotate). */
  refreshToken: string | null;
}

export interface SessionMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}
