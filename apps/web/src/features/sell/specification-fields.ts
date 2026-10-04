import type { Category, Locale } from "../../types";

export interface GuidedSpecificationField {
  key: string;
  label: string;
  placeholder: string;
  options?: string[];
  suggestions?: string[];
}

interface SpecificationCopy {
  pcTitle: string;
  componentTitle: string;
  optionalTitle: string;
  pcHelp: string;
  componentHelp: string;
  optionalHelp: string;
  unknown: string;
  unknownHelp: string;
  required: string;
  optional: string;
  photoRequired: string;
  customDetails: string;
  fields: Record<string, [label: string, placeholder: string]>;
}

const englishCopy: SpecificationCopy = {
  pcTitle: "Gaming PC components",
  componentTitle: "Component specifications",
  optionalTitle: "Additional details",
  pcHelp: "Describe each component or mark it missing or unknown.",
  componentHelp: "Only relevant details are shown. Every field in this section is optional.",
  optionalHelp: "Add any useful product details you know.",
  unknown: "I don't know the specifications",
  unknownHelp: "You can still publish the listing and describe the computer in your own words.",
  required: "Required field",
  optional: "Optional",
  photoRequired: "Add at least one product photo.",
  customDetails: "Other technical details",
  fields: {
    coreModel: ["Chip model", "RTX 3080"],
    rgb: ["RGB lighting", "Yes / No"],
    pcFans: ["Case fans", "3 × 120 mm"],
    pcMemoryCapacity: ["Total RAM (GB)", "32"],
    pcMemoryType: ["RAM type", "DDR4"],
    pcMemoryModules: ["RAM module count", "2"],
    pcMemorySpeed: ["RAM speed (MHz)", "3200"],
    moduleCapacity: ["Capacity per module (GB)", "16"],
    latency: ["CAS latency (CL)", "16"],
    pcieGeneration: ["PCIe generation", "Gen4"],
    caseType: ["Case type", "Mid Tower"],
    color: ["Colour", "Black"],
    processor: ["Processor", "AMD Ryzen 7 7800X3D"],
    graphicsCard: ["Graphics card", "RTX 4070 Super"],
    memory: ["Memory (RAM)", "32 GB DDR5 6000 MHz"],
    storage: ["Storage", "1 TB NVMe SSD"],
    motherboard: ["Motherboard", "ASUS TUF Gaming B650-Plus"],
    powerSupply: ["Power supply", "750 W 80+ Gold"],
    case: ["Case", "Fractal Design North"],
    cooling: ["Cooling", "Noctua NH-D15"],
    fanSize: ["Fan size (mm)", "120"],
    fanConnector: ["Fan connector", "4-pin"],
    fanControl: ["Fan speed control", "PWM"],
    fanLighting: ["Fan lighting", "ARGB"],
    fanCount: ["Fan count", "1"],
    operatingSystem: ["Operating system", "Windows 11 Home"],
    chipVendor: ["Chip manufacturer", "NVIDIA / AMD / Intel"],
    modules: ["Memory module count", "2"],
    moduleFormat: ["Memory module format", "DIMM / SO-DIMM"],
    wifi: ["Wi-Fi", "Yes / No"],
    bluetooth: ["Bluetooth", "Yes / No"],
    storageType: ["Drive type", "NVMe SSD / SATA SSD / SATA HDD"],
    driveFormat: ["Drive size / form factor", 'M.2 / 2.5" / 3.5" / mSATA'],
    coolingType: ["Cooling type", "Air / AIO / Custom Loop"],
    wattage: ["Power (W)", "750 W"],
    efficiency: ["Efficiency rating", "80+ Gold"],
    freeShipping: ["Free shipping", "Yes / No"],
    vram: ["Video memory", "12 GB GDDR6X"],
    interface: ["Interface", "PCIe 4.0"],
    powerConnector: ["Power connector", "2 × 8-pin"],
    socket: ["Socket", "AM5"],
    cores: ["Core count", "8"],
    series: ["Series", "Ryzen 5 / Core i5"],
    threads: ["Thread count", "16"],
    clock: ["Clock speed", "4.2–5.0 GHz"],
    capacity: ["Capacity", "32 GB (2 × 16 GB)"],
    memoryType: ["Memory type", "DDR5"],
    speed: ["Speed", "6000 MHz CL30"],
    chipset: ["Chipset", "B650E"],
    formFactor: ["Form factor", "ATX"],
  },
};

