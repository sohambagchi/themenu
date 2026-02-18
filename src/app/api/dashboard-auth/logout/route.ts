import { NextResponse } from "next/server";

import { DASHBOARD_SESSION_COOKIE } from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
