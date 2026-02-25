import { afterEach, beforeAll, expect, mock, test } from "bun:test";

import { tokenKeyToHash } from "../src/lib/staging";

type JsonObject = Record<string, unknown>;

const state: {
  hasValidDashboardCredentials: (username: string, password: string) => boolean;
  isDashboardPublicReadEnabled: () => boolean;
  requireDashboardSession: () => Promise<boolean>;
  isAllowedRequestOrigin: () => boolean;
  getRequestIp: () => string;
  checkRateLimit: () => { allowed: boolean; retryAfterSeconds: number };
  supabaseGetResponse: { data: JsonObject[] | null; error: { message: string } | null };
  supabasePostResponse: { data: JsonObject | null; error: { message: string } | null };
  lastFromTable: string | null;
  lastUpsertRow: JsonObject | null;
  lastUpsertConflict: string | null;
} = {
  hasValidDashboardCredentials: () => true,
  isDashboardPublicReadEnabled: () => true,
  requireDashboardSession: async () => true,
  isAllowedRequestOrigin: () => true,
  getRequestIp: () => "127.0.0.1",
  checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  supabaseGetResponse: { data: [], error: null },
  supabasePostResponse: { data: null, error: null },
  lastFromTable: null,
  lastUpsertRow: null,
  lastUpsertConflict: null
};

function resetState() {
  state.hasValidDashboardCredentials = () => true;
  state.isDashboardPublicReadEnabled = () => true;
  state.requireDashboardSession = async () => true;
  state.isAllowedRequestOrigin = () => true;
  state.getRequestIp = () => "127.0.0.1";
  state.checkRateLimit = () => ({ allowed: true, retryAfterSeconds: 0 });
  state.supabaseGetResponse = { data: [], error: null };
  state.supabasePostResponse = { data: null, error: null };
  state.lastFromTable = null;
  state.lastUpsertRow = null;
  state.lastUpsertConflict = null;
}

mock.module("@/lib/dashboardAuth", () => ({
  hasValidDashboardCredentials: (username: string, password: string) =>
    state.hasValidDashboardCredentials(username, password),
  isDashboardPublicReadEnabled: () => state.isDashboardPublicReadEnabled(),
  requireDashboardSession: () => state.requireDashboardSession()
}));

mock.module("@/lib/origin", () => ({
  isAllowedRequestOrigin: () => state.isAllowedRequestOrigin()
}));

mock.module("@/lib/requestMeta", () => ({
  getRequestIp: () => state.getRequestIp()
}));

mock.module("@/lib/rateLimit", () => ({
  checkRateLimit: () => state.checkRateLimit()
}));

mock.module("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      state.lastFromTable = table;
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => state.supabaseGetResponse
            })
          })
        }),
        upsert: (row: JsonObject, options: { onConflict?: string }) => {
          state.lastUpsertRow = row;
          state.lastUpsertConflict = options?.onConflict ?? null;
          return {
            select: () => ({
              single: async () => state.supabasePostResponse
            })
          };
        }
      };
    }
  })
}));

let GET: (request: Request) => Promise<Response>;
let POST: (request: Request) => Promise<Response>;

beforeAll(async () => {
  const route = await import("../src/app/api/sourcing/conversions/route");
  GET = route.GET;
  POST = route.POST;
});

afterEach(() => {
  resetState();
});

test("GET returns 401 when public read is disabled and there is no session", async () => {
  state.isDashboardPublicReadEnabled = () => false;
  state.requireDashboardSession = async () => false;

  const response = await GET(new Request("http://localhost/api/sourcing/conversions?source=walmart"));
  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(401);
  expect(payload.error).toBe("Login required.");
});

