const PROTECTED_PREFIXES = [
  "/dashboard",
  "/finance",
  "/calendar",
  "/school",
  "/tasks",
  "/goals",
  "/analytics",
  "/assistant",
  "/settings",
] as const;

const AUTH_PATHS = ["/login", "/signup"] as const;

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((path) => matchesPath(pathname, path));
}

export function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((path) => matchesPath(pathname, path));
}

export function getSafeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  const destination = new URL(value, "http://internal.local");
  return isProtectedPath(destination.pathname)
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/dashboard";
}
