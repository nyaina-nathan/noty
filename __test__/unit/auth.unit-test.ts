import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/prisma/generated/client";
import { ApiError } from "@/lib/api/errors";
import type { SessionMetadata } from "@/types/auth.types";

const mocks = vi.hoisted(() => {
  const prisma = {
    users: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refresh_tokens: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prisma,
    bcrypt: {
      hash: vi.fn(),
      compare: vi.fn(),
    },
    jwt: {
      signAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      getRefreshTokenExpiry: vi.fn(),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("bcrypt", () => ({ default: mocks.bcrypt }));

vi.mock("@/lib/jwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jwt")>();

  return {
    ...actual,
    signAccessToken: mocks.jwt.signAccessToken,
    verifyAccessToken: mocks.jwt.verifyAccessToken,
    generateRefreshToken: mocks.jwt.generateRefreshToken,
    getRefreshTokenExpiry: mocks.jwt.getRefreshTokenExpiry,
  };
});

import { hashRefreshToken } from "@/lib/jwt";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  updateCurrentUser,
} from "@/services/auth.services";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-01-01T00:00:00.000Z");
const REFRESH_TOKEN_EXPIRY = new Date("2026-01-31T00:00:00.000Z");

const metadata: SessionMetadata = {
  userAgent: "vitest-agent",
  ipAddress: "203.0.113.7",
};

const currentUser = {
  id: USER_ID,
  username: "alice",
  email: "alice@example.com",
  password_hash: "stored-password-hash",
  created_at: new Date("2025-12-01T00:00:00.000Z"),
  updated_at: null,
};

const publicUser = {
  id: currentUser.id,
  username: currentUser.username,
  email: currentUser.email,
  created_at: currentUser.created_at,
  updated_at: currentUser.updated_at,
};

const validRegistration = {
  username: " Alice ",
  email: " Alice@Example.com ",
  password: "supersecret",
};

async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => {
      throw new Error("Expected the service call to reject");
    },
    (cause: unknown) => cause,
  );

  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

