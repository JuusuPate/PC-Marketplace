export type Locale = "fi" | "sv" | "da" | "nb" | "en";
export type Currency = "EUR" | "SEK" | "DKK" | "NOK";
export type CountryCode = "FI" | "SE" | "DK" | "NO";
export type Category =
  "gpu" | "cpu" | "memory" | "motherboard" | "pc" | "other" | "psu" | "storage" | "case" | "cooling" | "fans";
export type Condition = "new" | "excellent" | "good" | "fair";
export type ListingStatus = "draft" | "active" | "reserved" | "sold" | "removed";
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

/**
 * Julkinen ilmoitusmalli kortteja, hakuja ja tuotesivua varten.
 * Hintayksikkö on sentti ja specs-avaimet ovat pysyviä tunnisteita. Yksityinen osoite pidetään eri mallissa.
 */
export interface Listing {
  catalogModelId?: string | null;
  id: string;
  /** Persisted publication state. Legacy demo listings default to active. */
  status?: ListingStatus;
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
  /** Actual publication time; drafts may have no value. */
  publishedAt?: string | null;
  visual: "lime" | "blue" | "violet" | "orange" | "silver" | "pink";
  /** Optional for backwards compatibility with previously saved demo listings. */
  images?: ListingImage[];
}

/**
 * Käyttöliittymän yhteinen käyttäjämalli sekä demolle että Authista muunnetulle käyttäjälle.
 * role ohjaa UI:n näkyvyyttä; palvelin varmistaa oikeudet omasta suojatusta roolitaulustaan.
 */
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

/**
 * Selaimeen tallennettava esimerkkitilaus. paid on demon tila, ei oikean maksupalvelun vahvistus.
 */
export interface DemoOrder {
  id: string;
  listingId: string;
  title: string;
  totalMinor: number;
  currency: Currency;
  status: "paid" | "shipping" | "inspection";
  createdAt: string;
}
