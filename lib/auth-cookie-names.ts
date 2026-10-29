/**
 * Cookie names shared by the server, the browser client, and `proxy.ts`.
 *
 * This module intentionally has no imports so `proxy.ts` can read the names
 * without pulling the token, crypto, or Prisma code into its bundle.
 */
export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
