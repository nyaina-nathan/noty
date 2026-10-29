import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth-cookie-names";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/jwt";
import type { AuthTokens } from "@/types/auth.types";

export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE };

const ACCESS_TOKEN_PATH = "/";
const REFRESH_TOKEN_PATH = "/api/auth";

function cookieOptions(path: string, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge,
  };
}

export function setAccessTokenCookie(
  response: NextResponse,
  accessToken: string,
): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    ...cookieOptions(ACCESS_TOKEN_PATH, ACCESS_TOKEN_TTL_SECONDS),
  });
}

export function setRefreshTokenCookie(
  response: NextResponse,
  refreshToken: string,
): void {
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: refreshToken,
    ...cookieOptions(REFRESH_TOKEN_PATH, REFRESH_TOKEN_TTL_SECONDS),
  });
}

export function setAuthCookies(
  response: NextResponse,
  tokens: AuthTokens,
): void {
  setAccessTokenCookie(response, tokens.accessToken);
  setRefreshTokenCookie(response, tokens.refreshToken);
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: "",
    ...cookieOptions(ACCESS_TOKEN_PATH, 0),
    expires: new Date(0),
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: "",
    ...cookieOptions(REFRESH_TOKEN_PATH, 0),
    expires: new Date(0),
  });
}
