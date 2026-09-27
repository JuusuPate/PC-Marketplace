import { describe, expect, it } from "vitest";
import { createSimulatedListings, DEMO_RIGI_SELLER_ID } from "../apps/web/src/data/simulated-listings";
describe("simulated inventory", () => {
  it("creates 100 unique, clearly simulated active Finnish products across every product group", () => {
    const products = createSimulatedListings(Date.parse("2026-09-27T12:00:00Z"));
    expect(products).toHaveLength(100);
    expect(new Set(products.map((item) => item.id)).size).toBe(100);
    expect(new Set(products.map((item) => item.category)).size).toBe(10);
    expect(
      products.every(
        (item) =>
          item.title.includes("Demo") &&
          item.status === "active" &&
          item.currency === "EUR" &&
          item.seller.countryCode === "FI" &&
          Number.isInteger(item.priceMinor) &&
          item.priceMinor > 0,
      ),
    ).toBe(true);
    expect(products.filter((item) => item.seller.id === DEMO_RIGI_SELLER_ID)).toHaveLength(20);
  });
});
