import type { DemoOrder, DemoUser, Listing } from "../types";

const SESSION_KEY = "pc-marketplace.demo-session";
const LISTINGS_KEY = "pc-marketplace.demo-listings";
const ORDERS_KEY = "pc-marketplace.demo-orders";
const FAVOURITES_KEY = "pc-marketplace.demo-favourites";

function read<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
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
};
