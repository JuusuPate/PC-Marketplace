import { SIMULATED_LISTINGS, DEMO_RIGI_SELLER_ID } from "../data/simulated-listings";
import { listingService } from "./listing-service";
import { supabase } from "./supabase";
import { activeHomeListings, newestHomeListings } from "./home-recommendations";

export async function loadOfficialListings(offset = 0) {
  // Only bundled, explicitly simulated fixtures; never trust browser session roles.
  if (!supabase) {
    const listings = SIMULATED_LISTINGS.filter((item) => item.seller.id === DEMO_RIGI_SELLER_ID).slice(
      offset,
      offset + 50,
    );
    return { listings, hasMore: false, nextOffset: offset + listings.length };
  }
  const { data, error } = await supabase.rpc("get_rigi_listing_ids", { p_limit: 50, p_offset: offset });
  if (error) throw error;
  if (
    !Array.isArray(data) ||
    data.length > 50 ||
    data.some(
      (row) =>
        !row ||
        typeof row.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id),
    )
  )
    throw new Error("Invalid official listing response");
  const listings = await listingService.getActiveByIds(data.map((row) => row.id));
  return {
    listings: newestHomeListings(activeHomeListings(listings)),
    hasMore: data.length === 50,
    nextOffset: offset + data.length,
  };
}
