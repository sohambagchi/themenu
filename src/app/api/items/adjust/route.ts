import { NextResponse } from "next/server";

import { getDashboardOwnerUserId, requireDashboardSession } from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const authed = await requireDashboardSession();
  if (!authed) {
    return NextResponse.json({ error: "Login required to adjust stock." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const payload = (await request.json().catch(() => null)) as { id?: string; delta?: number } | null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = String(payload.id ?? "").trim();
  const delta = Number(payload.delta ?? 0);

  if (!id || id.length > 128 || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 5000) {
    return NextResponse.json({ error: "Invalid id or delta." }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from("items")
    .select("quantity")
    .eq("id", id)
    .eq("user_id", ownerUserId)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const nextQty = Math.max(0, Number(row.quantity) + delta);
  if (nextQty === 0) {
    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", id)
      .eq("user_id", ownerUserId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true, quantity: 0, removed: true });
  }

  const { error: writeError } = await supabase
    .from("items")
    .update({ quantity: nextQty })
    .eq("id", id)
    .eq("user_id", ownerUserId);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  return NextResponse.json({ ok: true, quantity: nextQty });
}
