import { createHash, randomBytes } from "node:crypto";
import { errors, jwtVerify, SignJWT } from "jose";
import { ApiError } from "./api/errors";

const JWT_ALG = "HS256";
const JWT_ISSUER = "noty";
const MIN_SECRET_BYTES = 32;
const REFRESH_TOKEN_BYTES = 32;

/** Access token lifetime in seconds (15 minutes). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token lifetime in seconds (30 days). */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AccessTokenClaims {
  sub: string;
}

export interface VerifiedAccessToken {
  userId: string;
}

let warnedAboutWeakSecret = false;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  const bytes = new TextEncoder().encode(secret);

  if (bytes.length < MIN_SECRET_BYTES && !warnedAboutWeakSecret) {
    warnedAboutWeakSecret = true;
    console.warn(
      `JWT_SECRET is shorter than ${MIN_SECRET_BYTES} bytes; use a longer random secret.`,
    );
  }

  return bytes;
}

/** Signs a short-lived access token whose `sub` claim is the user id. */
export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS)
    .setIssuer(JWT_ISSUER)
    .sign(getJwtSecret());
}

/**
 * Verifies an access token and returns its user id.
 *
 * @throws {ApiError} `TOKEN_EXPIRED` when the token has expired,
 * `UNAUTHORIZED` for any other invalid or malformed token.
 */
export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAccessToken> {
  if (!token) {
    throw ApiError.unauthorized();
  }

  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
      issuer: JWT_ISSUER,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw ApiError.unauthorized();
    }

    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof errors.JWTExpired) {
      throw ApiError.tokenExpired();
    }

    throw ApiError.unauthorized();
  }
}

/**
 * Generates an opaque refresh token. The raw value is only ever sent to the
 * client; the database stores its `hashRefreshToken` digest.
 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/** Hashes a refresh token for storage in `refresh_tokens.token_hash`. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Computes the refresh token's `expires_at` timestamp. */
export function getRefreshTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
