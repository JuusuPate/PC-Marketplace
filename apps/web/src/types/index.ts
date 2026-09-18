export type Locale = "fi" | "sv" | "da" | "nb" | "en";
export type Currency = "EUR" | "SEK" | "DKK" | "NOK";
export type CountryCode = "FI" | "SE" | "DK" | "NO";
export type Category =
  "gpu" | "cpu" | "memory" | "motherboard" | "pc" | "other" | "psu" | "storage" | "case" | "cooling";
export type Condition = "new" | "excellent" | "good" | "fair";
export type PriceSignal = "great" | "fair" | "high";
export type UserRole = "user" | "admin";
export type LegalPageSlug = "terms" | "privacy" | "accessibility" | "safety";

export interface Market {
  countryCode: CountryCode;
  defaultLocale: Locale;
  currency: Currency;
  flag: string;
  name: string;
  status: "live" | "beta" | "soon";
  feePercent: number;
  shippingPartners: string[];
}

export interface Seller {
  id: string;
  name: string;
  initials: string;
  countryCode: CountryCode;
  rating: number;
  reviewCount: number;
  completedSales: number;
  verified: boolean;
  joinedYear: number;
}

export interface ListingImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  sortOrder: number;
  /** Supabase Storage object path. Demo images intentionally omit this. */
  storagePath?: string;
}

/**
 * Private fulfilment data. Never expose this through a public Listing or Seller.
 * The public listing location remains the municipality-level `Listing.city`.
 */
export interface PrivatePickupAddress {
  streetAddress: string;
  postalCode: string;
  city: string;
  countryCode: CountryCode;
}

export interface Listing {
  catalogModelId?: string | null;
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  brand: string;
  priceMinor: number;
  currency: Currency;
  condition: Condition;
  city: string;
  seller: Seller;
  shipsTo: CountryCode[];
  specs: Record<string, string>;
  description: string;
  priceSignal: PriceSignal;
  /** Server-owned promotion flag. Demo data may set this explicitly for navigation previews. */
  isFeatured?: boolean;
  buyerProtection: boolean;
  serialVerified: boolean;
  createdLabel: string;
  /** ISO timestamp used for deterministic sorting. Optional for legacy locally saved demo listings. */
  createdAt?: string;
  visual: "lime" | "blue" | "violet" | "orange" | "silver" | "pink";
  /** Optional for backwards compatibility with previously saved demo listings. */
  images?: ListingImage[];
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  countryCode: CountryCode;
  locale: Locale;
  role: UserRole;
  /** Convenience default for the seller form; never copy this onto a public Listing. */
  pickupAddress?: PrivatePickupAddress;
}

export interface LegalPageContent {
  slug: LegalPageSlug;
  locale: Locale;
  title: string;
  summary: string;
  body: string;
  updatedAt: string | null;
}

export interface DemoOrder {
  id: string;
  listingId: string;
  title: string;
  totalMinor: number;
  currency: Currency;
  status: "paid" | "shipping" | "inspection";
  createdAt: string;
}
