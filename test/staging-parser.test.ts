import assert from "node:assert/strict";
import test from "node:test";

import { parseReceiptText, tokenizeReceiptName } from "../src/lib/staging";
import type { SourcingConversionRule } from "../src/lib/types";

const SAMPLE_RECEIPT = `Feb 23, 2026 order
Order# 2000146-63547968

Latitude 45 Cold Smoked Atlantic Salmon, 4 oz. Serving size 2 oz, 2 Servings per Container

Unavailable Qty 1

$5.83

Fresh Banana, Each

Weight-adjusted Qty 5

$0.88

(4 pack) Kettle & Fire Beef Cooking Broth, Shelf-Stable, 32 oz

Shopped Qty 1

$15.92

Subtotal

$60.34

Driver tip

$5.95

Total

$68.07`;

test("parseReceiptText parses walmart item rows and ignores summary rows", () => {
  const staged = parseReceiptText(SAMPLE_RECEIPT);
  assert.equal(staged.length, 3);

  const banana = staged.find((line) => line.rawName.toLowerCase().includes("banana"));
  assert.ok(banana);
  assert.equal(banana.lineQuantity, 5);
  assert.equal(banana.quantity, 5);
  assert.equal(banana.parseState, "needs_review");
});

test("parseReceiptText marks unavailable rows as ignored", () => {
  const staged = parseReceiptText(SAMPLE_RECEIPT);
  const salmon = staged.find((line) => line.rawName.toLowerCase().includes("salmon"));
  assert.ok(salmon);
  assert.equal(salmon.status, "unavailable");
  assert.equal(salmon.parseState, "ignored");
});

test("parseReceiptText applies embedded pack count to effective quantity", () => {
  const staged = parseReceiptText(SAMPLE_RECEIPT);
  const broth = staged.find((line) => line.rawName.toLowerCase().includes("broth"));
  assert.ok(broth);
  assert.equal(broth.lineQuantity, 1);
  assert.equal(broth.embeddedPackCount, 4);
  assert.equal(broth.effectiveQuantity, 4);
  assert.equal(broth.quantity, 4);
});

test("parseReceiptText applies confirmed conversion rules by token hash", () => {
  const tokenized = tokenizeReceiptName("(4 pack) Kettle & Fire Beef Cooking Broth, Shelf-Stable, 32 oz");

  const rule: SourcingConversionRule = {
    id: "rule-1",
    source: "walmart",
    tokenKey: tokenized.tokenKey,
    tokenHash: tokenized.tokenHash,
    canonicalName: "beef broth",
    canonicalType: "Veg",
    canonicalLocation: "Pantry",
    canonicalTags: ["Wet"],
    embeddedMultiplierOverride: 4,
    isActive: true,
    createdAt: "2026-02-25T00:00:00.000Z",
    updatedAt: "2026-02-25T00:00:00.000Z"
  };

  const staged = parseReceiptText(SAMPLE_RECEIPT, [rule], "walmart");
  const broth = staged.find((line) => line.tokenHash === tokenized.tokenHash);
  assert.ok(broth);
  assert.equal(broth.parseState, "resolved");
  assert.equal(broth.name, "beef broth");
  assert.equal(broth.matchedRuleId, "rule-1");
});
