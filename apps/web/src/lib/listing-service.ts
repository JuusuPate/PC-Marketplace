import type { Category, Condition, CountryCode, Currency, Listing } from "../types";
import { demoStorage } from "./demo-storage";
import { backendMode, supabase } from "./supabase";

interface DbListing {
  id: string;
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  price_minor: number;
  currency: Currency;
  city: string;
  specs: Record<string, string> | null;
  created_at: string;
  seller:
    | {
        id: string;
        display_name: string;
        country_code: CountryCode;
        joined_at: string;
      }
    | Array<{
        id: string;
        display_name: string;
        country_code: CountryCode;
        joined_at: string;
      }>;
  destinations: Array<{ country_code: CountryCode }>;
}

const visuals: Listing["visual"][] = ["lime", "blue", "violet", "orange", "silver", "pink"];

function visualFor(id: string) {
  const score = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return visuals[score % visuals.length];
}

function mapListing(row: DbListing): Listing {
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  const specs = row.specs ?? {};

  return {
    id: row.id,
    title: row.title,
    subtitle: Object.values(specs).slice(0, 2).join(" · ") || row.category.toUpperCase(),
    category: row.category,
    brand: row.title.split(" ")[0],
    priceMinor: row.price_minor,
    currency: row.currency,
    condition: row.condition,
    city: row.city,
    seller: {
      id: seller.id,
      name: seller.display_name,
      initials: seller.display_name.slice(0, 2).toUpperCase(),
      countryCode: seller.country_code,
      rating: 5,
      reviewCount: 0,
      completedSales: 0,
      verified: false,
      joinedYear: new Date(seller.joined_at).getFullYear(),
    },
    shipsTo: row.destinations.map((destination) => destination.country_code),
    specs,
    description: row.description,
    priceSignal: "fair",
    buyerProtection: true,
    serialVerified: false,
    createdLabel: new Date(row.created_at).toLocaleDateString(),
    visual: visualFor(row.id),
  };
}

export const listingService = {
  mode: backendMode,

  async listActive(): Promise<Listing[]> {
    if (!supabase) return demoStorage.getListings();

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id,title,description,category,condition,price_minor,currency,city,specs,created_at,seller:profiles!listings_seller_id_fkey(id,display_name,country_code,joined_at),destinations:listing_shipping_countries(country_code)",
      )
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(60);

    if (error) throw error;
    return ((data ?? []) as unknown as DbListing[]).map(mapListing);
  },

  async create(listing: Listing, marketCountryCode: CountryCode): Promise<Listing> {
    if (!supabase) return listing;

    const { data, error } = await supabase.rpc("create_listing", {
      p_market_country_code: marketCountryCode,
      p_title: listing.title,
      p_description: listing.description,
      p_category: listing.category,
      p_condition: listing.condition,
      p_price_minor: listing.priceMinor,
      p_currency: listing.currency,
      p_city: listing.city,
      p_specs: listing.specs,
      p_shipping_country_codes: listing.shipsTo,
    });

    if (error) throw error;
    return { ...listing, id: String(data) };
  },
};
