import type { Listing } from "../types";
import { supabase } from "./supabase";

/** Hinta-arvio on lisätieto: puuttuva RPC, verkkovirhe tai virheellinen vastaus
 * piilottaa tagin mutta ei estä ilmoitusten lukemista tai onnistunutta tallennusta.
 * Erät estävät N+1-haut. Hinta/malli/kunto tarkistetaan myös kilpailutilanteen varalta. */
export async function applyListingPriceSignals(listings: Listing[]): Promise<Listing[]> {
  const result: Listing[] = listings.map((listing) => ({ ...listing, priceSignal: null }));
  const client = supabase;
  if (!client) return result;
  const eligible = result.filter(
    (listing) => listing.catalogModelId && listing.currency === "EUR" && listing.status === "active",
  );
  for (let offset = 0; offset < eligible.length; offset += 200) {
    const batch = eligible.slice(offset, offset + 200);
    try {
      const { data, error } = await client.rpc("get_listing_price_signals", {
        p_listing_ids: batch.map((listing) => listing.id),
      });
      if (error || !Array.isArray(data) || data.length > batch.length) continue;
      const byId = new Map(batch.map((listing) => [listing.id, listing]));
      const seen = new Set<string>();
      const matches: Listing[] = [];
      let valid = true;
      for (const row of data) {
        const listing = row && typeof row.id === "string" ? byId.get(row.id) : undefined;
        if (
          !listing ||
          seen.has(row.id) ||
          row.price_signal !== "fair" ||
          !Number.isSafeInteger(row.price_minor) ||
          row.price_minor <= 0 ||
          row.price_minor !== listing.priceMinor ||
          row.catalog_model_id !== listing.catalogModelId ||
          row.condition !== listing.condition
        ) {
          valid = false;
          break;
        }
        seen.add(row.id);
        matches.push(listing);
      }
      if (valid)
        matches.forEach((listing) => {
          listing.priceSignal = "fair";
        });
    } catch {
      // Epävarma hintavertailu ei saa tuottaa oletusarvoista "reilu hinta" -väitettä.
    }
  }
  return result;
}
