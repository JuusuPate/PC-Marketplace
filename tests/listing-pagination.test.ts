import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ range: vi.fn(), order: vi.fn(), eq: vi.fn(), select: vi.fn(), from: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: mock, backendMode: "supabase" }));
import { listingService } from "../apps/web/src/lib/listing-service";
function row(i: number) {
  return {
    id: String(i),
    title: "Test GPU",
    description: "Example",
    category: "gpu",
    condition: "good",
    price_minor: 100,
    currency: "EUR",
    city: "Espoo",
    status: "active",
    is_featured: false,
    created_at: "2020-01-01",
    published_at: "2026-09-27",
    seller: { id: "seller", display_name: "Test seller", country_code: "FI", joined_at: "2020-01-01" },
    destinations: [{ country_code: "FI" }],
    images: [],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ["from", "select", "eq", "order"] as const) mock[key].mockReturnValue(mock);
});
describe("active listing pagination", () => {
  it("includes older listings past the first page and retains publication times", async () => {
    mock.range
      .mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => row(i)), error: null })
      .mockResolvedValueOnce({ data: [row(200)], error: null });
    const result = await listingService.listActive();
    expect(result).toHaveLength(201);
    expect(result[200]).toMatchObject({ id: "200", publishedAt: "2026-09-27", createdAt: "2020-01-01" });
    expect(mock.range.mock.calls).toEqual([
      [0, 199],
      [200, 399],
    ]);
    expect(mock.order).toHaveBeenCalledWith("published_at", { ascending: false, nullsFirst: false });
    expect(mock.order).toHaveBeenCalledWith("id", { ascending: true });
  });
  it("fails rather than silently presenting an incomplete catalogue when a later page fails", async () => {
    mock.range
      .mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, i) => row(i)), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("offline") });
    await expect(listingService.listActive()).rejects.toThrow("offline");
  });
});
