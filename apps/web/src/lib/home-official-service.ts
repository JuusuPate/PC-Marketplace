import { listingService } from "./listing-service";
import { supabase } from "./supabase";
import { activeHomeListings, newestHomeListings } from "./home-recommendations";

export async function loadOfficialListings(offset = 0) {
  // Demo roles are editable in the browser and must never certify an official seller.
  if (!supabase) return { listings: [], hasMore: false, nextOffset: 0 };
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
