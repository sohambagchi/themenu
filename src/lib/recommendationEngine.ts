import type { Item, RecommendationResult, TagValue } from "@/lib/types";

function toTagSet(tags: TagValue[]) {
  return new Set(tags.map((tag) => tag.toLowerCase().trim()));
}

function hasTag(tags: Set<string>, ...values: string[]) {
  return values.some((value) => tags.has(value.toLowerCase()));
}

export function getRecommendations(
  selectedItem: Item,
  allItems: Item[],
  maxResults = 6
): RecommendationResult[] {
  const selectedTags = toTagSet(selectedItem.tags);

  const scored = allItems
    .filter((candidate) => candidate.id !== selectedItem.id && candidate.quantity > 0)
    .map((candidate) => {
      const candidateTags = toTagSet(candidate.tags);
      let score = 0;
      const reasons: string[] = [];

      if (selectedItem.type === "Protein" && hasTag(selectedTags, "dry")) {
        if (candidate.type === "Veg" || candidate.type === "Carb") {
          score += 30;
          reasons.push("Dry protein pairs with veg/carb sides.");
        }

        if (hasTag(candidateTags, "saucy", "wet", "gravy")) {
          score += 40;
          reasons.push("Saucy/Wet texture balances dry protein.");
        }
      }

      if (hasTag(selectedTags, "spicy") && hasTag(candidateTags, "cooling")) {
        score += 35;
        reasons.push("Cooling side offsets spicy heat.");
      }

      if (hasTag(selectedTags, "indian")) {
        if (hasTag(candidateTags, "indian")) {
          score += 25;
          reasons.push("Cuisine match: Indian with Indian.");
        }

        if (candidate.type === "Carb" && hasTag(candidateTags, "neutral")) {
          score += 18;
          reasons.push("Neutral starch is a safe Indian pairing.");
        }
      }

      if (selectedItem.type !== candidate.type) {
        score += 6;
      }

      const sharedTags = [...selectedTags].filter((tag) => candidateTags.has(tag));
      if (sharedTags.length > 0) {
        score += Math.min(12, sharedTags.length * 4);
      }

      if (candidate.quantity <= 1) {
        score -= 4;
      }

      return { item: candidate, score, reasons } satisfies RecommendationResult;
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    });

  return scored.slice(0, maxResults);
}
