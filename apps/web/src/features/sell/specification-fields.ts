import type { Category, Locale } from "../../types";

export interface GuidedSpecificationField {
  key: string;
  label: string;
  placeholder: string;
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
    operatingSystem: ["Operating system", "Windows 11 Home"],
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
    operatingSystem: ["Käyttöjärjestelmä", "Windows 11 Home"],
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
  gpu: ["vram", "interface", "powerConnector"],
  cpu: ["socket", "cores", "clock"],
  memory: ["capacity", "memoryType", "speed"],
  motherboard: ["socket", "chipset", "formFactor", "memoryType"],
  other: [],
  psu: [], storage: ["capacity", "interface"], case: ["formFactor"], cooling: [],
};

export function getGuidedSpecificationFields(category: Category, locale: Locale): GuidedSpecificationField[] {
  const copy = specificationCopy[locale];
  return fieldKeysByCategory[category].map((key) => {
    const [label, placeholder] = copy.fields[key] ?? englishCopy.fields[key];
    return { key, label, placeholder };
  });
}
