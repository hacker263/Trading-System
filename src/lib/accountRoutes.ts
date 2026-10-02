export type AccountRouteDecision =
  | "landing"
  | "auth"
  | "recovery"
  | "onboarding"
  | "app"
  | "demo"
  | "redirect-auth"
  | "redirect-landing"
  | "redirect-app"
  | "redirect-onboarding";

export function resolveAccountRoute(
  pathname: string,
  authenticated: boolean,
  onboardingComplete: boolean,
): AccountRouteDecision {
  const path = pathname.split("?", 1)[0].replace(/\/$/, "") || "/";
  const isRecovery = path === "/auth/new-password";
  const isAuthPath = path === "/auth" || path === "/auth/reset" || isRecovery;

  if (!authenticated) {
    if (path === "/") return "landing";
    if (path === "/demo") return "demo";
    if (isAuthPath) return "auth";
    if (path === "/app" || path === "/onboarding") return "redirect-auth";
    return "redirect-landing";
  }

  if (isRecovery) return "recovery";
  if (path === "/onboarding") {
    return onboardingComplete ? "redirect-app" : "onboarding";
  }
  if (path === "/app") {
    return onboardingComplete ? "app" : "redirect-onboarding";
  }
  if (path === "/" || path === "/demo" || isAuthPath) {
    return onboardingComplete ? "redirect-app" : "redirect-onboarding";
  }
  return "redirect-app";
}