import bcrypt from "bcrypt";
import { Prisma } from "@/prisma/generated/client";
import { ApiError, type ErrorDetail } from "@/lib/api/errors";
import {
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import type {
  AuthSession,
  AuthTokens,
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RefreshResult,
  RegisterInput,
  SessionMetadata,
  UpdateMeInput,
} from "@/types/auth.types";
import {
  validateChangePasswordInput,
  validateLoginInput,
  validateRegisterInput,
  validateUpdateMeInput,
} from "@/validators/auth.validators";

const BCRYPT_COST = 12;
const REFRESH_TOKEN_ROTATION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Used to keep login timing similar when the account does not exist.
const DUMMY_PASSWORD_HASH =
  "$2b$12$LbFP.AEZ0JE46.lQnMwj.uAIqqAsj9RgNnKo5pjvqLfevytn3vgX2";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  created_at: Date | null;
  updated_at: Date | null;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function buildConflict(
  existing: { username: string; email: string },
  input: { username?: string; email?: string },
): ApiError {
  const details: ErrorDetail[] = [];

  if (input.username !== undefined && existing.username === input.username) {
    details.push({ field: "username", message: "Username is already taken" });
  }

  if (input.email !== undefined && existing.email === input.email) {
    details.push({ field: "email", message: "Email is already registered" });
  }

  return new ApiError(
    "CONFLICT",
    "Username or email is already taken",
    details.length > 0 ? details : undefined,
  );
}

async function createSession(
  userId: string,
  metadata: SessionMetadata,
): Promise<AuthTokens> {
  const accessToken = await signAccessToken(userId);
  const refreshToken = generateRefreshToken();

  await prisma.refresh_tokens.create({
    data: {
      user_id: userId,
      token_hash: hashRefreshToken(refreshToken),
      expires_at: getRefreshTokenExpiry(),
      user_agent: metadata.userAgent,
      ip_address: metadata.ipAddress,
    },
  });

  return { accessToken, refreshToken };
}

async function authenticateUser(accessToken: string | undefined) {
  if (!accessToken) {
    throw ApiError.unauthorized();
  }

  const { userId } = await verifyAccessToken(accessToken);
  const user = await prisma.users.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.unauthorized();
  }

  return user;
}

export async function registerUser(
  body: unknown,
  metadata: SessionMetadata,
): Promise<AuthSession> {
  const input: RegisterInput = validateRegisterInput(body);

  const existing = await prisma.users.findFirst({
    where: {
      OR: [{ username: input.username }, { email: input.email }],
    },
    select: { username: true, email: true },
  });

  if (existing) {
    throw buildConflict(existing, input);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  let user;

  try {
    user = await prisma.users.create({
      data: {
        username: input.username,
        email: input.email,
        password_hash: passwordHash,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw buildConflict(
        { username: input.username, email: input.email },
        input,
      );
    }

    throw error;
  }

  const tokens = await createSession(user.id, metadata);

  return { user: toPublicUser(user), ...tokens };
}

export async function loginUser(
  body: unknown,
  metadata: SessionMetadata,
): Promise<AuthSession> {
  const input: LoginInput = validateLoginInput(body);

  const user = await prisma.users.findFirst({
    where: {
      OR: [
        { username: input.identifier },
        { email: input.identifier.toLowerCase() },
      ],
    },
  });

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
    throw ApiError.invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw ApiError.invalidCredentials();
  }

  const tokens = await createSession(user.id, metadata);

  return { user: toPublicUser(user), ...tokens };
}

export async function refreshSession(
  refreshToken: string | undefined,
  metadata: SessionMetadata,
): Promise<RefreshResult> {
  if (!refreshToken) {
    throw ApiError.unauthorized();
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const existing = await prisma.refresh_tokens.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      user_id: true,
      expires_at: true,
      revoked_at: true,
    },
  });

  if (!existing || existing.revoked_at !== null || existing.expires_at <= now) {
    throw ApiError.unauthorized();
  }

  const accessToken = await signAccessToken(existing.user_id);
  const isDueForRotation =
    existing.expires_at.getTime() - now.getTime() <
    REFRESH_TOKEN_ROTATION_WINDOW_MS;

  if (!isDueForRotation) {
    return { accessToken, refreshToken: null };
  }

  const rotatedRefreshToken = generateRefreshToken();

  await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.refresh_tokens.updateMany({
      where: { id: existing.id, revoked_at: null },
      data: { revoked_at: now },
    });

    if (revoked.count !== 1) {
      throw ApiError.unauthorized();
    }

    await transaction.refresh_tokens.create({
      data: {
        user_id: existing.user_id,
        token_hash: hashRefreshToken(rotatedRefreshToken),
        expires_at: getRefreshTokenExpiry(),
        user_agent: metadata.userAgent,
        ip_address: metadata.ipAddress,
      },
    });
  });

  return { accessToken, refreshToken: rotatedRefreshToken };
}

export async function logoutUser(
  refreshToken: string | undefined,
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.refresh_tokens.updateMany({
    where: {
      token_hash: hashRefreshToken(refreshToken),
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });
}

export async function getCurrentUser(
  accessToken: string | undefined,
): Promise<PublicUser> {
  const user = await authenticateUser(accessToken);

  return toPublicUser(user);
}

export async function updateCurrentUser(
  accessToken: string | undefined,
  body: unknown,
): Promise<PublicUser> {
  const input: UpdateMeInput = validateUpdateMeInput(body);
  const user = await authenticateUser(accessToken);

  const conflicts: Array<{ username: string } | { email: string }> = [];

  if (input.username !== undefined) {
    conflicts.push({ username: input.username });
  }

  if (input.email !== undefined) {
    conflicts.push({ email: input.email });
  }

  if (conflicts.length > 0) {
    const existing = await prisma.users.findFirst({
      where: {
        id: { not: user.id },
        OR: conflicts,
      },
      select: { username: true, email: true },
    });

    if (existing) {
      throw buildConflict(existing, input);
    }
  }

  try {
    const updated = await prisma.users.update({
      where: { id: user.id },
      data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        updated_at: new Date(),
      },
    });

    return toPublicUser(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError("CONFLICT", "Username or email is already taken");
    }

    throw error;
  }
}

export async function changePassword(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  body: unknown,
): Promise<void> {
  const input: ChangePasswordInput = validateChangePasswordInput(body);
  const user = await authenticateUser(accessToken);

  const passwordMatches = await bcrypt.compare(
    input.currentPassword,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw ApiError.invalidCredentials("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
  const currentTokenHash = refreshToken
    ? hashRefreshToken(refreshToken)
    : undefined;

  await prisma.$transaction([
    prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: passwordHash,
        updated_at: new Date(),
      },
    }),
    prisma.refresh_tokens.updateMany({
      where: {
        user_id: user.id,
        revoked_at: null,
        ...(currentTokenHash !== undefined
          ? { token_hash: { not: currentTokenHash } }
          : {}),
      },
      data: { revoked_at: new Date() },
    }),
  ]);
}
