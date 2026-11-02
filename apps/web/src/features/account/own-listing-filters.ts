import type { Listing } from "../../types";

export const OWN_LISTING_FILTERS = ["all", "active", "sold", "draft"] as const;
export type OwnListingFilter = (typeof OWN_LISTING_FILTERS)[number];

/** Vanhoilta demotallennuksilta puuttuva tila tarkoittaa julkaistua ilmoitusta.
 * Varatut ja poistetut säilyvät Kaikki-näkymässä, mutta eivät kasvata aktiivisten määrää. */
export function matchesOwnListingFilter(listing: Listing, filter: OwnListingFilter): boolean {
  return filter === "all" || (listing.status ?? "active") === filter;
}

/** Määrät lasketaan koko omasta historiasta, eivät valitusta tulosjoukosta. */
export function countOwnListings(listings: Listing[]): Record<OwnListingFilter, number> {
  return Object.fromEntries(
    OWN_LISTING_FILTERS.map((filter) => [
      filter,
      listings.filter((listing) => matchesOwnListingFilter(listing, filter)).length,
    ]),
  ) as Record<OwnListingFilter, number>;
}
