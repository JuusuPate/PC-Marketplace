import { beforeEach, expect, it, vi } from "vitest";
import type { Listing } from "../apps/web/src/types";
import { applyListingPriceSignals } from "../apps/web/src/lib/listing-price-service";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
const listing = (id = "listing-1"): Listing =>
  ({
    id,
    catalogModelId: "model-1",
    status: "active",
    currency: "EUR",
    priceMinor: 10000,
    condition: "good",
    priceSignal: "great",
  }) as Listing;
const signal = (id = "listing-1") => ({
  id,
  catalog_model_id: "model-1",
  condition: "good",
  price_minor: 10000,
  price_signal: "fair",
});
beforeEach(() => vi.clearAllMocks());
it("only applies a matching server result, clears old signals and does not mutate its input", async () => {
  mocks.rpc.mockResolvedValue({ data: [signal()], error: null });
  const input = [listing(), listing("listing-2")];
  const result = await applyListingPriceSignals(input);
  expect(result.map((item) => item.priceSignal)).toEqual(["fair", null]);
  expect(input[0].priceSignal).toBe("great");
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_listing_price_signals", {
    p_listing_ids: ["listing-1", "listing-2"],
  });
});
it("missing data, network failure and unavailable RPC never claim a fair price", async () => {
  for (const response of [
    { data: [], error: null },
    { data: null, error: { code: "PGRST202" } },
    { data: {}, error: null },
  ]) {
    mocks.rpc.mockResolvedValue(response);
    expect((await applyListingPriceSignals([listing()]))[0].priceSignal).toBeNull();
  }
  mocks.rpc.mockRejectedValue(new Error("offline"));
  expect((await applyListingPriceSignals([listing()]))[0].priceSignal).toBeNull();
});
it("rejects stale prices, model/condition changes, duplicates, unknown IDs and malformed signals", async () => {
  for (const data of [
    [signal(), signal()],
    [null],
    [{ ...signal(), id: "foreign" }],
    [{ ...signal(), price_signal: "great" }],
    [{ ...signal(), price_minor: 10001 }],
    [{ ...signal(), price_minor: "10000" }],
    [{ ...signal(), price_minor: 0 }],
    [{ ...signal(), catalog_model_id: "other" }],
    [{ ...signal(), condition: "fair" }],
  ]) {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect((await applyListingPriceSignals([listing(), listing("second")]))[0].priceSignal).toBeNull();
  }
});
it("skips ineligible listings and batches at most 200 IDs", async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const input = Array.from({ length: 401 }, (_, i) => listing(`listing-${i}`));
  input.push(
    { ...listing(), catalogModelId: null },
    { ...listing(), status: "sold" },
    { ...listing(), currency: "SEK" },
  );
  expect((await applyListingPriceSignals(input)).every((item) => item.priceSignal === null)).toBe(true);
  expect(mocks.rpc.mock.calls.map((call) => call[1].p_listing_ids.length)).toEqual([200, 200, 1]);
});
