import type { CatalogNavigationFilter } from "../config/catalog";
import { DEMO_FEATURED_ENGAGEMENT } from "../data/demo-featured-engagement";
import type { FeaturedEngagementByListingId } from "./featured-listings";
import type { Listing } from "../types";

function gpuDescriptor(listing: Listing) {
  return [listing.title, listing.subtitle, ...Object.values(listing.specs)].join(" ").toLocaleLowerCase();
}

function matchesGpuChipVendor(listing: Listing, vendor: NonNullable<CatalogNavigationFilter["gpuChipVendor"]>) {
  if (listing.category !== "gpu") return false;

  const descriptor = gpuDescriptor(listing);
  return vendor === "nvidia"
    ? /\b(nvidia|geforce|rtx|gtx)\b/i.test(descriptor)
    : /\b(amd|radeon|rx[ -]?\d{3,4})\b/i.test(descriptor);
}

function featuredScore(listing: Listing) {
  const engagement = (DEMO_FEATURED_ENGAGEMENT as FeaturedEngagementByListingId)[listing.id];
  if (!engagement) return 0;
  return Math.log1p(engagement.viewsLast7Days) * 0.45 + Math.log1p(engagement.favouritesLast7Days) * 0.75;
}

function getFeaturedIds(listings: readonly Listing[]) {
  const explicitlyFeatured = listings.filter((listing) => listing.isFeatured);
  if (listings.some((listing) => listing.isFeatured !== undefined)) {
    return new Set(explicitlyFeatured.map((listing) => listing.id));
  }

  return new Set(
    [...listings]
      .sort((a, b) => featuredScore(b) - featuredScore(a))
      .slice(0, Math.min(3, listings.length))
      .map((listing) => listing.id),
  );
}

/**
 * Applies an allowlisted navigation preset to already market- and category-scoped listings.
 * Current rows use the server-owned featured flag. Legacy demo rows without that field
 * fall back to aggregate example engagement without changing the navigation contract.
 */
export function applyCatalogNavigationFilter(listings: readonly Listing[], filter: CatalogNavigationFilter | null) {
  if (!filter) return [...listings];

  const featuredIds = filter.featuredOnly ? getFeaturedIds(listings) : null;

  return listings.filter(
    (listing) =>
      (filter.maxPriceMinor === undefined || listing.priceMinor <= filter.maxPriceMinor) &&
      (!filter.gpuChipVendor || matchesGpuChipVendor(listing, filter.gpuChipVendor)) &&
      (!featuredIds || featuredIds.has(listing.id)),
  );
}
