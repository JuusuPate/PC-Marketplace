import { listingTimestamp, sortListingsByPublication } from "./listing-time";
import type { Category, Listing } from "../types";

export function activeHomeListings(listings: readonly Listing[]) {
  return [
    ...new Map(
      listings
        .filter(
          (item) =>
            (!item.status || item.status === "active") &&
            item.currency === "EUR" &&
            item.seller.countryCode === "FI" &&
            item.shipsTo.includes("FI"),
        )
        .map((item) => [item.id, item]),
    ).values(),
  ];
}
export function publicationTime(listing: Listing) {
  return listingTimestamp(listing) ?? 0;
}
export function newestHomeListings(listings: readonly Listing[]) {
  return sortListingsByPublication(activeHomeListings(listings), "newest");
}
function noise(id: string, seed: number) {
  let hash = seed >>> 0;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
/** Local, explainable ranking; no tracking service or role inference. */
export function recommendHomeListings(
  listings: readonly Listing[],
  favourites: readonly Listing[],
  viewedIds: readonly string[],
  userId: string | undefined,
  seed: number,
  now: number,
) {
  const candidates = activeHomeListings(listings).filter((item) => item.seller.id !== userId);
  const interests = new Map<Category, number>();
  const add = (category: Category, weight: number) =>
    interests.set(category, Math.min(12, (interests.get(category) ?? 0) + weight));
  for (const item of favourites) add(item.category, 4);
  for (const id of viewedIds.slice(0, 40)) {
    const item = listings.find((candidate) => candidate.id === id);
    if (item) add(item.category, 2);
  }
  const ranked = candidates.map((item) => ({
    item,
    score:
      (interests.get(item.category) ?? 0) +
      4 / (1 + Math.max(0, now - publicationTime(item)) / 86400000 / 7) +
      noise(item.id, seed) * 5,
  }));
  const selected: Listing[] = [];
  const categoryCounts = new Map<Category, number>();
  const sellerCounts = new Map<string, number>();
  while (ranked.length && selected.length < 48) {
    const score = ({ item, score }: (typeof ranked)[number]) =>
      score - (categoryCounts.get(item.category) ?? 0) * 1.5 - (sellerCounts.get(item.seller.id) ?? 0) * 0.75;
    ranked.sort((a, b) => score(b) - score(a) || a.item.id.localeCompare(b.item.id));
    const { item } = ranked.shift()!;
    selected.push(item);
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
    sellerCounts.set(item.seller.id, (sellerCounts.get(item.seller.id) ?? 0) + 1);
  }
  return selected;
}