const finnishCopy: SpecificationCopy = {
  pcTitle: "Pelikoneen komponentit",
  componentTitle: "Komponentin tekniset tiedot",
  optionalTitle: "Valinnaiset lisätiedot",
  pcHelp: "Kerro jokaisesta komponentista tai merkitse se puuttuvaksi tai tuntemattomaksi.",
  componentHelp: "Näytämme vain valitulle komponentille olennaiset tiedot. Kaikki kentät ovat vapaaehtoisia.",
  optionalHelp: "Lisää tuotteesta tiedossasi olevia hyödyllisiä lisätietoja.",
  unknown: "En tiedä teknisiä tietoja",
  unknownHelp: "Voit silti julkaista ilmoituksen ja kertoa pelikoneesta omin sanoin kuvauksessa.",
  required: "Pakollinen tieto",
  optional: "Vapaaehtoinen",
  photoRequired: "Lisää vähintään yksi tuotekuva.",
  customDetails: "Muut tekniset tiedot",
  fields: {
    coreModel: ["Piirimalli", "RTX 3080"],
    rgb: ["RGB-valaistus", "Kyllä / Ei"],
    pcFans: ["Kotelotuulettimet", "3 × 120 mm"],
    pcMemoryCapacity: ["RAM yhteensä (GB)", "32"],
    pcMemoryType: ["RAM-muistin tyyppi", "DDR4"],
    pcMemoryModules: ["RAM-moduulien määrä", "2"],
    pcMemorySpeed: ["RAM-nopeus (MHz)", "3200"],
    moduleCapacity: ["Moduulin kapasiteetti (GB)", "16"],
    latency: ["CAS-viive (CL)", "16"],
    pcieGeneration: ["PCIe-sukupolvi", "Gen4"],
    caseType: ["Kotelotyyppi", "Mid Tower"],
    color: ["Väri", "Musta"],
    processor: ["Prosessori", "AMD Ryzen 7 7800X3D"],
    graphicsCard: ["Näytönohjain", "RTX 4070 Super"],
    memory: ["Keskusmuisti (RAM)", "32 GB DDR5 6000 MHz"],
    storage: ["Tallennustila", "1 TB NVMe SSD"],
    motherboard: ["Emolevy", "ASUS TUF Gaming B650-Plus"],
    powerSupply: ["Virtalähde", "750 W 80+ Gold"],
    case: ["Kotelo", "Fractal Design North"],
    cooling: ["Jäähdytys", "Noctua NH-D15"],
    fanSize: ["Tuulettimen koko (mm)", "120"],
    fanConnector: ["Tuulettimen liitin", "4-pin"],
    fanControl: ["Tuulettimen nopeuden säätö", "PWM"],
    fanLighting: ["Tuulettimen valaistus", "ARGB"],
    fanCount: ["Tuulettimien määrä", "1"],
    operatingSystem: ["Käyttöjärjestelmä", "Windows 11 Home"],
    chipVendor: ["Piirisarja", "NVIDIA / AMD / Intel"],
    modules: ["Muistimoduulien määrä", "2"],
    moduleFormat: ["Muistimoduulin koko", "DIMM / SO-DIMM"],
    wifi: ["Wi-Fi", "Kyllä / Ei"],
    bluetooth: ["Bluetooth", "Kyllä / Ei"],
    storageType: ["Tallennuslaitteen tyyppi", "NVMe SSD / SATA SSD / SATA HDD"],
    driveFormat: ["Tallennuslaitteen koko", 'M.2 / 2.5" / 3.5" / mSATA'],
    coolingType: ["Jäähdytyksen tyyppi", "Ilmajäähy / AIO / Custom Loop"],
    wattage: ["Teho (W)", "750 W"],
    efficiency: ["Hyötysuhdeluokitus", "80+ Gold"],
    freeShipping: ["Ilmainen postitus", "Kyllä / Ei"],
    vram: ["Näyttömuisti", "12 GB GDDR6X"],
    interface: ["Liitäntä", "PCIe 4.0"],
    powerConnector: ["Virtaliitin", "2 × 8-pin"],
    socket: ["Prosessorikanta", "AM5"],
    cores: ["Ytimien määrä", "8"],
    series: ["Sarja", "Ryzen 5 / Core i5"],
    threads: ["Säikeiden määrä", "16"],
    clock: ["Kellotaajuus", "4,2–5,0 GHz"],
    capacity: ["Kapasiteetti", "32 GB (2 × 16 GB)"],
    memoryType: ["Muistityyppi", "DDR5"],
    speed: ["Nopeus", "6000 MHz CL30"],
    chipset: ["Piirisarja", "B650E"],
    formFactor: ["Koko", "ATX"],
  },
};

const swedishCopy: SpecificationCopy = {
  ...englishCopy,
  pcTitle: "Komponenter i speldatorn",
  componentTitle: "Komponentens tekniska uppgifter",
  optionalTitle: "Valfria tilläggsuppgifter",
  pcHelp: "Beskriv varje komponent eller markera den som saknad eller okänd.",
  componentHelp: "Endast relevanta uppgifter visas. Alla fält i avsnittet är valfria.",
  optionalHelp: "Lägg till användbara produktuppgifter som du känner till.",
  unknown: "Jag känner inte till de tekniska uppgifterna",
  unknownHelp: "Du kan ändå publicera annonsen och beskriva datorn med egna ord.",
  required: "Obligatorisk uppgift",
  optional: "Valfri",
  photoRequired: "Lägg till minst en produktbild.",
  customDetails: "Övriga tekniska uppgifter",
};

