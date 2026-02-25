import { NextResponse } from "next/server";

import {
  hasValidDashboardCredentials,
  isDashboardPublicReadEnabled,
  requireDashboardSession
} from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { normalizeQuantityUnit } from "@/lib/quantity";
import { getRequestIp } from "@/lib/requestMeta";
import { checkRateLimit } from "@/lib/rateLimit";
import { tokenKeyToHash } from "@/lib/staging";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DbSourcingConversionRuleRow,
  ItemLocation,
  SourcingConversionRule,
  SourcingConversionRuleInput,
  TagValue
} from "@/lib/types";

const VALID_LOCATIONS = new Set<ItemLocation>(["Freezer", "Pantry", "Fridge"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTagList(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 30)
    .map((value) => value.slice(0, 64)) as TagValue[];
}

function rowToRule(row: DbSourcingConversionRuleRow): SourcingConversionRule {
  return {
    id: row.id,
    source: row.source,
    tokenKey: row.token_key,
    tokenHash: row.token_hash,
    canonicalName: row.canonical_name,
    canonicalQuantityUnit: row.canonical_quantity_unit ?? "",
    canonicalType: row.canonical_type,
    canonicalLocation: row.canonical_location,
    canonicalTags: (row.canonical_tags ?? []) as TagValue[],
    embeddedMultiplierOverride: row.embedded_multiplier_override,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeRule(raw: unknown): SourcingConversionRuleInput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;

  const source = normalizeText(value.source).toLowerCase().slice(0, 30);
  const tokenKey = normalizeText(value.tokenKey).toLowerCase().slice(0, 200);
  const tokenHash = normalizeText(value.tokenHash).toLowerCase();
  const canonicalName = normalizeText(value.canonicalName).slice(0, 120);
  const canonicalQuantityUnit = normalizeQuantityUnit(value.canonicalQuantityUnit ?? "");
  const canonicalType = normalizeText(value.canonicalType).slice(0, 64);
  const canonicalLocation = normalizeText(value.canonicalLocation) as ItemLocation;
  const canonicalTags = normalizeTagList(value.canonicalTags);

  const embeddedRaw = value.embeddedMultiplierOverride;
  const embeddedMultiplierOverride =
    embeddedRaw === null || embeddedRaw === undefined ? null : Math.trunc(Number(embeddedRaw));

  if (!source) return null;
  if (!tokenKey) return null;
  if (!tokenHash) return null;
  if (tokenHash !== tokenKeyToHash(tokenKey)) return null;
  if (!canonicalName) return null;
  if (canonicalQuantityUnit === null) return null;
  if (!canonicalType) return null;
  if (!VALID_LOCATIONS.has(canonicalLocation)) return null;
  if (
    embeddedMultiplierOverride !== null &&
    (!Number.isFinite(embeddedMultiplierOverride) ||
      embeddedMultiplierOverride < 1 ||
      embeddedMultiplierOverride > 5000)
  ) {
    return null;
  }

  return {
    source,
    tokenKey,
    tokenHash,
    canonicalName,
    canonicalQuantityUnit,
    canonicalType,
    canonicalLocation,
    canonicalTags,
    embeddedMultiplierOverride
  };
}

export async function GET(request: Request) {
  if (!isDashboardPublicReadEnabled()) {
    const hasSession = await requireDashboardSession();
    if (!hasSession) return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase service-role env." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const source = normalizeText(searchParams.get("source") ?? "walmart")
    .toLowerCase()
    .slice(0, 30);
  if (!source) {
    return NextResponse.json({ error: "source is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sourcing_conversion_rules")
    .select("*")
    .eq("source", source)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rules: (data ?? []).map((row: any) => rowToRule(row as DbSourcingConversionRuleRow))
  });
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        rule?: SourcingConversionRuleInput;
        username?: string;
        password?: string;
      }
    | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const hasSession = await requireDashboardSession();
  if (!hasSession) {
    const username = normalizeText(payload.username);
    const password = String(payload.password ?? "");
    const ip = getRequestIp(request);
    const rateLimit = checkRateLimit({
      key: `inline-sourcing-auth:${ip}`,
      max: 20,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many auth attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!hasValidDashboardCredentials(username, password)) {
      return NextResponse.json(
        { error: "Login required. Provide valid username/password." },
        { status: 401 }
      );
    }
  }

  const normalizedRule = normalizeRule(payload.rule);
  if (!normalizedRule) {
    return NextResponse.json({ error: "Invalid conversion rule payload." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase service-role env." }, { status: 500 });
  }

  const upsertRow = {
    source: normalizedRule.source,
    token_key: normalizedRule.tokenKey,
    token_hash: normalizedRule.tokenHash,
    canonical_name: normalizedRule.canonicalName,
    canonical_quantity_unit: normalizedRule.canonicalQuantityUnit,
    canonical_type: normalizedRule.canonicalType,
    canonical_location: normalizedRule.canonicalLocation,
    canonical_tags: normalizedRule.canonicalTags,
    embedded_multiplier_override: normalizedRule.embeddedMultiplierOverride,
    is_active: true
  };

  const { data, error } = await supabase
    .from("sourcing_conversion_rules")
    .upsert(upsertRow, { onConflict: "source,token_hash" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: rowToRule(data as DbSourcingConversionRuleRow) });
}
