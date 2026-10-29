import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookie-names";
import { proxy } from "@/proxy";

function request(path: string, accessToken?: string) {
  const headers = new Headers();

  if (accessToken !== undefined) {
    headers.set("cookie", `${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  }

  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("proxy", () => {
  it.each(["/dashboard", "/dashboard/notes", "/dashboard/tags?search=work"])(
    "redirects unauthenticated requests for %s to the login page",
    (path) => {
      const response = proxy(request(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login",
      );
    },
  );

  it("lets a request with an access token cookie through", () => {
    const response = proxy(request("/dashboard/notes", "signed-token"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("treats an empty access token cookie as signed out", () => {
    const response = proxy(request("/dashboard/notes", ""));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });
});
