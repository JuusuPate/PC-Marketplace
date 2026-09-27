import { describe, expect, it } from "vitest";
import { formatListingAge, listingTimestamp, sortListingsByPublication } from "../apps/web/src/lib/listing-time";
import type { Listing } from "../apps/web/src/types";
const now = Date.parse("2026-09-27T12:00:00Z");
const age = (minutes: number) => ({ publishedAt: new Date(now - minutes * 60000).toISOString() });
describe("listing publication age", () => {
  it.each([
    [0, "0min"],
    [1, "1min"],
    [59, "59min"],
    [60, "1h"],
    [1439, "23h"],
    [1440, "1pv"],
    [2880, "2pv"],
    [10080, "7pv"],
    [11519, "7pv"],
    [11520, "19.9.2026"],
  ])("formats %i elapsed minutes as %s", (minutes, label) => {
    expect(formatListingAge(age(minutes), "fi", now)).toBe(label);
  });
  it("prefers publication to draft creation, supports legacy dates, and handles invalid/future dates", () => {
    expect(formatListingAge({ ...age(60), createdAt: "2020-01-01" }, "fi", now)).toBe("1h");
    expect(formatListingAge({ createdAt: age(2880).publishedAt }, "en", now)).toBe("2d");
    expect(formatListingAge({ publishedAt: "invalid", createdAt: age(60).publishedAt }, "fi", now)).toBe("1h");
    expect(formatListingAge({}, "fi", now)).toBe("—");
    expect(formatListingAge(age(-30), "fi", now)).toBe("0min");
    expect(listingTimestamp({ publishedAt: "invalid" })).toBeNull();
  });
  it("renders old dates in Helsinki, not the browser timezone", () => {
    expect(formatListingAge({ publishedAt: "2026-08-01T21:30:00Z" }, "fi", now)).toBe("2.8.2026");
  });
  it("sorts by the same publication timestamp, with stable ties and missing dates last", () => {
    const rows = [
      { id: "old", ...age(14400), createdAt: age(2).publishedAt },
      { id: "new", ...age(2), createdAt: "2020-01-01" },
      { id: "missing" },
      { id: "tie", ...age(2) },
    ] as Listing[];
    expect(sortListingsByPublication(rows, "newest").map((x) => x.id)).toEqual(["new", "tie", "old", "missing"]);
    expect(sortListingsByPublication(rows, "oldest").map((x) => x.id)).toEqual(["old", "new", "tie", "missing"]);
    expect(rows[0].id).toBe("old");
  });
});
