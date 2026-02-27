const DEFAULT_INGREDIENT_LIMIT = 3;

function normalizeIngredientLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_INGREDIENT_LIMIT;
  }

  const parsedLimit = Math.floor(limit);
  if (parsedLimit <= 0) {
    return DEFAULT_INGREDIENT_LIMIT;
  }

  return parsedLimit;
}

export function formatIngredientsLine(
  ingredients: string[],
  expanded: boolean,
  limit = DEFAULT_INGREDIENT_LIMIT
): string {
  const normalizedLimit = normalizeIngredientLimit(limit);

  if (expanded || ingredients.length <= normalizedLimit) {
    return ingredients.join(", ");
  }

  const hiddenCount = ingredients.length - normalizedLimit;
  const visibleIngredients = ingredients.slice(0, normalizedLimit).join(", ");
  return `${visibleIngredients} +${hiddenCount}`;
}

export function formatDashboardIngredientsLabel(
  ingredients: string[],
  expanded: boolean,
  limit = DEFAULT_INGREDIENT_LIMIT
): string {
  return `Ingredients: ${formatIngredientsLine(ingredients, expanded, limit)}`;
}

export function isIngredientsToggleEnabled(
  inventoryLabel: "Menu" | "Pantry",
  ingredients: string[],
  limit = DEFAULT_INGREDIENT_LIMIT
): boolean {
  const normalizedLimit = normalizeIngredientLimit(limit);
  return inventoryLabel === "Menu" && ingredients.length > normalizedLimit;
}

export function toggleExpandedById(
  current: Record<string, boolean>,
  itemId: string
): Record<string, boolean> {
  const nextValue = !(current[itemId] ?? false);
  return { ...current, [itemId]: nextValue };
}

export function toggleSingleExpandedId(
  current: string | null,
  itemId: string
): string | null {
  if (current === null) {
    return itemId;
  }

  if (current === itemId) {
    return null;
  }

  return itemId;
}
