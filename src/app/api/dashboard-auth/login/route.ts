import { NextResponse } from "next/server";

import {
  createDashboardSessionValue,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
  getDashboardPassword,
  getDashboardUsername,
  hasValidDashboardCredentials,
  getSanitizedNextPath
} from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { getRequestIp } from "@/lib/requestMeta";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = getSanitizedNextPath(String(formData.get("next") ?? "/"));

  const ip = getRequestIp(request);
  const rateLimit = checkRateLimit({
    key: `dashboard-login:${ip}`,
    max: 12,
    windowMs: 10 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    const fail = new URL("/login", request.url);
    fail.searchParams.set("error", "rate_limited");
    fail.searchParams.set("next", nextPath);
    return NextResponse.redirect(fail, {
      status: 303,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) }
    });
  }

  const expectedUsername = getDashboardUsername();
  const expectedPassword = getDashboardPassword();
  const sessionValue = createDashboardSessionValue();

  if (!expectedUsername || !expectedPassword || !sessionValue) {
    return NextResponse.json(
      { error: "Missing dashboard auth env vars." },
      { status: 500 }
    );
  }

  if (!hasValidDashboardCredentials(username, password)) {
    const fail = new URL("/login", request.url);
    fail.searchParams.set("error", "invalid");
    fail.searchParams.set("next", nextPath);
    return NextResponse.redirect(fail, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: sessionValue,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DASHBOARD_SESSION_MAX_AGE_SECONDS
  });

  return response;
}