function expectSessionPersisted() {
  expect(mocks.jwt.signAccessToken).toHaveBeenCalledWith(USER_ID);
  expect(mocks.jwt.generateRefreshToken).toHaveBeenCalledTimes(1);
  expect(mocks.prisma.refresh_tokens.create).toHaveBeenCalledWith({
    data: {
      user_id: USER_ID,
      token_hash: hashRefreshToken("refresh-token"),
      expires_at: REFRESH_TOKEN_EXPIRY,
      user_agent: metadata.userAgent,
      ip_address: metadata.ipAddress,
    },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  mocks.bcrypt.hash.mockResolvedValue("new-password-hash");
  mocks.bcrypt.compare.mockResolvedValue(true);

  mocks.jwt.signAccessToken.mockResolvedValue("access-token");
  mocks.jwt.verifyAccessToken.mockResolvedValue({ userId: USER_ID });
  mocks.jwt.generateRefreshToken.mockReturnValue("refresh-token");
  mocks.jwt.getRefreshTokenExpiry.mockReturnValue(REFRESH_TOKEN_EXPIRY);

  mocks.prisma.$transaction.mockImplementation(
    async (operation: unknown) => {
      if (typeof operation === "function") {
        return operation(mocks.prisma);
      }

      return Promise.all(operation as Promise<unknown>[]);
    },
  );

  mocks.prisma.users.findFirst.mockResolvedValue(null);
  mocks.prisma.users.findUnique.mockResolvedValue(null);
  mocks.prisma.users.create.mockResolvedValue(currentUser);
  mocks.prisma.users.update.mockResolvedValue(currentUser);
  mocks.prisma.refresh_tokens.create.mockResolvedValue({ id: "token-1" });
  mocks.prisma.refresh_tokens.findUnique.mockResolvedValue(null);
  mocks.prisma.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registerUser", () => {
  it("registers a new user and creates a session", async () => {
    const result = await registerUser(validRegistration, metadata);

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ username: "Alice" }, { email: "alice@example.com" }],
      },
      select: { username: true, email: true },
    });
    expect(mocks.bcrypt.hash).toHaveBeenCalledWith("supersecret", 12);
    expect(mocks.prisma.users.create).toHaveBeenCalledWith({
      data: {
        username: "Alice",
        email: "alice@example.com",
        password_hash: "new-password-hash",
      },
    });
    expectSessionPersisted();
    expect(result).toEqual({
      user: publicUser,
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(result.user).not.toHaveProperty("password_hash");
  });

  it("rejects when the username is already taken", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue({
      username: "Alice",
      email: "someone-else@example.com",
    });

    const error = await captureApiError(
      registerUser(
        { username: "Alice", email: "new@example.com", password: "supersecret" },
        metadata,
      ),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.status).toBe(409);
    expect(error.details).toEqual([
      { field: "username", message: "Username is already taken" },
    ]);
    expect(mocks.bcrypt.hash).not.toHaveBeenCalled();
    expect(mocks.prisma.users.create).not.toHaveBeenCalled();
  });

  it("rejects when the email is already registered", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue({
      username: "someone-else",
      email: "alice@example.com",
    });

    const error = await captureApiError(
      registerUser(
        { username: "Alice", email: "Alice@Example.com", password: "supersecret" },
        metadata,
      ),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.details).toEqual([
      { field: "email", message: "Email is already registered" },
    ]);
    expect(mocks.prisma.users.create).not.toHaveBeenCalled();
  });

  it("reports both conflicting fields", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue({
      username: "Alice",
      email: "alice@example.com",
    });

    const error = await captureApiError(registerUser(validRegistration, metadata));

    expect(error.code).toBe("CONFLICT");
    expect(error.details).toEqual([
      { field: "username", message: "Username is already taken" },
      { field: "email", message: "Email is already registered" },
    ]);
  });

  it("maps a unique constraint error on create to a conflict", async () => {
    mocks.prisma.users.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const error = await captureApiError(registerUser(validRegistration, metadata));

    expect(error.code).toBe("CONFLICT");
    expect(error.details).toEqual([
      { field: "username", message: "Username is already taken" },
      { field: "email", message: "Email is already registered" },
    ]);
    expect(mocks.prisma.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it("rethrows unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.users.create.mockRejectedValue(databaseError);

    await expect(registerUser(validRegistration, metadata)).rejects.toBe(
      databaseError,
    );
  });

  it("rejects invalid input before querying the database", async () => {
    const error = await captureApiError(
      registerUser({ username: "", email: "not-an-email", password: "short" }, metadata),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(422);
    expect(error.details).toEqual(
      expect.arrayContaining([
        { field: "username", message: "Must not be empty" },
        { field: "email", message: "Must be a valid email address" },
        { field: "password", message: "Must be at least 8 characters" },
      ]),
    );
    expect(mocks.prisma.users.findFirst).not.toHaveBeenCalled();
  });
});

describe("loginUser", () => {
  it("logs in a user by username and creates a session", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue(currentUser);

    const result = await loginUser(
      { identifier: " Alice ", password: "supersecret" },
      metadata,
    );

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ username: "Alice" }, { email: "alice" }],
      },
    });
    expect(mocks.bcrypt.compare).toHaveBeenCalledWith(
      "supersecret",
      currentUser.password_hash,
    );
    expectSessionPersisted();
    expect(result).toEqual({
      user: publicUser,
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("logs in a user by email and lowercases the identifier", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue(currentUser);

    await loginUser(
      { identifier: " Alice@Example.COM ", password: "supersecret" },
      metadata,
    );

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { username: "Alice@Example.COM" },
          { email: "alice@example.com" },
        ],
      },
    });
  });

  it("performs a dummy compare and rejects unknown users", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue(null);

    const error = await captureApiError(
      loginUser({ identifier: "ghost", password: "supersecret" }, metadata),
    );

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.status).toBe(401);
    expect(mocks.bcrypt.compare).toHaveBeenCalledWith(
      "supersecret",
      expect.stringMatching(/^\$2b\$12\$/),
    );
    expect(mocks.prisma.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it("rejects a wrong password without creating a session", async () => {
    mocks.prisma.users.findFirst.mockResolvedValue(currentUser);
    mocks.bcrypt.compare.mockResolvedValue(false);

    const error = await captureApiError(
      loginUser({ identifier: "alice", password: "wrong-password" }, metadata),
    );

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(mocks.prisma.refresh_tokens.create).not.toHaveBeenCalled();
    expect(mocks.jwt.signAccessToken).not.toHaveBeenCalled();
  });

  it("rejects invalid input before querying the database", async () => {
    const error = await captureApiError(
      loginUser({ identifier: "", password: "" }, metadata),
    );

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mocks.prisma.users.findFirst).not.toHaveBeenCalled();
  });
});

