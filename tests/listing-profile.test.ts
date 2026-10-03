import { describe, expect, it } from "vitest";
import type { Category, Listing } from "../apps/web/src/types";
import {
  displaySpecifications,
  generateListingTitle,
  initialProfileValues,
  isRgbListing,
  PC_PARTS,
  partStatusKey,
  profileErrors,
  readSpecification,
  serializeProfile,
} from "../apps/web/src/features/sell/listing-profile";
import { matchesMarketplaceFilters } from "../apps/web/src/features/catalog/marketplace-filters";
const title = (category: Category, brand: string, model: string, values: Record<string, string>) =>
  generateListingTitle(category, brand, model, values, "Pelikone", "fi");

describe("hybrid listing profiles", () => {
  it("combines GPU core, board maker and variant without duplicate brand prefixes", () => {
    expect(title("gpu", "MSI", "Gaming X Trio", { coreModel: "RTX 3080", vram: "10 GB" })).toBe(
      "MSI Gaming X Trio RTX 3080 10 GB",
    );
    expect(title("gpu", "MSI", "MSI Gaming X Trio", { coreModel: "RTX 3080", vram: "10 GB" })).toBe(
      "MSI Gaming X Trio RTX 3080 10 GB",
    );
  });
  it("builds a useful RAM title without a part number and catches contradictory kit capacities", () => {
    const values = {
      capacity: "32",
      modules: "2",
      moduleCapacity: "16",
      memoryType: "DDR4",
      speed: "3200",
      latency: "16",
    };
    expect(title("memory", "Kingston", "Fury Beast", values)).toBe(
      "Kingston Fury Beast 32 GB (2×16 GB) DDR4 3200 MHz CL16",
    );
    expect(profileErrors("memory", values, "fi", false)).toEqual([]);
    expect(profileErrors("memory", { ...values, capacity: "64 GB" }, "fi", false)).toHaveLength(1);
  });
  it.each([
    ["cpu", { socket: "AM5" }, "AM5"],
    ["motherboard", { chipset: "B650", formFactor: "ATX" }, "B650 ATX"],
    ["storage", { capacity: "1 TB", storageType: "NVMe SSD", pcieGeneration: "Gen4" }, "1 TB NVMe SSD"],
    ["psu", { wattage: "750", efficiency: "80+ Gold" }, "750 W 80+ Gold"],
    ["case", { formFactor: "ATX" }, "ATX kotelo"],
    ["cooling", { coolingType: "AIO", socket: "AM5" }, "AIO AM5"],
    ["fans", { fanSize: "120", fanControl: "PWM", fanCount: "3", fanLighting: "ARGB" }, "Acme Model"],
    ["other", {}, "Acme Model"],
  ] as [Category, Record<string, string>, string][])("uses the %s title profile", (category, values, suffix) => {
    expect(title(category, "Acme", "Model", values)).toContain(suffix);
    expect(title(category, "A".repeat(90), "B".repeat(90), values).length).toBeLessThanOrEqual(100);
  });
  it("omits absent parts from titles and saved details while explicitly publishing their state", () => {
    const values: Record<string, string> = Object.fromEntries(PC_PARTS.map((p) => [partStatusKey(p.key), "unknown"]));
    Object.assign(values, {
      processor: "Ryzen 5 5600",
      componentStatus_processor: "included",
      graphicsCard: "RTX 4080",
      componentStatus_graphicsCard: "missing",
      memory: "Stale RAM",
      pcMemoryCapacity: "64",
      componentStatus_memory: "missing",
      rgb: "yes",
    });
    expect(title("pc", "", "", values)).toBe("Keskeneräinen kokoonpano Ryzen 5 5600 RGB");
    expect(profileErrors("pc", values, "fi", false)).toEqual([]);
    const saved = serializeProfile("pc", values, "fi");
    expect(saved.graphicsCard).toBeUndefined();
    expect(saved.memory).toBeUndefined();
    expect(saved.pcMemoryCapacity).toBeUndefined();
    expect(saved.componentStatus_graphicsCard).toBe("missing");
    expect(displaySpecifications(saved, "fi")).toContainEqual(["Näytönohjain", "Puuttuu / ei mukana"]);
    expect(displaySpecifications(saved, "en")).toContainEqual(["Graphics card", "Missing / not included"]);
    expect(
      initialProfileValues({ category: "pc", specs: saved } as Listing, "pc", "fi").componentStatus_graphicsCard,
    ).toBe("missing");
    expect(profileErrors("pc", {}, "fi", false)).toHaveLength(PC_PARTS.length);
  });
  it("unknown-details mode drops stale parts but keeps RGB and shipping", () => {
    const saved = serializeProfile(
      "pc",
      { processor: "CPU", componentStatus_processor: "included", rgb: "yes", freeShipping: "Kyllä" },
      "fi",
      true,
    );
    expect(saved.processor).toBeUndefined();
    expect(saved.componentStatus_processor).toBe("unknown");
    expect(saved.rgb).toBe("yes");
    expect(saved.freeShipping).toBe("Kyllä");
  });
  it("reads old localized details and gives stable keys precedence", () => {
    const old = { Näyttömuisti: "8 GB", vram: "12 GB", Valmistaja: "ASUS", Malli: "TUF" };
    expect(readSpecification(old, "vram")).toBe("12 GB");
    expect(readSpecification(old, "brand")).toBe("ASUS");
    expect(initialProfileValues({ category: "gpu", specs: old } as Listing, "gpu", "en").vram).toBe("12 GB");
  });
  it("filters RGB from explicit data, includes legacy ARGB fans and never guesses from titles", () => {
    const fixture = (category: Category, specs: Record<string, string>) =>
      ({ category, specs, priceMinor: 1000, title: "RGB product" }) as Listing;
    const filters = { minPrice: "", maxPrice: "", values: { rgb: ["yes"] } };
    expect(matchesMarketplaceFilters(fixture("pc", { rgb: "yes" }), filters)).toBe(true);
    expect(matchesMarketplaceFilters(fixture("fans", { "Tuulettimen valaistus": "ARGB" }), filters)).toBe(true);
    expect(matchesMarketplaceFilters(fixture("pc", {}), filters)).toBe(false);
    expect(isRgbListing(fixture("fans", { rgb: "no", fanLighting: "RGB" }))).toBe(false);
    expect(isRgbListing(fixture("cpu", { rgb: "yes" }))).toBe(false);
    expect(serializeProfile("fans", { fanLighting: "Ei valaistusta", rgb: "yes" }, "fi")).toEqual({});
  });
  it("starts with a blank title and omits chip vendors, GeForce and middle dots", () => {
    for (const category of ["gpu", "cpu", "memory", "psu", "storage", "case", "cooling", "fans", "pc"] as Category[])
      expect(title(category, "", "", {})).toBe("");
    expect(title("gpu", "NVIDIA", "", { coreModel: "GeForce RTX 3080", vram: "10 GB" })).toBe("RTX 3080 10 GB");
    expect(title("gpu", "AMD", "", { coreModel: "Radeon RX 6800 XT ·", vram: "16 GB" })).toBe(
      "Radeon RX 6800 XT 16 GB",
    );
  });
});
