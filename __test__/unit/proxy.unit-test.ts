import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookie-names";
import { signAccessToken } from "@/lib/jwt";
import { proxy } from "@/proxy";

const JWT_SECRET = "unit-test-jwt-secret-0123456789abcdef";

process.env.JWT_SECRET = JWT_SECRET;

function request(path: string, accessToken?: string) {
  const headers = new Headers();

  if (accessToken !== undefined) {
    headers.set("cookie", `${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  }

  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

function redirectTarget(response: Response): URL {
  return new URL(response.headers.get("location") as string);
}

async function asyncRequest(path: string, accessToken?: string) {
  return proxy(request(path, accessToken));
}

async function expiredAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-id")
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .setIssuer("noty")
    .sign(new TextEncoder().encode(JWT_SECRET));
}

describe("proxy", () => {
  it.each([
    "/dashboard",
    "/dashboard/notes",
    "/dashboard/tags?search=work",
    "/dashboard/notes/123?tab=content",
  ])("routes unauthenticated requests for %s through the refresh endpoint", async (path) => {
    const response = await asyncRequest(path);

    expect(response.status).toBe(307);
    expect(
      redirectTarget(response).pathname,
    ).toBe("/api/auth/refresh");
    expect(redirectTarget(response).searchParams.get("next")).toBe(path);
  });

  it("routes an empty access token cookie through the refresh endpoint", async () => {
    const response = await asyncRequest("/dashboard/notes", "");

    expect(redirectTarget(response).pathname).toBe("/api/auth/refresh");
  });

  it("routes an invalid access token through the refresh endpoint", async () => {
    const response = await asyncRequest("/dashboard/notes", "not-a-jwt");

    expect(redirectTarget(response).pathname).toBe("/api/auth/refresh");
  });

  it("routes an expired access token through the refresh endpoint", async () => {
    const response = await asyncRequest(
      "/dashboard/notes",
      await expiredAccessToken(),
    );

    expect(redirectTarget(response).pathname).toBe("/api/auth/refresh");
  });

  it("lets a request with a valid access token cookie through", async () => {
    const response = await asyncRequest(
      "/dashboard/notes",
      await signAccessToken("user-id"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/login", "/register"])(
    "forwards a signed-in visitor on %s to the dashboard",
    async (path) => {
      const response = await asyncRequest(path, await signAccessToken("user-id"));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/dashboard",
      );
    },
  );

  it.each(["/login", "/register"])(
    "routes a signed-out visitor on %s through the refresh endpoint",
    async (path) => {
      const response = await asyncRequest(path);

      expect(response.status).toBe(307);
      expect(redirectTarget(response).pathname).toBe("/api/auth/refresh");
      expect(redirectTarget(response).searchParams.get("next")).toBe(
        "/dashboard",
      );
      expect(redirectTarget(response).searchParams.get("fallback")).toBe(path);
    },
  );

  it.each(["/login?session=ended", "/register?session=ended"])(
    "renders %s after a failed refresh instead of looping",
    async (path) => {
      const response = await asyncRequest(path);

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );
});
