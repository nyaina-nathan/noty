import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import type { SessionMetadata } from "@/types/auth.types";

/** Reads a JSON request body, mapping malformed JSON to a validation error. */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.validation([
      { message: "Request body must be valid JSON" },
    ]);
  }
}

function normalizeIp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.split(",")[0]?.trim() ?? "";

  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");

    if (closingBracket !== -1) {
      candidate = candidate.slice(1, closingBracket);
    }
  } else if (candidate.includes(".") && candidate.includes(":")) {
    // IPv4 with a port, e.g. "203.0.113.7:443".
    const colon = candidate.indexOf(":");

    if (colon !== -1 && candidate.indexOf(":", colon + 1) === -1) {
      const host = candidate.slice(0, colon);

      if (isIP(host) === 4) {
        candidate = host;
      }
    }
  }

  return isIP(candidate) > 0 ? candidate : null;
}

/** Collects the session metadata stored alongside refresh tokens. */
export function getSessionMetadata(request: NextRequest): SessionMetadata {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  return {
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    ipAddress: normalizeIp(forwardedFor ?? realIp),
  };
}