describe("refreshSession", () => {
  const activeToken = {
    id: "token-1",
    user_id: USER_ID,
    expires_at: new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000),
    revoked_at: null,
  };

  it("rejects a missing refresh token", async () => {
    const error = await captureApiError(refreshSession(undefined, metadata));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.refresh_tokens.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown refresh token", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue(null);

    const error = await captureApiError(refreshSession("raw-token", metadata));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.refresh_tokens.findUnique).toHaveBeenCalledWith({
      where: { token_hash: hashRefreshToken("raw-token") },
      select: {
        id: true,
        user_id: true,
        expires_at: true,
        revoked_at: true,
      },
    });
  });

  it("rejects a revoked refresh token", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue({
      ...activeToken,
      revoked_at: new Date(NOW.getTime() - 1000),
    });

    const error = await captureApiError(refreshSession("raw-token", metadata));

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an expired refresh token", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue({
      ...activeToken,
      expires_at: new Date(NOW.getTime()),
    });

    const error = await captureApiError(refreshSession("raw-token", metadata));

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("issues an access token without rotating outside the rotation window", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue(activeToken);

    const result = await refreshSession("raw-token", metadata);

    expect(mocks.jwt.signAccessToken).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: null,
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.refresh_tokens.create).not.toHaveBeenCalled();
  });

  it("rotates the refresh token inside the rotation window", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue({
      ...activeToken,
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
    mocks.jwt.generateRefreshToken.mockReturnValue("rotated-refresh-token");

    const result = await refreshSession("raw-token", metadata);

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: { id: "token-1", revoked_at: null },
      data: { revoked_at: NOW },
    });
    expect(mocks.prisma.refresh_tokens.create).toHaveBeenCalledWith({
      data: {
        user_id: USER_ID,
        token_hash: hashRefreshToken("rotated-refresh-token"),
        expires_at: REFRESH_TOKEN_EXPIRY,
        user_agent: metadata.userAgent,
        ip_address: metadata.ipAddress,
      },
    });
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "rotated-refresh-token",
    });
  });

  it("rejects rotation when another request already revoked the token", async () => {
    mocks.prisma.refresh_tokens.findUnique.mockResolvedValue({
      ...activeToken,
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
    mocks.prisma.refresh_tokens.updateMany.mockResolvedValue({ count: 0 });

    const error = await captureApiError(refreshSession("raw-token", metadata));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.refresh_tokens.create).not.toHaveBeenCalled();
  });
});

describe("logoutUser", () => {
  it("does nothing without a refresh token", async () => {
    await logoutUser(undefined);

    expect(mocks.prisma.refresh_tokens.updateMany).not.toHaveBeenCalled();
  });

  it("revokes the matching refresh token", async () => {
    await logoutUser("raw-token");

    expect(mocks.prisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: {
        token_hash: hashRefreshToken("raw-token"),
        revoked_at: null,
      },
      data: { revoked_at: NOW },
    });
  });

  it("propagates database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.refresh_tokens.updateMany.mockRejectedValue(databaseError);

    await expect(logoutUser("raw-token")).rejects.toBe(databaseError);
  });
});

describe("getCurrentUser", () => {
  it("rejects a missing access token", async () => {
    const error = await captureApiError(getCurrentUser(undefined));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.jwt.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("returns the authenticated user", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);

    const result = await getCurrentUser("access-token");

    expect(mocks.jwt.verifyAccessToken).toHaveBeenCalledWith("access-token");
    expect(mocks.prisma.users.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
    });
    expect(result).toEqual(publicUser);
  });

  it("rejects when the token references a missing user", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(null);

    const error = await captureApiError(getCurrentUser("access-token"));

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("propagates token expiry from the JWT layer", async () => {
    mocks.jwt.verifyAccessToken.mockRejectedValue(ApiError.tokenExpired());

    const error = await captureApiError(getCurrentUser("expired-token"));

    expect(error.code).toBe("TOKEN_EXPIRED");
    expect(mocks.prisma.users.findUnique).not.toHaveBeenCalled();
  });
});

