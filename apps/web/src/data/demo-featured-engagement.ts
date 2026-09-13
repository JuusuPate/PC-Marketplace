import type { FeaturedEngagementByListingId } from "../lib/featured-listings";

/**
 * Demo-only aggregate activity used by the featured-listing selector. In production,
 * these rolling seven-day totals should come from privacy-safe marketplace analytics.
 */
export const DEMO_FEATURED_ENGAGEMENT = {
  "rtx-4070-super": { viewsLast7Days: 1684, favouritesLast7Days: 94 },
  "rx-7900-xtx": { viewsLast7Days: 973, favouritesLast7Days: 49 },
  "ryzen-7800x3d": { viewsLast7Days: 1421, favouritesLast7Days: 87 },
  "gaming-pc-4080": { viewsLast7Days: 1168, favouritesLast7Days: 63 },
  "kingston-fury-ddr5": { viewsLast7Days: 648, favouritesLast7Days: 38 },
  "b650e-motherboard": { viewsLast7Days: 512, favouritesLast7Days: 24 },
  "keychron-q1-he": { viewsLast7Days: 431, favouritesLast7Days: 21 },
} satisfies FeaturedEngagementByListingId;
