import { NextResponse } from "next/server";

import { requireDashboardSession } from "@/lib/dashboardAuth";

export async function GET() {
  const authed = await requireDashboardSession();
  return NextResponse.json({ authed });
}
