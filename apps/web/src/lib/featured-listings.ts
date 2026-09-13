import type { Listing } from "../types";

export interface FeaturedEngagement {
  viewsLast7Days: number;
  favouritesLast7Days: number;
}

export type FeaturedEngagementByListingId = Readonly<Record<string, FeaturedEngagement>>;

const DEFAULT_EXPLORATION_RATE = 0.25;

function popularityWeight(listing: Listing, engagementById: FeaturedEngagementByListingId) {
  const engagement = engagementById[listing.id];
  const views = Math.log1p(Math.max(0, engagement?.viewsLast7Days ?? 0));
  const favourites = Math.log1p(Math.max(0, engagement?.favouritesLast7Days ?? 0));

  // Listings without analytics still receive a meaningful baseline. This lets new
  // listings compete before they have collected views or favourites.
  return 1 + views * 0.45 + favourites * 0.75;
}

function uniformIndex(length: number, random: () => number) {
  return Math.min(length - 1, Math.floor(Math.max(0, random()) * length));
}

function weightedIndex(
  listings: readonly Listing[],
  engagementById: FeaturedEngagementByListingId,
  random: () => number,
) {
  const weights = listings.map((listing) => popularityWeight(listing, engagementById));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) return uniformIndex(listings.length, random);

  let cursor = Math.max(0, random()) * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return index;
  }

  return listings.length - 1;
}

/**
 * Selects listings without duplicates. Most slots are popularity-weighted, while
 * exploration slots are uniformly random so new and less-viewed listings can be discovered.
 */
export function selectFeaturedListings(
  listings: readonly Listing[],
  engagementById: FeaturedEngagementByListingId,
  count = 3,
  random: () => number = Math.random,
  explorationRate = DEFAULT_EXPLORATION_RATE,
) {
  const pool = [...listings];
  const selected: Listing[] = [];
  const targetCount = Math.min(Math.max(0, count), pool.length);
  const safeExplorationRate = Math.min(1, Math.max(0, explorationRate));
  const explorationSlots =
    targetCount === 0 || safeExplorationRate === 0
      ? 0
      : Math.min(targetCount, Math.max(1, Math.round(targetCount * safeExplorationRate)));
  const selectionModes = Array.from({ length: targetCount }, (_, index) => index < explorationSlots);

  // Shuffle the modes so the exploration pick is not always placed in a smaller card.
  for (let index = selectionModes.length - 1; index > 0; index -= 1) {
    const swapIndex = uniformIndex(index + 1, random);
    [selectionModes[index], selectionModes[swapIndex]] = [selectionModes[swapIndex], selectionModes[index]];
  }

  while (selected.length < targetCount) {
    const exploring = selectionModes[selected.length];
    const index = exploring ? uniformIndex(pool.length, random) : weightedIndex(pool, engagementById, random);
    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected;
}