export const specificationCopy: Record<Locale, SpecificationCopy> = {
  fi: finnishCopy,
  sv: swedishCopy,
  da: englishCopy,
  nb: englishCopy,
  en: englishCopy,
};

const fieldKeysByCategory: Record<Category, string[]> = {
  pc: [
    "processor",
    "graphicsCard",
    "memory",
    "storage",
    "motherboard",
    "powerSupply",
    "case",
    "cooling",
    "operatingSystem",
    "pcFans",
    "pcMemoryCapacity",
    "pcMemoryType",
    "pcMemoryModules",
    "pcMemorySpeed",
    "rgb",
  ],
  gpu: ["coreModel", "chipVendor", "vram", "powerConnector"],
  cpu: ["series", "socket", "cores", "threads", "clock"],
  memory: ["capacity", "memoryType", "modules", "moduleFormat", "moduleCapacity", "speed", "latency"],
  motherboard: ["socket", "chipset", "formFactor", "memoryType", "wifi", "bluetooth"],
  other: [],
  psu: ["wattage", "efficiency", "formFactor"],
  storage: ["capacity", "storageType", "driveFormat"],
  case: ["formFactor", "caseType"],
  cooling: ["coolingType", "socket"],
  fans: [],
};

export function getGuidedSpecificationFields(category: Category, locale: Locale): GuidedSpecificationField[] {
  const copy = specificationCopy[locale];
  return [...fieldKeysByCategory[category], "freeShipping"].map((key) => {
    const [label, placeholder] = copy.fields[key] ?? englishCopy.fields[key];
    const options = ["freeShipping", "wifi", "bluetooth", "rgb"].includes(key)
      ? locale === "fi"
        ? ["Kyllä", "Ei"]
        : ["Yes", "No"]
      : (
          {
            efficiency: [
              "80+",
              "80+ Bronze",
              "80+ Silver",
              "80+ Gold",
              "80+ Platinum",
              "80+ Titanium",
              "Cybenetics Gold",
              "Cybenetics Platinum",
            ],
            ...(category === "psu" ? { formFactor: ["ATX", "SFX", "SFX-L", "TFX", "Flex ATX"] } : {}),
            fanConnector: ["3-pin", "4-pin", "Molex", locale === "fi" ? "Valmistajakohtainen" : "Proprietary"],
            fanControl: ["PWM", "DC", locale === "fi" ? "Kiinteä nopeus" : "Fixed speed"],
            fanLighting: [locale === "fi" ? "Ei valaistusta" : "None", "RGB", "ARGB"],
          } as Record<string, string[]>
        )[key];
    const suggestions = (
      {
        // Rated output of real PSU models; sources: docs/psu-wattage-options.md.
        wattage: [
          "300 W",
          "400 W",
          "450 W",
          "500 W",
          "550 W",
          "600 W",
          "650 W",
          "700 W",
          "750 W",
          "850 W",
          "1000 W",
          "1050 W",
          "1200 W",
          "1250 W",
          "1300 W",
          "1350 W",
          "1500 W",
          "1550 W",
          "1600 W",
          "1650 W",
          "2000 W",
        ],
        memoryType: ["DDR3", "DDR4", "DDR5"],
        pcMemoryType: ["DDR3", "DDR4", "DDR5"],
        capacity:
          category === "memory"
            ? ["8 GB", "16 GB", "32 GB", "64 GB", "96 GB", "128 GB"]
            : ["256 GB", "512 GB", "1 TB", "2 TB", "4 TB"],
        modules: ["1", "2", "4", "8"],
        moduleCapacity: ["4", "8", "16", "24", "32", "48", "64"],
        pcMemoryCapacity: ["8", "16", "32", "64", "96", "128"],
        pcMemoryModules: ["1", "2", "4", "8"],
        moduleFormat: ["DIMM", "SO-DIMM"],
        storageType: ["NVMe SSD", "SATA SSD", "SATA HDD"],
        driveFormat: ["M.2", '2.5"', '3.5"', "mSATA"],
        pcieGeneration: ["Gen3", "Gen4", "Gen5"],
        formFactor: category === "psu" ? ["ATX", "SFX", "SFX-L", "TFX"] : ["ATX", "Micro-ATX", "Mini-ITX", "E-ATX"],
        socket: ["AM4", "AM5", "LGA 1200", "LGA 1700", "LGA 1851"],
        fanSize: ["80", "92", "120", "140", "200"],
        fanCount: ["1", "2", "3", "5", "6"],
      } as Record<string, string[]>
    )[key];
    return { key, label, placeholder, options, suggestions };
  });
}
