import type { QuantityUnit } from "@/lib/types";

export const QUANTITY_UNITS: QuantityUnit[] = ["", "lb", "fl oz", "oz", "g", "kg", "ml", "l", "tbsp", "cups"];
const QUANTITY_UNIT_SET = new Set<QuantityUnit>(QUANTITY_UNITS);

const DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;
const FRACTION_RE = /^(\d+)\s*\/\s*(\d+)$/;
const MIXED_RE = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/;

export function normalizeQuantityUnit(raw: unknown): QuantityUnit | null {
  const value = typeof raw === "string" ? (raw.trim().toLowerCase() as QuantityUnit) : "";
  return QUANTITY_UNIT_SET.has(value) ? value : null;
}

export function normalizeQuantityValue(value: number) {
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 1000) / 1000;
}

export function parseQuantityInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const mixed = value.match(MIXED_RE);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (denominator <= 0) return null;
    return normalizeQuantityValue(whole + numerator / denominator);
  }

  const fraction = value.match(FRACTION_RE);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (denominator <= 0) return null;
    return normalizeQuantityValue(numerator / denominator);
  }

  if (!DECIMAL_RE.test(value)) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return normalizeQuantityValue(numeric);
}

export function parseQuantityUnknown(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return normalizeQuantityValue(raw);
  }
  if (typeof raw === "string") {
    return parseQuantityInput(raw);
  }
  return null;
}

export function formatQuantityValue(value: number) {
  const normalized = normalizeQuantityValue(value);
  if (!Number.isFinite(normalized)) return "0";

  const whole = Math.trunc(normalized);
  const fraction = normalized - whole;
  const candidates = [2, 3, 4, 8, 16];
  for (const denominator of candidates) {
    const numerator = Math.round(fraction * denominator);
    const approximation = whole + numerator / denominator;
    if (Math.abs(approximation - normalized) > 0.001) continue;
    if (numerator === 0) return String(whole);
    if (numerator === denominator) return String(whole + 1);
    if (whole === 0) return `${numerator}/${denominator}`;
    return `${whole} ${numerator}/${denominator}`;
  }

  if (Number.isInteger(normalized)) return String(normalized);
  return normalized.toFixed(3).replace(/\.?0+$/, "");
}

export function formatQuantityWithUnit(value: number, unit: QuantityUnit) {
  const quantityText = formatQuantityValue(value);
  return unit ? `${quantityText} ${unit}` : quantityText;
}

export const QUANTITY_UNIT_OPTIONS: Array<{ value: QuantityUnit; label: string }> = [
  { value: "", label: "(blank)" },
  { value: "lb", label: "lb" },
  { value: "fl oz", label: "fl oz" },
  { value: "oz", label: "oz" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
  { value: "tbsp", label: "tbsp" },
  { value: "cups", label: "cups" }
];
