import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getActiveByIds: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../apps/web/src/lib/listing-service", () => ({ listingService: { getActiveByIds: mocks.getActiveByIds } }));
import { loadOfficialListings } from "../apps/web/src/lib/home-official-service";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("official storefront service", () => {
  it("reads only server-certified IDs through the public listing service", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id }], error: null });
    mocks.getActiveByIds.mockResolvedValue([
      { id, status: "active", currency: "EUR", seller: { countryCode: "FI" }, shipsTo: ["FI"] },
    ]);
    const result = await loadOfficialListings(50);
    expect(mocks.rpc).toHaveBeenCalledWith("get_rigi_listing_ids", { p_limit: 50, p_offset: 50 });
    expect(mocks.getActiveByIds).toHaveBeenCalledWith([id]);
    expect(result).toMatchObject({ listings: [{ id }], hasMore: false, nextOffset: 51 });
  });
  it("fails closed on RPC failure or malformed identities", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(loadOfficialListings()).rejects.toMatchObject({ code: "PGRST202" });
    for (const data of [null, {}, [{ id: "forged" }], [null]]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(loadOfficialListings()).rejects.toThrow("Invalid official listing response");
    }
    expect(mocks.getActiveByIds).not.toHaveBeenCalled();
  });
  it("does not show listings that became unavailable before the second read", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id }], error: null });
    mocks.getActiveByIds.mockResolvedValue([]);
    expect((await loadOfficialListings()).listings).toEqual([]);
  });
});
