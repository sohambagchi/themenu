import { expect, test } from "bun:test";

import {
  formatDashboardIngredientsLabel,
  formatIngredientsLine,
  isIngredientsToggleEnabled,
  toggleExpandedById,
  toggleSingleExpandedId
} from "../src/lib/menuIngredientsToggle";

test("toggleExpandedById sets missing id to true and preserves unrelated ids", () => {
  const currentMap = { a: false, b: true };

  expect(toggleExpandedById(currentMap, "c")).toEqual({ a: false, b: true, c: true });
});

test("toggleExpandedById flips true to false for target id only", () => {
  const currentMap = { a: true, b: false };
  const snapshot = { ...currentMap };

  expect(toggleExpandedById(currentMap, "a")).toEqual({ a: false, b: false });
  expect(currentMap).toEqual(snapshot);
});

test("toggleExpandedById flips false to true for target id only", () => {
  const currentMap = { a: false, b: true };

  expect(toggleExpandedById(currentMap, "a")).toEqual({ a: true, b: true });
});

test("toggleExpandedById returns a new map instance", () => {
  const currentMap = { a: true };
  const nextMap = toggleExpandedById(currentMap, "a");

  expect(nextMap).not.toBe(currentMap);
});

test("toggleSingleExpandedId returns id when current is null", () => {
  expect(toggleSingleExpandedId(null, "item-1")).toBe("item-1");
});

test("toggleSingleExpandedId returns null when toggling same id", () => {
  expect(toggleSingleExpandedId("item-1", "item-1")).toBeNull();
});

test("toggleSingleExpandedId returns new id when toggling different id", () => {
  expect(toggleSingleExpandedId("item-1", "item-2")).toBe("item-2");
});

test("formatIngredientsLine returns first 3 ingredients plus +n when collapsed", () => {
  const ingredients = ["a", "b", "c", "d", "e"];

  expect(formatIngredientsLine(ingredients, false)).toBe("a, b, c +2");
  expect(formatDashboardIngredientsLabel(ingredients, false)).toBe("Ingredients: a, b, c +2");
});

test("formatIngredientsLine returns all ingredients joined with comma when expanded", () => {
  const ingredients = ["a", "b", "c", "d", "e"];

  expect(formatIngredientsLine(ingredients, true)).toBe("a, b, c, d, e");
});

test("formatIngredientsLine returns full list for short lists in collapsed and expanded states", () => {
  const ingredients = ["a", "b", "c"];

  expect(formatIngredientsLine(ingredients, false)).toBe("a, b, c");
  expect(formatIngredientsLine(ingredients, true)).toBe("a, b, c");
});

test("formatIngredientsLine returns empty string for empty ingredients in collapsed and expanded states", () => {
  const ingredients: string[] = [];

  expect(formatIngredientsLine(ingredients, false)).toBe("");
  expect(formatIngredientsLine(ingredients, true)).toBe("");
});

test("formatIngredientsLine respects a custom positive integer limit", () => {
  const ingredients = ["a", "b", "c", "d"];

  expect(formatIngredientsLine(ingredients, false, 2)).toBe("a, b +2");
  expect(formatIngredientsLine(ingredients, true, 2)).toBe("a, b, c, d");
});

test("formatIngredientsLine normalizes invalid limits to default and floors positive non-integers", () => {
  const ingredients = ["a", "b", "c", "d", "e"];

  expect(formatIngredientsLine(ingredients, false, 0)).toBe("a, b, c +2");
  expect(formatIngredientsLine(ingredients, false, -1)).toBe("a, b, c +2");
  expect(formatIngredientsLine(ingredients, false, Number.NaN)).toBe("a, b, c +2");
  expect(formatIngredientsLine(ingredients, false, Number.POSITIVE_INFINITY)).toBe("a, b, c +2");
  expect(formatIngredientsLine(ingredients, false, Number.NEGATIVE_INFINITY)).toBe("a, b, c +2");
  expect(formatIngredientsLine(ingredients, false, 2.9)).toBe("a, b +3");
});

test("isIngredientsToggleEnabled enables interactive toggle for Menu items when at least 1 ingredient exists", () => {
  expect(isIngredientsToggleEnabled("Menu", ["a"])).toBe(true);
});

test("isIngredientsToggleEnabled disables interactive toggle for Menu items with no ingredients", () => {
  expect(isIngredientsToggleEnabled("Menu", [])).toBe(false);
});

test("isIngredientsToggleEnabled disables interactive toggle for Pantry items", () => {
  expect(isIngredientsToggleEnabled("Pantry", ["a", "b", "c", "d"])).toBe(false);
});
