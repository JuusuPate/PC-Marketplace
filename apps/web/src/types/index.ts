export type Locale = "fi" | "sv" | "da" | "nb" | "en";
export type Currency = "EUR" | "SEK" | "DKK" | "NOK";
export type CountryCode = "FI" | "SE" | "DK" | "NO";
export type Category = "gpu" | "cpu" | "memory" | "motherboard" | "pc" | "other";
export type Condition = "new" | "excellent" | "good" | "fair";
export type PriceSignal = "great" | "fair" | "high";

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

export interface Listing {
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
  buyerProtection: boolean;
  serialVerified: boolean;
  createdLabel: string;
  visual: "lime" | "blue" | "violet" | "orange" | "silver" | "pink";
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  countryCode: CountryCode;
  locale: Locale;
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
