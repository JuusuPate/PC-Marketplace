export const MAX_LISTING_IMAGES = 5;
export const MAX_LISTING_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024;

const MAX_SOURCE_PIXELS = 50_000_000;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const OUTPUT_PRESETS = {
  demo: {
    maxEdge: 1600,
    targetBytes: 360 * 1024,
  },
  supabase: {
    maxEdge: 1800,
    targetBytes: 1536 * 1024,
  },
} as const;

export type ListingImageErrorCode =
  "too_many_images" | "empty_file" | "unsupported_type" | "source_too_large" | "decode_failed" | "output_too_large";

export class ListingImageError extends Error {
  readonly code: ListingImageErrorCode;

  constructor(code: ListingImageErrorCode, message: string) {
    super(message);
    this.name = "ListingImageError";
    this.code = code;
  }
}

export interface PreparedListingImage {
  id: string;
  blob: Blob;
  previewUrl: string;
  alt: string;
  width: number;
  height: number;
  sortOrder: number;
}

export interface PrepareListingImagesOptions {
  mode?: keyof typeof OUTPUT_PRESETS;
  alt?: string;
  /** Number of images already selected; also becomes the first new sort order. */
  startIndex?: number;
}

interface DecodedImage {
  image: HTMLImageElement;
  sourceUrl: string;
}

function decodeImage(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, sourceUrl });
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new ListingImageError("decode_failed", `Kuvatiedostoa ${file.name} ei voitu lukea.`));
    };
    image.src = sourceUrl;
  });
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new ListingImageError("decode_failed", "Selain ei pystynyt muuttamaan kuvaa WebP-muotoon."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function renderWebp(
  image: HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
  targetBytes: number,
) {
  const initialScale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * initialScale));
  let height = Math.max(1, Math.round(sourceHeight * initialScale));

  for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new ListingImageError("decode_failed", "Kuvan käsittely ei onnistu tässä selaimessa.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.84, 0.76, 0.68, 0.6, 0.52]) {
      const blob = await canvasToWebp(canvas, quality);
      if (blob.size <= targetBytes) return { blob, width, height };
    }

    canvas.width = 1;
    canvas.height = 1;
    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }

  throw new ListingImageError("output_too_large", "Kuvaa ei saatu pakattua sallittuun kokoon.");
}

async function prepareOne(
  file: File,
  sortOrder: number,
  mode: keyof typeof OUTPUT_PRESETS,
  alt: string,
): Promise<PreparedListingImage> {
  if (file.size === 0) throw new ListingImageError("empty_file", `Kuvatiedosto ${file.name} on tyhjä.`);
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new ListingImageError("unsupported_type", "Kuviksi hyväksytään JPEG-, PNG- ja WebP-tiedostot.");
  }
  if (file.size > MAX_LISTING_IMAGE_SOURCE_BYTES) {
    throw new ListingImageError("source_too_large", "Yksittäinen alkuperäinen kuva saa olla enintään 10 Mt.");
  }

  const { image, sourceUrl } = await decodeImage(file);
  try {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) {
      throw new ListingImageError("decode_failed", `Kuvatiedostoa ${file.name} ei voitu lukea.`);
    }
    if (width * height > MAX_SOURCE_PIXELS) {
      throw new ListingImageError("source_too_large", "Kuvan tarkkuus on liian suuri käsiteltäväksi turvallisesti.");
    }

    const rendered = await renderWebp(
      image,
      width,
      height,
      OUTPUT_PRESETS[mode].maxEdge,
      OUTPUT_PRESETS[mode].targetBytes,
    );
    return {
      id: crypto.randomUUID(),
      blob: rendered.blob,
      previewUrl: URL.createObjectURL(rendered.blob),
      alt,
      width: rendered.width,
      height: rendered.height,
      sortOrder,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function prepareListingImages(
  files: File[] | FileList,
  options: PrepareListingImagesOptions = {},
): Promise<PreparedListingImage[]> {
  const selectedFiles = Array.from(files);
  const startIndex = options.startIndex ?? 0;
  const mode = options.mode ?? "demo";

  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex + selectedFiles.length > MAX_LISTING_IMAGES) {
    throw new ListingImageError("too_many_images", `Ilmoitukseen voi lisätä enintään ${MAX_LISTING_IMAGES} kuvaa.`);
  }

  const prepared: PreparedListingImage[] = [];
  try {
    for (const [index, file] of selectedFiles.entries()) {
      prepared.push(await prepareOne(file, startIndex + index, mode, options.alt?.trim() ?? ""));
    }
    return prepared;
  } catch (error) {
    releasePreparedListingImages(prepared);
    throw error;
  }
}

export function releasePreparedListingImages(images: Iterable<PreparedListingImage>) {
  for (const image of images) URL.revokeObjectURL(image.previewUrl);
}
