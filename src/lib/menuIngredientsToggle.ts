const DEFAULT_INGREDIENT_LIMIT = 3;

export function formatIngredientsLine(
  ingredients: string[],
  expanded: boolean,
  limit = DEFAULT_INGREDIENT_LIMIT
): string {
  if (expanded || ingredients.length <= limit) {
    return ingredients.join(", ");
  }

  const hiddenCount = ingredients.length - limit;
  const visibleIngredients = ingredients.slice(0, limit).join(", ");
  return `${visibleIngredients} +${hiddenCount}`;
}

export function isIngredientsToggleEnabled(
  inventoryLabel: "Menu" | "Pantry",
  ingredients: string[]
): boolean {
  return inventoryLabel === "Menu" && ingredients.length > 0;
}
