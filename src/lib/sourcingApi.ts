import type { SourcingConversionRule, SourcingConversionRuleInput } from "@/lib/types";

export async function fetchSourcingConversionRules(source: string) {
  const response = await fetch(`/api/sourcing/conversions?source=${encodeURIComponent(source)}`, {
    method: "GET",
    cache: "no-store"
  });

  if (response.status === 401) {
    throw new Error("Login required to load sourcing conversions.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to load sourcing conversions.");
  }

  const payload = (await response.json()) as { rules: SourcingConversionRule[] };
  return payload.rules ?? [];
}

export async function upsertSourcingConversionRule(
  rule: SourcingConversionRuleInput,
  username?: string,
  password?: string
) {
  const payload: {
    rule: SourcingConversionRuleInput;
    username?: string;
    password?: string;
  } = { rule };

  if (username) payload.username = username;
  if (password) payload.password = password;

  const response = await fetch("/api/sourcing/conversions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.status === 401) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Login required to save sourcing conversion.");
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? "Failed to save sourcing conversion.");
  }

  const responsePayload = (await response.json()) as { rule: SourcingConversionRule };
  return responsePayload.rule;
}

export async function extractSourcingPdfText(file: File, source: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source", source);

  const response = await fetch("/api/sourcing/pdf-text", {
    method: "POST",
    body: formData
  });

  if (response.status === 401) {
    throw new Error("Login required to parse PDF receipts.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to parse PDF receipt.");
  }

  const payload = (await response.json()) as { text: string };
  return payload.text ?? "";
}
