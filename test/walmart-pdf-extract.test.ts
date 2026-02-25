import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseReceiptText } from "../src/lib/staging";
import { extractTextFromWalmartPdf } from "../src/lib/walmartPdf";

test("extractTextFromWalmartPdf extracts readable text from walmart fixture", async () => {
  const pdf = readFileSync("test/walmart.pdf");
  const text = await extractTextFromWalmartPdf(pdf);

  assert.ok(text.length > 500);
  assert.ok(text.includes("Kettle & Fire Beef Cooking Broth"));
  assert.ok(text.includes("Weight-adjusted"));
  assert.ok(text.includes("Subtotal"));
});

test("parseReceiptText can parse JS-extracted walmart pdf text", async () => {
  const pdf = readFileSync("test/walmart.pdf");
  const text = await extractTextFromWalmartPdf(pdf);
  const staged = parseReceiptText(text);

  assert.ok(staged.length >= 15);

  const broth = staged.find((entry) => entry.rawName.includes("Kettle & Fire Beef Cooking Broth"));
  assert.ok(broth);
  assert.equal(broth.lineQuantity, 1);
  assert.equal(broth.embeddedPackCount, 4);
  assert.equal(broth.quantity, 4);
});
