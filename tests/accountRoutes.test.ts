import { describe, expect, it } from "vitest";
import { resolveAccountRoute } from "../src/lib/accountRoutes";

describe("individual account route policy", () => {
  it("keeps the landing, demo, and auth pages public", () => {
    expect(resolveAccountRoute("/", false, false)).toBe("landing");
    expect(resolveAccountRoute("/demo", false, false)).toBe("demo");
    expect(resolveAccountRoute("/auth?mode=sign-up", false, false)).toBe("auth");
    expect(resolveAccountRoute("/auth/reset", false, false)).toBe("auth");
  });

  it("requires sign-in and onboarding before the private app", () => {
    expect(resolveAccountRoute("/app", false, false)).toBe("redirect-auth");
    expect(resolveAccountRoute("/onboarding", false, false)).toBe("redirect-auth");
    expect(resolveAccountRoute("/app", true, false)).toBe("redirect-onboarding");
    expect(resolveAccountRoute("/onboarding", true, false)).toBe("onboarding");
    expect(resolveAccountRoute("/app", true, true)).toBe("app");
  });

  it("keeps password recovery available and redirects signed-in users from entry pages", () => {
    expect(resolveAccountRoute("/auth/new-password", false, false)).toBe("auth");
    expect(resolveAccountRoute("/auth/new-password", true, true)).toBe("recovery");
    expect(resolveAccountRoute("/", true, true)).toBe("redirect-app");
    expect(resolveAccountRoute("/demo", true, false)).toBe("redirect-onboarding");
  });
});