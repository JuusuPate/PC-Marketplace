import type { Category, Listing } from "../types";
import gpu from "../assets/listings/rtx-4070-super.png";
import amdGpu from "../assets/listings/rx-7900-xtx.png";
import cpu from "../assets/listings/ryzen-7800x3d.png";
import memory from "../assets/listings/kingston-fury-ddr5.png";
import motherboard from "../assets/listings/b650e-motherboard.png";
import pc from "../assets/listings/gaming-pc-4080.png";
import keyboard from "../assets/listings/keychron-q1-he.png";
export const DEMO_RIGI_SELLER_ID = "simulated-rigi-seller";
const models: [Category, string, number, string?][] = [
  ["gpu", "GeForce RTX 4080", 74900, gpu],
  ["gpu", "GeForce RTX 4070 SUPER", 47900, gpu],
  ["gpu", "Radeon RX 7900 XTX", 59900, amdGpu],
  ["gpu", "GeForce RTX 3080", 32900, gpu],
  ["cpu", "AMD Ryzen 7 7800X3D", 28000, cpu],
  ["cpu", "AMD Ryzen 7 9800X3D", 44900, cpu],
  ["cpu", "Intel Core i5-13600K", 19000],
  ["motherboard", "ASUS ROG B650E", 18900, motherboard],
  ["motherboard", "MSI MAG Z790", 22000, motherboard],
  ["memory", "Kingston Fury 32 GB DDR5", 8500, memory],
  ["memory", "Corsair Vengeance 64 GB DDR5", 15900, memory],
  ["storage", "Samsung 990 PRO 1 TB NVMe", 7900],
  ["storage", "WD Black SN850X 2 TB NVMe", 12500],
  ["psu", "Corsair RM850x 850 W", 9900],
  ["case", "Fractal Design North", 10500],
  ["cooling", "Noctua NH-D15", 6500],
  ["pc", "Pelikone RTX 4080 / Ryzen 7", 159900, pc],
  ["pc", "Pelikone RTX 4070 / Core i5", 109900, pc],
  ["other", "Keychron Q1 HE", 12900, keyboard],
  ["other", "Logitech G Pro X Superlight", 6900],
];
// Illustrative specifications for the simulated listings only.
const modelSpecifications: Record<string, string>[] = [
  { "Piirin valmistaja": "NVIDIA", Näyttömuisti: "16 GB" },
  { "Piirin valmistaja": "NVIDIA", Näyttömuisti: "12 GB" },
  { "Piirin valmistaja": "AMD", Näyttömuisti: "24 GB" },
  { "Piirin valmistaja": "NVIDIA", Näyttömuisti: "10 GB" },
  { "Ytimet / säikeet": "8 / 16", Prosessorikanta: "AM5" },
  { "Ytimet / säikeet": "8 / 16", Prosessorikanta: "AM5" },
  { "Ytimet / säikeet": "14 / 20", Prosessorikanta: "LGA 1700" },
  { Koko: "ATX", "Wi-Fi": "Kyllä", Bluetooth: "Kyllä", Prosessorikanta: "AM5" },
  { Koko: "ATX", "Wi-Fi": "Ei", Bluetooth: "Ei", Prosessorikanta: "LGA 1700" },
  { Kapasiteetti: "32 GB", Muistityyppi: "DDR5", "Muistimoduulien määrä": "2", "Muistimoduulin koko": "DIMM" },
  { Kapasiteetti: "64 GB", Muistityyppi: "DDR5", "Muistimoduulien määrä": "2", "Muistimoduulin koko": "DIMM" },
  { Kapasiteetti: "1 TB", "Tallennuslaitteen tyyppi": "NVMe SSD", "Tallennuslaitteen koko": "M.2" },
  { Kapasiteetti: "2 TB", "Tallennuslaitteen tyyppi": "NVMe SSD", "Tallennuslaitteen koko": "M.2" },
  { "Teho (W)": "850 W", Hyötysuhdeluokitus: "80+ Gold", Koko: "ATX" },
  { Koko: "ATX" },
  { "Jäähdytyksen tyyppi": "Ilmajäähy", Prosessorikanta: "AM4, AM5, LGA 1200, LGA 1700" },
  {},
  {},
  {},
  {},
];
const cities = [
  "Helsinki",
  "Espoo",
  "Turku",
  "Oulu",
  "Tampere",
  "Vantaa",
  "Lahti",
  "Jyväskylä",
  "Kuopio",
  "Lappeenranta",
];
/** In-memory simulation only. No database writes or real seller identities. */
export function createSimulatedListings(now = Date.now()): Listing[] {
  return Array.from({ length: 100 }, (_, index) => {
    const [category, model, basePrice, image] = models[index % models.length];
    const official = [0, 5, 10, 16].includes(index % models.length);
    const id = `simulated-${String(index + 1).padStart(3, "0")}`;
    const createdAt = new Date(now - index * 43 * 60_000).toISOString();
    return {
      id,
      title: `${model} · Demo ${index + 1}`,
      subtitle: "Simuloitu esimerkkituote",
      category,
      brand: model.split(" ")[0],
      status: "active",
      priceMinor: Math.round((basePrice * (0.94 + (index % 7) * 0.02)) / 100) * 100,
      currency: "EUR",
      condition: index % 3 === 0 ? "new" : "excellent",
      city: cities[index % cities.length],
      seller: {
        id: official ? DEMO_RIGI_SELLER_ID : `simulated-seller-${index % 13}`,
        name: official ? "Rigi · Demo" : `Demomyyjä ${(index % 13) + 1}`,
        initials: official ? "RI" : "DM",
        countryCode: "FI",
        rating: 0,
        reviewCount: 0,
        completedSales: 0,
        verified: false,
        joinedYear: 2026,
      },
      shipsTo: ["FI"],
      specs: {
        Malli: model,
        ...modelSpecifications[index % models.length],
        "Ilmainen postitus": index % 4 === 0 ? "Kyllä" : "Ei",
      },
      description:
        "Simuloitu esimerkkituote sivuston ulkoasun ja toimintojen kokeiluun. Tämä ei ole oikea myynti-ilmoitus. Kuva on havainnollistava.",
      priceSignal: "fair",
      buyerProtection: false,
      serialVerified: false,
      createdLabel: `${Math.floor((index * 43) / 60)} h`,
      createdAt,
      publishedAt: createdAt,
      visual: "blue",
      images: image
        ? [
            {
              id: `${id}-image`,
              url: image,
              alt: `Havainnollistava demokuva: ${model}`,
              width: 1536,
              height: 1024,
              sortOrder: 0,
            },
          ]
        : [],
    };
  });
}
export const SIMULATED_LISTINGS = createSimulatedListings();
