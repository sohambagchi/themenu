import { NextResponse } from "next/server";

import {
  DASHBOARD_SESSION_COOKIE,
  getDashboardPassword,
  getDashboardSessionToken,
  getDashboardUsername,
  hasValidDashboardCredentials,
  getSanitizedNextPath
} from "@/lib/dashboardAuth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = getSanitizedNextPath(String(formData.get("next") ?? "/"));

  const expectedUsername = getDashboardUsername();
  const expectedPassword = getDashboardPassword();
  const sessionToken = getDashboardSessionToken();

  if (!expectedUsername || !expectedPassword || !sessionToken) {
    return NextResponse.json(
      { error: "Missing dashboard auth env vars." },
      { status: 500 }
    );
  }

  if (!hasValidDashboardCredentials(username, password)) {
    const fail = new URL("/login", request.url);
    fail.searchParams.set("error", "invalid");
    fail.searchParams.set("next", nextPath);
    return NextResponse.redirect(fail);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: sessionToken,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return response;
}
