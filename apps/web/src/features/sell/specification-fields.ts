import type { Category, Locale } from "../../types";

export interface GuidedSpecificationField {
  key: string;
  label: string;
  placeholder: string;
  options?: string[];
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
  pcHelp: "Add each known component. Every field in this section is optional.",
  componentHelp: "Only relevant details are shown. Every field in this section is optional.",
  optionalHelp: "Add any useful product details you know.",
  unknown: "I don't know the specifications",
  unknownHelp: "You can still publish the listing and describe the computer in your own words.",
  required: "Required field",
  optional: "Optional",
  photoRequired: "Add at least one product photo.",
  customDetails: "Other technical details",
  fields: {
    processor: ["Processor", "AMD Ryzen 7 7800X3D"],
    graphicsCard: ["Graphics card", "NVIDIA GeForce RTX 4070 Super"],
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
    cores: ["Cores / threads", "8 / 16"],
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
  pcHelp: "Lisää tiedossasi olevat komponentit. Kaikki tämän osion kentät ovat vapaaehtoisia.",
  componentHelp: "Näytämme vain valitulle komponentille olennaiset tiedot. Kaikki kentät ovat vapaaehtoisia.",
  optionalHelp: "Lisää tuotteesta tiedossasi olevia hyödyllisiä lisätietoja.",
  unknown: "En tiedä teknisiä tietoja",
  unknownHelp: "Voit silti julkaista ilmoituksen ja kertoa pelikoneesta omin sanoin kuvauksessa.",
  required: "Pakollinen tieto",
  optional: "Vapaaehtoinen",
  photoRequired: "Lisää vähintään yksi tuotekuva.",
  customDetails: "Muut tekniset tiedot",
  fields: {
    processor: ["Prosessori", "AMD Ryzen 7 7800X3D"],
    graphicsCard: ["Näytönohjain", "NVIDIA GeForce RTX 4070 Super"],
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
    chipVendor: ["Piirin valmistaja", "NVIDIA / AMD / Intel"],
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
    cores: ["Ytimet / säikeet", "8 / 16"],
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
  pcHelp: "Lägg till de komponenter du känner till. Alla fält i avsnittet är valfria.",
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
  ],
  gpu: ["chipVendor", "vram", "interface", "powerConnector"],
  cpu: ["socket", "cores", "clock"],
  memory: ["capacity", "memoryType", "modules", "moduleFormat", "speed"],
  motherboard: ["socket", "chipset", "formFactor", "memoryType", "wifi", "bluetooth"],
  other: [],
  psu: ["wattage", "efficiency", "formFactor"],
  storage: ["capacity", "storageType", "driveFormat", "interface"],
  case: ["formFactor"],
  cooling: ["coolingType", "socket"],
  fans: ["fanSize", "fanConnector", "fanControl", "fanLighting", "fanCount"],
};

export function getGuidedSpecificationFields(category: Category, locale: Locale): GuidedSpecificationField[] {
  const copy = specificationCopy[locale];
  return [...fieldKeysByCategory[category], "freeShipping"].map((key) => {
    const [label, placeholder] = copy.fields[key] ?? englishCopy.fields[key];
    const options = ["freeShipping", "wifi", "bluetooth"].includes(key)
      ? locale === "fi"
        ? ["Kyllä", "Ei"]
        : ["Yes", "No"]
      : (
          {
            fanConnector: ["3-pin", "4-pin", "Molex", locale === "fi" ? "Valmistajakohtainen" : "Proprietary"],
            fanControl: ["PWM", "DC", locale === "fi" ? "Kiinteä nopeus" : "Fixed speed"],
            fanLighting: [locale === "fi" ? "Ei valaistusta" : "None", "RGB", "ARGB"],
          } as Record<string, string[]>
        )[key];
    return { key, label, placeholder, options };
  });
}
