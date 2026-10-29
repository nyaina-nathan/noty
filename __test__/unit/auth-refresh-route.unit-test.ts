import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-cookie-names";

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
}));

vi.mock("@/services/auth.services", () => ({
  refreshSession: mocks.refreshSession,
}));

import { GET } from "@/app/api/auth/refresh/route";

function request(path: string, refreshToken?: string) {
  const headers = new Headers();

  if (refreshToken !== undefined) {
    headers.set("cookie", `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  }

  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

function setCookie(response: Response, name: string): string | undefined {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${name}=`));
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.refreshSession.mockResolvedValue({
    accessToken: "new-access-token",
    refreshToken: "new-refresh-token",
  });
});

describe("GET /api/auth/refresh", () => {
  it("sets the new cookies and forwards to the requested page", async () => {
    const response = await GET(
      request(
        "/api/auth/refresh?next=%2Fdashboard%2Fnotes%3Ftab%3Dcontent",
        "refresh-token",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/notes?tab=content",
    );
    expect(setCookie(response, ACCESS_TOKEN_COOKIE)).toContain(
      `${ACCESS_TOKEN_COOKIE}=new-access-token`,
    );
    expect(setCookie(response, REFRESH_TOKEN_COOKIE)).toContain(
      `${REFRESH_TOKEN_COOKIE}=new-refresh-token`,
    );
  });

  it("leaves the refresh cookie alone when the token was not rotated", async () => {
    mocks.refreshSession.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: null,
    });

    const response = await GET(
      request("/api/auth/refresh?next=%2Fdashboard", "refresh-token"),
    );

    expect(setCookie(response, ACCESS_TOKEN_COOKIE)).toBeDefined();
    expect(setCookie(response, REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  it("clears the session and returns to login when the refresh fails", async () => {
    mocks.refreshSession.mockRejectedValue(ApiError.unauthorized());

    const response = await GET(
      request("/api/auth/refresh?next=%2Fdashboard", "stale-refresh-token"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?session=ended",
    );
    expect(setCookie(response, ACCESS_TOKEN_COOKIE)).toContain("Max-Age=0");
    expect(setCookie(response, REFRESH_TOKEN_COOKIE)).toContain("Max-Age=0");
  });

  it("never redirects off-site through the next parameter", async () => {
    const response = await GET(
      request(
        "/api/auth/refresh?next=https%3A%2F%2Fevil.example%2Fdashboard",
        "refresh-token",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
  });
});
