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

test("isIngredientsToggleEnabled enables interactive toggle for Menu items when at least 1 ingredient exists", () => {
  expect(isIngredientsToggleEnabled("Menu", ["a"])).toBe(true);
});

test("isIngredientsToggleEnabled disables interactive toggle for Menu items with no ingredients", () => {
  expect(isIngredientsToggleEnabled("Menu", [])).toBe(false);
});

test("isIngredientsToggleEnabled disables interactive toggle for Pantry items", () => {
  expect(isIngredientsToggleEnabled("Pantry", ["a", "b", "c", "d"])).toBe(false);
});
