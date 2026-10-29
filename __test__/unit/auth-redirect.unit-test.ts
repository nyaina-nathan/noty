import { describe, expect, it } from "vitest";
import { DASHBOARD_PATH, getSafeNextPath } from "@/lib/auth-redirect";

describe("getSafeNextPath", () => {
  it.each([
    "/dashboard",
    "/dashboard/notes",
    "/dashboard/notes/123?tab=content",
  ])("keeps the same-origin path %s", (path) => {
    expect(getSafeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    "",
    "dashboard",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/dashboard",
    "javascript:alert(1)",
  ])("falls back to the dashboard for %s", (value) => {
    expect(getSafeNextPath(value)).toBe(DASHBOARD_PATH);
  });
});
