import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from "vitest";
import type { PrismaClient } from "@/prisma/generated/client";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-cookies";
import { hashRefreshToken } from "@/lib/jwt";
import {
  callRoute,
  getCookie,
  getSetCookie,
  jsonRequest,
  type RouteHandler,
} from "./helpers/auth";

interface PublicUserBody {
  id: string;
  username: string;
  email: string;
  created_at: string | null;
  updated_at: string | null;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

type UserInput = {
  username: string;
  email: string;
  password: string;
};

const DEFAULT_USER: UserInput = {
  username: "alice",
  email: "alice@example.com",
  password: "password123",
};

const JWT_SECRET = "integration-test-jwt-secret-0123456789abcdef";
const NEW_PASSWORD = "new-password-456";

let prisma: PrismaClient;
let routes: {
  register: { POST: RouteHandler };
  login: { POST: RouteHandler };
  refresh: { POST: RouteHandler };
  logout: { POST: RouteHandler };
  me: { GET: RouteHandler; PATCH: RouteHandler };
  changePassword: { POST: RouteHandler };
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<ErrorBody["error"]> {
  const body = await readJson<ErrorBody>(response);
  return body.error;
}

function authCookies(accessToken?: string, refreshToken?: string) {
  return {
    [ACCESS_TOKEN_COOKIE]: accessToken,
    [REFRESH_TOKEN_COOKIE]: refreshToken,
  };
}

async function register(overrides: Partial<UserInput> = {}) {
  const input = { ...DEFAULT_USER, ...overrides };
  const response = await callRoute(
    routes.register.POST,
    jsonRequest("/api/auth/register", { body: input }),
  );

  return {
    response,
    input,
    accessToken: getCookie(response, ACCESS_TOKEN_COOKIE),
    refreshToken: getCookie(response, REFRESH_TOKEN_COOKIE),
  };
}

async function login(identifier: string, password: string) {
  const response = await callRoute(
    routes.login.POST,
    jsonRequest("/api/auth/login", {
      body: { identifier, password },
    }),
  );

  return {
    response,
    accessToken: getCookie(response, ACCESS_TOKEN_COOKIE),
    refreshToken: getCookie(response, REFRESH_TOKEN_COOKIE),
  };
}

function refresh(refreshToken?: string) {
  return callRoute(
    routes.refresh.POST,
    jsonRequest("/api/auth/refresh", {
      cookies: authCookies(undefined, refreshToken),
    }),
  );
}

function logout(refreshToken?: string) {
  return callRoute(
    routes.logout.POST,
    jsonRequest("/api/auth/logout", {
      cookies: authCookies(undefined, refreshToken),
    }),
  );
}

function findRefreshToken(refreshToken: string) {
  return prisma.refresh_tokens.findUnique({
    where: { token_hash: hashRefreshToken(refreshToken) },
  });
}

beforeAll(async () => {
  process.env.DATABASE_URL = inject("databaseUrl");
  process.env.JWT_SECRET = JWT_SECRET;

  ({ prisma } = await import("@/lib/prisma"));

  routes = {
    register: await import("@/app/api/auth/register/route"),
    login: await import("@/app/api/auth/login/route"),
    refresh: await import("@/app/api/auth/refresh/route"),
    logout: await import("@/app/api/auth/logout/route"),
    me: await import("@/app/api/auth/me/route"),
    changePassword: await import("@/app/api/auth/change-password/route"),
  };
});

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a user and stores a refresh token", async () => {
    const { response, input, accessToken, refreshToken } = await register();

    expect(response.status).toBe(201);

    const body = await readJson<PublicUserBody>(response);
    expect(body).toMatchObject({
      username: input.username,
      email: input.email,
    });
    expect(body.id).toEqual(expect.any(String));
    expect(body).not.toHaveProperty("password_hash");
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const accessCookie = getSetCookie(response, ACCESS_TOKEN_COOKIE);
    const refreshCookie = getSetCookie(response, REFRESH_TOKEN_COOKIE);

    expect(accessCookie?.toLowerCase()).toContain("httponly");
    expect(accessCookie?.toLowerCase()).toContain("samesite=lax");
    expect(accessCookie).toContain("Path=/");
    expect(refreshCookie).toContain("Path=/api/auth");

    const user = await prisma.users.findUnique({
      where: { email: input.email },
    });
    expect(user).not.toBeNull();
    expect(user?.password_hash).not.toBe(input.password);

    const token = await findRefreshToken(refreshToken as string);
    expect(token).toMatchObject({
      user_id: user?.id,
      user_agent: "noty-integration-test",
      ip_address: "203.0.113.10",
      revoked_at: null,
    });
  });

  it("rejects duplicate usernames and emails with field details", async () => {
    const { input } = await register();

    const response = await callRoute(
      routes.register.POST,
      jsonRequest("/api/auth/register", { body: input }),
    );

    expect(response.status).toBe(409);
    expect(await readError(response)).toMatchObject({
      code: "CONFLICT",
      details: [
        { field: "username", message: "Username is already taken" },
        { field: "email", message: "Email is already registered" },
      ],
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await callRoute(
      routes.register.POST,
      jsonRequest("/api/auth/register", { rawBody: "{" }),
    );

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ message: "Request body must be valid JSON" }],
    });
  });

  it("rejects invalid fields", async () => {
    const response = await callRoute(
      routes.register.POST,
      jsonRequest("/api/auth/register", {
        body: { username: "", email: "not-an-email", password: "short" },
      }),
    );

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with a username and creates another session", async () => {
    const { input } = await register();

    const { response, accessToken, refreshToken } = await login(
      input.username,
      input.password,
    );

    expect(response.status).toBe(200);
    expect(await readJson<PublicUserBody>(response)).toMatchObject({
      username: input.username,
      email: input.email,
    });
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const user = await prisma.users.findUnique({
      where: { email: input.email },
    });
    const tokenCount = await prisma.refresh_tokens.count({
      where: { user_id: user?.id },
    });

    expect(tokenCount).toBe(2);
  });

  it("logs in with an email regardless of case", async () => {
    const { input } = await register();

    const { response } = await login(input.email.toUpperCase(), input.password);

    expect(response.status).toBe(200);
  });

  it("rejects a wrong password", async () => {
    const { input } = await register();

    const { response } = await login(input.username, "wrong-password");

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects an unknown user", async () => {
    const { response } = await login("ghost", "password123");

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("rejects invalid input", async () => {
    const response = await callRoute(
      routes.login.POST,
      jsonRequest("/api/auth/login", {
        body: { identifier: "", password: "" },
      }),
    );

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request without an access token", async () => {
    const response = await callRoute(
      routes.me.GET,
      jsonRequest("/api/auth/me", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns the authenticated user", async () => {
    const { accessToken, input } = await register();

    const response = await callRoute(
      routes.me.GET,
      jsonRequest("/api/auth/me", {
        method: "GET",
        cookies: authCookies(accessToken),
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson<PublicUserBody>(response)).toMatchObject({
      username: input.username,
      email: input.email,
    });
  });
});

describe("PATCH /api/auth/me", () => {
  it("updates the username and email", async () => {
    const { accessToken } = await register();

    const response = await callRoute(
      routes.me.PATCH,
      jsonRequest("/api/auth/me", {
        method: "PATCH",
        body: { username: "alice-updated", email: "updated@example.com" },
        cookies: authCookies(accessToken),
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson<PublicUserBody>(response)).toMatchObject({
      username: "alice-updated",
      email: "updated@example.com",
    });

    const stored = await prisma.users.findUnique({
      where: { email: "updated@example.com" },
    });
    expect(stored?.username).toBe("alice-updated");
  });

  it("rejects an update that conflicts with another user", async () => {
    const { accessToken } = await register();
    const other = await register({
      username: "bob",
      email: "bob@example.com",
    });

    const response = await callRoute(
      routes.me.PATCH,
      jsonRequest("/api/auth/me", {
        method: "PATCH",
        body: { username: other.input.username },
        cookies: authCookies(accessToken),
      }),
    );

    expect(response.status).toBe(409);
    expect(await readError(response)).toMatchObject({
      code: "CONFLICT",
      details: [{ field: "username", message: "Username is already taken" }],
    });
  });

  it("rejects an empty update", async () => {
    const { accessToken } = await register();

    const response = await callRoute(
      routes.me.PATCH,
      jsonRequest("/api/auth/me", {
        method: "PATCH",
        body: {},
        cookies: authCookies(accessToken),
      }),
    );

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("POST /api/auth/refresh", () => {
  it("rejects a request without a refresh token", async () => {
    const response = await refresh();

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("issues a new access token without rotating outside the window", async () => {
    const { refreshToken } = await register();

    const response = await refresh(refreshToken);

    expect(response.status).toBe(204);
    expect(getCookie(response, ACCESS_TOKEN_COOKIE)).toBeTruthy();
    expect(getCookie(response, REFRESH_TOKEN_COOKIE)).toBeUndefined();

    const token = await findRefreshToken(refreshToken as string);
    expect(token?.revoked_at).toBeNull();
  });

  it("rotates a refresh token inside the rotation window", async () => {
    const { refreshToken } = await register();
    const token = await findRefreshToken(refreshToken as string);

    await prisma.refresh_tokens.update({
      where: { id: token?.id },
      data: { expires_at: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const response = await refresh(refreshToken);

    expect(response.status).toBe(204);
    expect(getCookie(response, ACCESS_TOKEN_COOKIE)).toBeTruthy();

    const rotatedToken = getCookie(response, REFRESH_TOKEN_COOKIE);
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(refreshToken);

    const oldToken = await findRefreshToken(refreshToken as string);
    expect(oldToken?.revoked_at).not.toBeNull();

    const newToken = await findRefreshToken(rotatedToken as string);
    expect(newToken?.revoked_at).toBeNull();

    const reuseResponse = await refresh(refreshToken);
    expect(reuseResponse.status).toBe(401);
  });

  it("rejects an expired refresh token", async () => {
    const { refreshToken } = await register();
    const token = await findRefreshToken(refreshToken as string);

    await prisma.refresh_tokens.update({
      where: { id: token?.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const response = await refresh(refreshToken);

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an unknown refresh token", async () => {
    const response = await refresh("not-a-valid-token");

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookies even without a refresh token", async () => {
    const response = await logout();

    expect(response.status).toBe(204);
    expect(getSetCookie(response, ACCESS_TOKEN_COOKIE)).toContain("Max-Age=0");
    expect(getSetCookie(response, REFRESH_TOKEN_COOKIE)).toContain("Max-Age=0");
  });

  it("revokes the refresh token and prevents reuse", async () => {
    const { refreshToken } = await register();

    const response = await logout(refreshToken);

    expect(response.status).toBe(204);

    const token = await findRefreshToken(refreshToken as string);
    expect(token?.revoked_at).not.toBeNull();

    const refreshResponse = await refresh(refreshToken);
    expect(refreshResponse.status).toBe(401);
  });

  it("is idempotent for an unknown refresh token", async () => {
    const response = await logout("not-a-valid-token");

    expect(response.status).toBe(204);
  });
});

describe("POST /api/auth/change-password", () => {
  it("rejects a request without authentication", async () => {
    const response = await callRoute(
      routes.changePassword.POST,
      jsonRequest("/api/auth/change-password", {
        body: { currentPassword: "password123", newPassword: NEW_PASSWORD },
      }),
    );

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a wrong current password", async () => {
    const { accessToken, refreshToken } = await register();

    const response = await callRoute(
      routes.changePassword.POST,
      jsonRequest("/api/auth/change-password", {
        body: { currentPassword: "wrong-password", newPassword: NEW_PASSWORD },
        cookies: authCookies(accessToken, refreshToken),
      }),
    );

    expect(response.status).toBe(401);
    expect(await readError(response)).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Current password is incorrect",
    });
  });

  it("changes the password and revokes other sessions", async () => {
    const firstSession = await register();
    const secondSession = await login(
      firstSession.input.username,
      firstSession.input.password,
    );

    const response = await callRoute(
      routes.changePassword.POST,
      jsonRequest("/api/auth/change-password", {
        body: {
          currentPassword: firstSession.input.password,
          newPassword: NEW_PASSWORD,
        },
        cookies: authCookies(
          firstSession.accessToken,
          firstSession.refreshToken,
        ),
      }),
    );

    expect(response.status).toBe(204);

    const oldPasswordLogin = await login(
      firstSession.input.username,
      firstSession.input.password,
    );
    expect(oldPasswordLogin.response.status).toBe(401);

    const newPasswordLogin = await login(
      firstSession.input.username,
      NEW_PASSWORD,
    );
    expect(newPasswordLogin.response.status).toBe(200);

    const revokedSession = await refresh(secondSession.refreshToken);
    expect(revokedSession.status).toBe(401);

    const currentSession = await refresh(firstSession.refreshToken);
    expect(currentSession.status).toBe(204);
  });

  it("rejects invalid input", async () => {
    const { accessToken, refreshToken } = await register();

    const response = await callRoute(
      routes.changePassword.POST,
      jsonRequest("/api/auth/change-password", {
        body: { currentPassword: "", newPassword: "short" },
        cookies: authCookies(accessToken, refreshToken),
      }),
    );

    expect(response.status).toBe(422);
    expect(await readError(response)).toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("auth flow", () => {
  it("supports register, me, refresh, logout and rejects reuse", async () => {
    const { input, accessToken, refreshToken } = await register();

    const meResponse = await callRoute(
      routes.me.GET,
      jsonRequest("/api/auth/me", {
        method: "GET",
        cookies: authCookies(accessToken),
      }),
    );
    expect(meResponse.status).toBe(200);
    expect(await readJson<PublicUserBody>(meResponse)).toMatchObject({
      username: input.username,
      email: input.email,
    });

    const refreshResponse = await refresh(refreshToken);
    expect(refreshResponse.status).toBe(204);
    expect(getCookie(refreshResponse, ACCESS_TOKEN_COOKIE)).toBeTruthy();

    const logoutResponse = await logout(refreshToken);
    expect(logoutResponse.status).toBe(204);

    const reuseResponse = await refresh(refreshToken);
    expect(reuseResponse.status).toBe(401);
    expect(await readError(reuseResponse)).toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
