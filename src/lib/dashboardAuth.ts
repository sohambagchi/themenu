import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

export const DASHBOARD_SESSION_COOKIE = "themenu_dashboard_session";
export const DASHBOARD_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function getDashboardSessionToken() {
  return process.env.DASHBOARD_SESSION_TOKEN ?? "";
}

export function getDashboardUsername() {
  return process.env.DASHBOARD_USERNAME ?? "";
}

export function getDashboardPassword() {
  return process.env.DASHBOARD_PASSWORD ?? "";
}

function secureEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function hasValidDashboardCredentials(username: string, password: string) {
  const expectedUsername = getDashboardUsername();
  const expectedPassword = getDashboardPassword();
  if (!expectedUsername || !expectedPassword) return false;
  return secureEqual(expectedUsername, username) && secureEqual(expectedPassword, password);
}

function signDashboardSession(expiresAtMs: number, nonce: string) {
  const secret = getDashboardSessionToken();
  if (!secret) return "";

  return createHmac("sha256", secret)
    .update(`${expiresAtMs}:${nonce}`)
    .digest("hex");
}

export function createDashboardSessionValue() {
  const expiresAtMs = Date.now() + DASHBOARD_SESSION_MAX_AGE_SECONDS * 1000;
  const nonce = randomUUID();
  const signature = signDashboardSession(expiresAtMs, nonce);
  if (!signature) return "";
  return `v1.${expiresAtMs}.${nonce}.${signature}`;
}

export function hasValidDashboardSession(value?: string) {
  if (!value) return false;

  const [version, expiresAtRaw, nonce, signature] = value.split(".");
  if (version !== "v1" || !expiresAtRaw || !nonce || !signature) return false;

  const expiresAtMs = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;

  const expectedSignature = signDashboardSession(expiresAtMs, nonce);
  if (!expectedSignature) return false;
  return secureEqual(expectedSignature, signature);
}

export function getSanitizedNextPath(nextRaw: string | null) {
  if (!nextRaw || !nextRaw.startsWith("/")) return "/";
  if (nextRaw.startsWith("//")) return "/";
  return nextRaw;
}

export function getDashboardOwnerUserId() {
  return process.env.DASHBOARD_OWNER_USER_ID ?? "";
}

export function isDashboardPublicReadEnabled() {
  const value = (process.env.DASHBOARD_PUBLIC_READ ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function requireDashboardSession() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  return hasValidDashboardSession(sessionValue);
}