describe("updateCurrentUser", () => {
  it("rejects invalid input before authenticating", async () => {
    const error = await captureApiError(updateCurrentUser("access-token", {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual([
      { message: "At least one of username or email is required" },
    ]);
    expect(mocks.jwt.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a missing access token", async () => {
    const error = await captureApiError(
      updateCurrentUser(undefined, { username: "alice2" }),
    );

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.prisma.users.update).not.toHaveBeenCalled();
  });

  it("updates the username", async () => {
    const updatedUser = {
      ...currentUser,
      username: "alice2",
      updated_at: NOW,
    };
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.users.update.mockResolvedValue(updatedUser);

    const result = await updateCurrentUser("access-token", {
      username: " alice2 ",
    });

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: USER_ID },
        OR: [{ username: "alice2" }],
      },
      select: { username: true, email: true },
    });
    expect(mocks.prisma.users.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { username: "alice2", updated_at: NOW },
    });
    expect(result).toEqual({ ...publicUser, username: "alice2", updated_at: NOW });
  });

  it("updates the email", async () => {
    const updatedUser = {
      ...currentUser,
      email: "new@example.com",
      updated_at: NOW,
    };
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.users.update.mockResolvedValue(updatedUser);

    const result = await updateCurrentUser("access-token", {
      email: " New@Example.com ",
    });

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: USER_ID },
        OR: [{ email: "new@example.com" }],
      },
      select: { username: true, email: true },
    });
    expect(mocks.prisma.users.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { email: "new@example.com", updated_at: NOW },
    });
    expect(result).toEqual({
      ...publicUser,
      email: "new@example.com",
      updated_at: NOW,
    });
  });

  it("updates both username and email when no conflicts exist", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);

    await updateCurrentUser("access-token", {
      username: "alice2",
      email: "new@example.com",
    });

    expect(mocks.prisma.users.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: USER_ID },
        OR: [{ username: "alice2" }, { email: "new@example.com" }],
      },
      select: { username: true, email: true },
    });
    expect(mocks.prisma.users.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        username: "alice2",
        email: "new@example.com",
        updated_at: NOW,
      },
    });
  });

  it("rejects conflicting usernames and emails", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.users.findFirst.mockResolvedValue({
      username: "alice2",
      email: "new@example.com",
    });

    const error = await captureApiError(
      updateCurrentUser("access-token", {
        username: "alice2",
        email: "new@example.com",
      }),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.details).toEqual([
      { field: "username", message: "Username is already taken" },
      { field: "email", message: "Email is already registered" },
    ]);
    expect(mocks.prisma.users.update).not.toHaveBeenCalled();
  });

  it("maps a unique constraint error on update to a conflict", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.users.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const error = await captureApiError(
      updateCurrentUser("access-token", { username: "alice2" }),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.details).toBeUndefined();
  });

  it("rethrows unexpected database errors", async () => {
    const databaseError = new Error("database is down");
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.users.update.mockRejectedValue(databaseError);

    await expect(
      updateCurrentUser("access-token", { username: "alice2" }),
    ).rejects.toBe(databaseError);
  });
});

describe("changePassword", () => {
  const validChange = {
    currentPassword: "old-password",
    newPassword: "new-password",
  };

  it("rejects invalid input before authenticating", async () => {
    const error = await captureApiError(changePassword("access-token", "refresh", {}));

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(mocks.jwt.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a missing access token", async () => {
    const error = await captureApiError(changePassword(undefined, "refresh", validChange));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(mocks.bcrypt.compare).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.bcrypt.compare.mockResolvedValue(false);

    const error = await captureApiError(
      changePassword("access-token", "refresh", validChange),
    );

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.message).toBe("Current password is incorrect");
    expect(mocks.bcrypt.hash).not.toHaveBeenCalled();
    expect(mocks.prisma.users.update).not.toHaveBeenCalled();
  });

  it("updates the password and revokes other refresh tokens", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);

    await changePassword("access-token", "current-refresh", validChange);

    expect(mocks.bcrypt.compare).toHaveBeenCalledWith(
      "old-password",
      currentUser.password_hash,
    );
    expect(mocks.bcrypt.hash).toHaveBeenCalledWith("new-password", 12);
    expect(mocks.prisma.users.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { password_hash: "new-password-hash", updated_at: NOW },
    });
    expect(mocks.prisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: {
        user_id: USER_ID,
        revoked_at: null,
        token_hash: { not: hashRefreshToken("current-refresh") },
      },
      data: { revoked_at: NOW },
    });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);

    const [operations] = mocks.prisma.$transaction.mock.calls[0];
    expect(operations).toHaveLength(2);
  });

  it("revokes all refresh tokens when no refresh token is provided", async () => {
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);

    await changePassword("access-token", undefined, validChange);

    expect(mocks.prisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: { user_id: USER_ID, revoked_at: null },
      data: { revoked_at: NOW },
    });
  });

  it("propagates transaction failures", async () => {
    const databaseError = new Error("transaction failed");
    mocks.prisma.users.findUnique.mockResolvedValue(currentUser);
    mocks.prisma.$transaction.mockRejectedValue(databaseError);

    await expect(
      changePassword("access-token", "refresh", validChange),
    ).rejects.toBe(databaseError);
  });
});
