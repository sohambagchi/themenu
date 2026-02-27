import { expect, test } from "bun:test";

import {
  formatIngredientsLine,
  isIngredientsToggleEnabled
} from "../src/lib/menuIngredientsToggle";

test("formatIngredientsLine returns first 3 ingredients plus +n when collapsed", () => {
  const ingredients = ["a", "b", "c", "d", "e"];

  expect(formatIngredientsLine(ingredients, false)).toBe("a, b, c +2");
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