test("GET returns active conversion rules for a source", async () => {
  state.supabaseGetResponse = {
    data: [
      {
        id: "rule-1",
        source: "walmart",
        token_key: "beef broth fire kettle",
        token_hash: "abcd1234",
        canonical_name: "beef broth",
        canonical_type: "Veg",
        canonical_location: "Pantry",
        canonical_tags: ["Wet"],
        embedded_multiplier_override: 4,
        is_active: true,
        created_at: "2026-02-25T00:00:00.000Z",
        updated_at: "2026-02-25T00:00:00.000Z"
      }
    ],
    error: null
  };

  const response = await GET(new Request("http://localhost/api/sourcing/conversions?source=walmart"));
  const payload = (await response.json()) as { rules: Array<{ id: string; canonicalName: string }> };

  expect(response.status).toBe(200);
  expect(state.lastFromTable).toBe("sourcing_conversion_rules");
  expect(payload.rules.length).toBe(1);
  expect(payload.rules[0]?.id).toBe("rule-1");
  expect(payload.rules[0]?.canonicalName).toBe("beef broth");
});

test("POST rejects invalid request origin", async () => {
  state.isAllowedRequestOrigin = () => false;

  const response = await POST(
    new Request("http://localhost/api/sourcing/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
  );
  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(403);
  expect(payload.error).toBe("Invalid request origin.");
});

test("POST returns 401 when inline credentials are invalid", async () => {
  state.requireDashboardSession = async () => false;
  state.hasValidDashboardCredentials = () => false;

  const response = await POST(
    new Request("http://localhost/api/sourcing/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "wrong",
        password: "wrong",
        rule: {
          source: "walmart",
          tokenKey: "beef broth",
          tokenHash: tokenKeyToHash("beef broth"),
          canonicalName: "beef broth",
          canonicalType: "Veg",
          canonicalLocation: "Pantry",
          canonicalTags: ["Wet"],
          embeddedMultiplierOverride: null
        }
      })
    })
  );
  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(401);
  expect(payload.error).toBe("Login required. Provide valid username/password.");
});

test("POST returns 400 for invalid rule payload", async () => {
  const response = await POST(
    new Request("http://localhost/api/sourcing/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: {
          source: "walmart",
          tokenKey: "beef broth",
          tokenHash: "wronghash",
          canonicalName: "beef broth",
          canonicalType: "Veg",
          canonicalLocation: "Pantry",
          canonicalTags: ["Wet"],
          embeddedMultiplierOverride: null
        }
      })
    })
  );
  const payload = (await response.json()) as { error?: string };

  expect(response.status).toBe(400);
  expect(payload.error).toBe("Invalid conversion rule payload.");
});

test("POST upserts a valid rule and returns normalized response", async () => {
  const tokenKey = "beef broth fire kettle";
  const tokenHash = tokenKeyToHash(tokenKey);
  state.supabasePostResponse = {
    data: {
      id: "rule-9",
      source: "walmart",
      token_key: tokenKey,
      token_hash: tokenHash,
      canonical_name: "beef broth",
      canonical_type: "Veg",
      canonical_location: "Pantry",
      canonical_tags: ["Wet"],
      embedded_multiplier_override: 4,
      is_active: true,
      created_at: "2026-02-25T01:00:00.000Z",
      updated_at: "2026-02-25T01:00:00.000Z"
    },
    error: null
  };

  const response = await POST(
    new Request("http://localhost/api/sourcing/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rule: {
          source: "walmart",
          tokenKey,
          tokenHash,
          canonicalName: "beef broth",
          canonicalType: "Veg",
          canonicalLocation: "Pantry",
          canonicalTags: ["Wet"],
          embeddedMultiplierOverride: 4
        }
      })
    })
  );

  const payload = (await response.json()) as {
    rule: { id: string; canonicalName: string; embeddedMultiplierOverride: number | null };
  };

  expect(response.status).toBe(200);
  expect(state.lastFromTable).toBe("sourcing_conversion_rules");
  expect(state.lastUpsertConflict).toBe("source,token_hash");
  expect(state.lastUpsertRow?.token_hash).toBe(tokenHash);
  expect(payload.rule.id).toBe("rule-9");
  expect(payload.rule.canonicalName).toBe("beef broth");
  expect(payload.rule.embeddedMultiplierOverride).toBe(4);
});
