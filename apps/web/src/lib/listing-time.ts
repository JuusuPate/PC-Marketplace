import type { Listing, Locale } from "../types";

export function listingTimestamp(listing: Pick<Listing, "publishedAt" | "createdAt">): number | null {
  for (const value of [listing.publishedAt, listing.createdAt]) {
    const timestamp = value ? Date.parse(value) : NaN;
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}
export function formatListingAge(
  listing: Pick<Listing, "publishedAt" | "createdAt">,
  locale: Locale,
  now = Date.now(),
) {
  const timestamp = listingTimestamp(listing);
  if (timestamp === null) return "—";
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  const days = Math.floor(minutes / 1440);
  const units =
    locale === "fi"
      ? ["min", "h", "pv"]
      : locale === "sv"
        ? ["min", "h", "d"]
        : locale === "da" || locale === "nb"
          ? ["min", "t", "d"]
          : ["min", "h", "d"];
  if (minutes < 60) return `${minutes}${units[0]}`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}${units[1]}`;
  if (days <= 7) return `${days}${units[2]}`;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Helsinki",
  }).format(timestamp);
}
/** Missing dates always come last. Text labels never participate in sorting. */
export function sortListingsByPublication(listings: readonly Listing[], order: "newest" | "oldest") {
  const direction = order === "newest" ? -1 : 1;
  return [...listings].sort((a, b) => {
    const left = listingTimestamp(a),
      right = listingTimestamp(b);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    return direction * ((left ?? 0) - (right ?? 0)) || a.id.localeCompare(b.id);
  });
}
