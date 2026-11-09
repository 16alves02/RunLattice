import { describe, expect, it } from "vitest";
import { isPublicPath } from "../../middleware";

describe("public authentication routes", () => {
  it.each([
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/two-factor",
    "/api/auth",
    "/api/auth/sign-in/email",
    "/api/health",
  ])("allows %s without an established session", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/security",
    "/workflows",
    "/api/workflows",
    "/api/billing",
  ])("keeps %s behind session authentication", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
