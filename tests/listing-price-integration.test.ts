import { beforeEach, expect, it, vi } from "vitest";
import { listingService } from "../apps/web/src/lib/listing-service";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));
const id = "00000000-0000-4000-8000-000000000001";
const model = "00000000-0000-4000-8000-000000000002";
const row = {
  id,
  catalog_model_id: model,
  status: "active",
  title: "RTX 3080",
  description: "Test description",
  category: "gpu",
  condition: "good",
  price_minor: 10000,
  currency: "EUR",
  city: "Mikkeli",
  specs: {},
  is_featured: false,
  created_at: "2026-11-01T12:00:00Z",
  published_at: "2026-11-01T12:00:00Z",
  seller: { id: "seller", display_name: "Seller", country_code: "FI", joined_at: "2025-01-01T00:00:00Z", reviews: [] },
  destinations: [{ country_code: "FI" }],
  images: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  const query: Record<string, any> = {};
  for (const key of ["select", "eq", "order", "in"]) query[key] = vi.fn(() => query);
  query.range = vi.fn(async () => ({ data: [row], error: null }));
  query.then = (resolve: any) => Promise.resolve({ data: [row], error: null }).then(resolve);
  query.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({
    data: [{ id, catalog_model_id: model, condition: "good", price_minor: 10000, price_signal: "fair" }],
    error: null,
  });
});
it("public list, favourite IDs and direct listing reads all request a real price signal", async () => {
  for (const load of [
    () => listingService.listActive(),
    () => listingService.getActiveByIds([id]),
    async () => [await listingService.getActiveById(id)],
  ]) {
    const result = await load();
    expect(result[0]?.priceSignal).toBe("fair");
  }
  expect(mocks.rpc).toHaveBeenCalledTimes(3);
});
it("keeps listings readable when market data is unavailable and never inserts a fair default", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  expect((await listingService.listActive())[0]).toMatchObject({ id, priceSignal: null });
  expect(await listingService.getActiveById(id)).toMatchObject({ id, priceSignal: null });
});
it("does not reuse a badge after a price edit, and market failure cannot undo a saved listing", async () => {
  const listing = (await listingService.listActive())[0];
  expect(listing.priceSignal).toBe("fair");
  mocks.rpc.mockImplementation(async (name) =>
    name === "update_listing_details" ? { data: null, error: null } : { data: null, error: { code: "offline" } },
  );
  const saved = await listingService.update({ ...listing, priceMinor: 50000 }, "FI");
  expect(saved).toMatchObject({ id, priceMinor: 50000, priceSignal: null });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "update_listing_details",
    expect.objectContaining({ p_listing_id: id, p_price_minor: 50000 }),
  );
});
