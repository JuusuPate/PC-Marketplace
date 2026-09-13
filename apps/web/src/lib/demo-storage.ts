import type { DemoOrder, DemoUser, Listing, PrivatePickupAddress } from "../types";

const SESSION_KEY = "pc-marketplace.demo-session";
const LISTINGS_KEY = "pc-marketplace.demo-listings";
const ORDERS_KEY = "pc-marketplace.demo-orders";
const FAVOURITES_KEY = "pc-marketplace.demo-favourites";
const PICKUP_ADDRESSES_KEY = "pc-marketplace.demo-private-pickup-addresses";

export const DEMO_LISTINGS_MAX_SERIALIZED_CHARACTERS = 3_000_000;

interface DemoPrivatePickupAddress {
  sellerId: string;
  address: PrivatePickupAddress;
}

export class DemoStorageQuotaError extends Error {
  constructor() {
    super("Paikallisen demon tallennustila on täynnä. Poista kuvia tai vanhoja ilmoituksia ja yritä uudelleen.");
    this.name = "DemoStorageQuotaError";
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  const serialized = JSON.stringify(value);
  if (key === LISTINGS_KEY && serialized.length > DEMO_LISTINGS_MAX_SERIALIZED_CHARACTERS) {
    throw new DemoStorageQuotaError();
  }

  try {
    window.localStorage.setItem(key, serialized);
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new DemoStorageQuotaError();
    }
    throw error;
  }
}

export const demoStorage = {
  getSession: () => read<DemoUser | null>(SESSION_KEY, null),
  setSession: (user: DemoUser | null) =>
    user ? write(SESSION_KEY, user) : window.localStorage.removeItem(SESSION_KEY),
  getListings: () => read<Listing[]>(LISTINGS_KEY, []),
  setListings: (listings: Listing[]) => write(LISTINGS_KEY, listings),
  getOrders: () => read<DemoOrder[]>(ORDERS_KEY, []),
  setOrders: (orders: DemoOrder[]) => write(ORDERS_KEY, orders),
  getFavourites: () => read<string[]>(FAVOURITES_KEY, []),
  setFavourites: (ids: string[]) => write(FAVOURITES_KEY, ids),
  getPrivatePickupAddress(listingId: string) {
    const addresses = read<Record<string, DemoPrivatePickupAddress>>(PICKUP_ADDRESSES_KEY, {});
    const stored = addresses[listingId];
    const session = read<DemoUser | null>(SESSION_KEY, null);
    return stored?.sellerId === session?.id ? stored.address : null;
  },
  setPrivatePickupAddress(listingId: string, sellerId: string, address: PrivatePickupAddress) {
    const session = read<DemoUser | null>(SESSION_KEY, null);
    if (session?.id !== sellerId) throw new Error("Vain ilmoituksen myyjä voi tallentaa nouto-osoitteen.");
    const addresses = read<Record<string, DemoPrivatePickupAddress>>(PICKUP_ADDRESSES_KEY, {});
    write(PICKUP_ADDRESSES_KEY, { ...addresses, [listingId]: { sellerId, address } });
  },
  removePrivatePickupAddress(listingId: string, sellerId?: string) {
    const addresses = read<Record<string, DemoPrivatePickupAddress>>(PICKUP_ADDRESSES_KEY, {});
    const session = read<DemoUser | null>(SESSION_KEY, null);
    if (addresses[listingId]?.sellerId !== session?.id || (sellerId && sellerId !== session?.id)) return;
    const next = { ...addresses };
    delete next[listingId];
    write(PICKUP_ADDRESSES_KEY, next);
  },
};
