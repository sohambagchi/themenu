import { cookies } from "next/headers";

export const DASHBOARD_SESSION_COOKIE = "themenu_dashboard_session";

export function getDashboardSessionToken() {
  return process.env.DASHBOARD_SESSION_TOKEN ?? "";
}

export function getDashboardUsername() {
  return process.env.DASHBOARD_USERNAME ?? "";
}

export function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD ?? "";
}

export function hasValidDashboardCredentials(username: string, password: string) {
  const expectedUsername = getDashboardUsername();
  const expectedPassword = getDashboardPassword();
  if (!expectedUsername || !expectedPassword) return false;
  return username === expectedUsername && password === expectedPassword;
}

export function hasValidDashboardSession(value?: string) {
  const expected = getDashboardSessionToken();
  if (!expected || !value) return false;
  return value === expected;
}

export function getSanitizedNextPath(nextRaw: string | null) {
  if (!nextRaw || !nextRaw.startsWith("/")) return "/";
  if (nextRaw.startsWith("//")) return "/";
  return nextRaw;
}

export function getDashboardOwnerUserId() {
  return process.env.DASHBOARD_OWNER_USER_ID ?? "";
}

export async function requireDashboardSession() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  return hasValidDashboardSession(sessionValue);
}
