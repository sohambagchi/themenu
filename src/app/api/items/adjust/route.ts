import { NextResponse } from "next/server";

import { getDashboardOwnerUserId, requireDashboardSession } from "@/lib/dashboardAuth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as { id?: string; delta?: number };
  const id = String(payload.id ?? "");
  const delta = Number(payload.delta ?? 0);

  if (!id || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Invalid id or delta." }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from("items")
    .select("quantity,stock_kind")
    .eq("id", id)
    .eq("user_id", ownerUserId)
    .single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const isIngredient = String((row as { stock_kind: string }).stock_kind) === "Ingredient";
  if (isIngredient) {
    const authed = await requireDashboardSession();
    if (!authed) {
      return NextResponse.json(
        { error: "Login required to manually adjust Ingredient stock." },
        { status: 401 }
      );
    }
  }

  const nextQty = Math.max(0, Number(row.quantity) + delta);
  if (isIngredient && nextQty === 0) {
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
