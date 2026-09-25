import type {
  Category,
  Condition,
  CountryCode,
  Currency,
  Listing,
  ListingImage,
  ListingStatus,
  PrivatePickupAddress,
} from "../types";
import { demoStorage } from "./demo-storage";
import { MAX_LISTING_IMAGES, type PreparedListingImage } from "./listing-images";
import { throwIfListingCreationPaused } from "./listing-creation-setting-service";
import { backendMode, supabase } from "./supabase";

const LISTING_IMAGES_BUCKET = "listing-images";
const LISTING_SELECT =
  "id,catalog_model_id,title,description,category,condition,price_minor,currency,city,specs,status,is_featured,created_at,seller:profiles!listings_seller_id_fkey(id,display_name,country_code,joined_at,reviews:reviews!reviews_subject_id_fkey(rating)),destinations:listing_shipping_countries(country_code),images:listing_images(id,storage_path,alt_text,width,height,sort_order)";

interface DbListingImage {
  id: string;
  storage_path: string;
  alt_text: string;
  width: number;
  height: number;
  sort_order: number;
}

interface DbSeller {
  id: string;
  display_name: string;
  country_code: CountryCode;
  joined_at: string;
  reviews?: Array<{ rating: number }>;
}

interface DbListing {
  id: string;
  status: ListingStatus;
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  price_minor: number;
  currency: Currency;
  city: string;
  specs: Record<string, string> | null;
  catalog_model_id: string | null;
  is_featured: boolean;
  created_at: string;
  seller: DbSeller | DbSeller[];
  destinations: Array<{ country_code: CountryCode }>;
  images?: DbListingImage[];
}

interface ReservedListingImage extends DbListingImage {}

async function uploadReservedImages(
  reservations: ReservedListingImage[],
  preparedImages: PreparedListingImage[],
  uploadedPaths: string[],
) {
  if (!supabase) throw new Error("Kuvatallennus ei ole käytössä.");
  if (reservations.length !== preparedImages.length) {
    throw new Error("Kuvapaikkojen varaaminen epäonnistui.");
  }

  const preparedByOrder = new Map(preparedImages.map((image) => [image.sortOrder, image]));
  for (const reservation of reservations) {
    const image = preparedByOrder.get(reservation.sort_order);
    if (!image) throw new Error("Kuvien järjestys ei vastaa tallennusvarausta.");

    const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).upload(reservation.storage_path, image.blob, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });
    if (error) throw error;
    uploadedPaths.push(reservation.storage_path);
  }
}

const visuals: Listing["visual"][] = ["lime", "blue", "violet", "orange", "silver", "pink"];

function visualFor(id: string) {
  const score = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return visuals[score % visuals.length];
}

function publicImageUrl(storagePath: string) {
  if (!supabase) return "";
  return supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function mapImage(image: DbListingImage): ListingImage {
  return {
    id: image.id,
    url: publicImageUrl(image.storage_path),
    alt: image.alt_text,
    width: image.width,
    height: image.height,
    sortOrder: image.sort_order,
    storagePath: image.storage_path,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Kuvan tallentaminen paikalliseen demoon epäonnistui."));
    reader.readAsDataURL(blob);
  });
}

async function mapDemoImages(listing: Listing, preparedImages: PreparedListingImage[]) {
  return Promise.all(
    preparedImages.map(async (image): Promise<ListingImage> => ({
      id: image.id,
      url: await blobToDataUrl(image.blob),
      alt: image.alt || listing.title,
      width: image.width,
      height: image.height,
      sortOrder: image.sortOrder,
    })),
  );
}

function mapListing(row: DbListing): Listing {
  const seller = Array.isArray(row.seller) ? row.seller[0] : row.seller;
  const specs = row.specs ?? {};
  const reviews = seller.reviews ?? [];
  const rating = reviews.length > 0 ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;

  return {
    id: row.id,
    catalogModelId: row.catalog_model_id,
    status: row.status,
    title: row.title,
    subtitle: Object.values(specs).slice(0, 2).join(" · ") || row.category.toUpperCase(),
    category: row.category,
    brand: row.title.split(" ")[0],
    priceMinor: row.price_minor,
    currency: row.currency,
    condition: row.condition,
    city: row.city,
    seller: {
      id: seller.id,
      name: seller.display_name,
      initials: seller.display_name.slice(0, 2).toUpperCase(),
      countryCode: seller.country_code,
      rating: Math.round(rating * 10) / 10,
      reviewCount: reviews.length,
      completedSales: 0,
      verified: false,
      joinedYear: new Date(seller.joined_at).getFullYear(),
    },
    shipsTo: row.destinations.map((destination) => destination.country_code),
    specs,
    description: row.description,
    priceSignal: "fair",
    isFeatured: row.is_featured,
    buyerProtection: true,
    serialVerified: false,
    createdLabel: new Date(row.created_at).toLocaleDateString(),
    createdAt: row.created_at,
    visual: visualFor(row.id),
    images: (row.images ?? []).sort((a, b) => a.sort_order - b.sort_order).map(mapImage),
  };
}

export const listingService = {
  mode: backendMode,

  async listActive(): Promise<Listing[]> {
    if (!supabase) return demoStorage.getListings();

    const { data, error } = await supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(60);

    if (error) throw error;
    return ((data ?? []) as unknown as DbListing[]).map(mapListing);
  },

  async listMine(userId: string): Promise<Listing[]> {
    if (!supabase) return demoStorage.getListings().filter((listing) => listing.seller.id === userId);

    const { data, error } = await supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return ((data ?? []) as unknown as DbListing[]).map(mapListing);
  },

  async getActiveByIds(ids: string[]): Promise<Listing[]> {
    if (ids.length === 0) return [];
    const client = supabase;
    if (!client) return demoStorage.getListings().filter((listing) => ids.includes(listing.id));

    const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) =>
      ids.slice(index * 50, index * 50 + 50),
    );
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const { data, error } = await client
          .from("listings")
          .select(LISTING_SELECT)
          .eq("status", "active")
          .in("id", chunk);
        if (error) throw error;
        return ((data ?? []) as unknown as DbListing[]).map(mapListing);
      }),
    );
    return results.flat();
  },

  async getActiveById(id: string): Promise<Listing | null> {
    if (!supabase) return demoStorage.getListings().find((listing) => listing.id === id) ?? null;

    const { data, error } = await supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("status", "active")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapListing(data as unknown as DbListing) : null;
  },

  async getPrivatePickupAddress(listingId: string): Promise<PrivatePickupAddress | null> {
    if (!supabase) return demoStorage.getPrivatePickupAddress(listingId);

    const { data, error } = await supabase
      .from("listing_pickup_addresses")
      .select("street_address,postal_code,city,country_code")
      .eq("listing_id", listingId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return {
      streetAddress: String(data.street_address),
      postalCode: String(data.postal_code),
      city: String(data.city),
      countryCode: data.country_code as CountryCode,
    };
  },

  async update(
    listing: Listing,
    marketCountryCode: CountryCode,
    preparedImages: PreparedListingImage[] = [],
    pickupAddress?: PrivatePickupAddress,
  ): Promise<Listing> {
    if (preparedImages.length > MAX_LISTING_IMAGES) {
      throw new Error(`Ilmoitukseen voi lisätä enintään ${MAX_LISTING_IMAGES} kuvaa.`);
    }

    if (!supabase) {
      const session = demoStorage.getSession();
      const existing = demoStorage.getListings().find((item) => item.id === listing.id);
      if (!session || !existing || existing.seller.id !== session.id || listing.seller.id !== session.id) {
        throw new Error("Voit muokata vain omia ilmoituksiasi.");
      }

      const nextImages = preparedImages.length > 0 ? await mapDemoImages(listing, preparedImages) : existing.images;
      const savedListing: Listing = {
        ...existing,
        ...listing,
        id: existing.id,
        seller: existing.seller,
        createdAt: existing.createdAt,
        createdLabel: existing.createdLabel,
        images: nextImages,
      };
      if (pickupAddress) demoStorage.setPrivatePickupAddress(savedListing.id, savedListing.seller.id, pickupAddress);
      return savedListing;
    }

    if (new Set(preparedImages.map((image) => image.sortOrder)).size !== preparedImages.length) {
      throw new Error("Kuvien järjestysnumeroiden pitää olla yksilöllisiä.");
    }

    const details = {
      p_listing_id: listing.id,
      p_market_country_code: marketCountryCode,
      p_title: listing.title,
      p_description: listing.description,
      p_category: listing.category,
      p_condition: listing.condition,
      p_price_minor: listing.priceMinor,
      p_currency: listing.currency,
      p_city: listing.city,
      p_specs: { ...listing.specs, _catalog_model_id: listing.catalogModelId ?? null },
      p_pickup_address: pickupAddress
        ? {
            street_address: pickupAddress.streetAddress,
            postal_code: pickupAddress.postalCode,
            city: pickupAddress.city,
            country_code: pickupAddress.countryCode,
          }
        : null,
    };

    if (preparedImages.length === 0) {
      const { error } = await supabase.rpc("update_listing_details", details);
      if (error) throw error;
      return listing;
    }

    const uploadedPaths: string[] = [];
    let reservedImages: ReservedListingImage[] = [];
    let finalized = false;
    try {
      const { data: reservations, error: reservationError } = await supabase.rpc("reserve_listing_replacement_images", {
        p_listing_id: listing.id,
        p_images: preparedImages.map((image) => ({
          alt_text: image.alt || listing.title,
          width: image.width,
          height: image.height,
          sort_order: image.sortOrder,
        })),
      });
      if (reservationError) throw reservationError;
      reservedImages = (reservations ?? []) as ReservedListingImage[];
      await uploadReservedImages(reservedImages, preparedImages, uploadedPaths);

      const { data: previousImages, error: finalizeError } = await supabase.rpc(
        "finalize_listing_replacement_images",
        details,
      );
      if (finalizeError) throw finalizeError;
      finalized = true;

      const oldPaths = (previousImages ?? [])
        .map((image: { old_storage_path: string }) => image.old_storage_path)
        .filter(Boolean);
      if (oldPaths.length > 0) {
        // New photos are already live. A cleanup failure must not undo a saved listing.
        try {
          const { error: cleanupError } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(oldPaths);
          if (cleanupError) console.warn("Vanhojen ilmoituskuvien siivous epäonnistui.", cleanupError);
        } catch (cleanupError) {
          console.warn("Vanhojen ilmoituskuvien siivous epäonnistui.", cleanupError);
        }
      }

      return {
        ...listing,
        images: reservedImages.sort((a, b) => a.sort_order - b.sort_order).map(mapImage),
      };
    } catch (caught) {
      if (!finalized) {
        try {
          const cleanupError = uploadedPaths.length
            ? (await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(uploadedPaths)).error
            : null;
          if (!cleanupError) {
            await supabase.rpc("abandon_listing_replacement_images", { p_listing_id: listing.id });
          }
        } catch {
          // Keep the upload error; the original published photos are still intact.
        }
      }
      throw caught;
    }
  },

  async create(
    listing: Listing,
    marketCountryCode: CountryCode,
    preparedImages: PreparedListingImage[] = [],
    pickupAddress?: PrivatePickupAddress,
  ): Promise<Listing> {
    if (preparedImages.length > MAX_LISTING_IMAGES) {
      throw new Error(`Ilmoitukseen voi lisätä enintään ${MAX_LISTING_IMAGES} kuvaa.`);
    }
    if (new Set(preparedImages.map((image) => image.sortOrder)).size !== preparedImages.length) {
      throw new Error("Kuvien järjestysnumeroiden pitää olla yksilöllisiä.");
    }

    if (!supabase) {
      const savedListing = { ...listing, images: await mapDemoImages(listing, preparedImages) };
      if (pickupAddress) demoStorage.setPrivatePickupAddress(savedListing.id, listing.seller.id, pickupAddress);
      return savedListing;
    }

    let listingId: string | null = null;
    const uploadedPaths: string[] = [];

    const { data, error } = await supabase.rpc("create_listing_draft", {
      p_market_country_code: marketCountryCode,
      p_title: listing.title,
      p_description: listing.description,
      p_category: listing.category,
      p_condition: listing.condition,
      p_price_minor: listing.priceMinor,
      p_currency: listing.currency,
      p_city: listing.city,
      p_specs: { ...listing.specs, _catalog_model_id: listing.catalogModelId ?? null },
      p_shipping_country_codes: listing.shipsTo,
      p_pickup_address: pickupAddress
        ? {
            street_address: pickupAddress.streetAddress,
            postal_code: pickupAddress.postalCode,
            city: pickupAddress.city,
            country_code: pickupAddress.countryCode,
          }
        : null,
    });

    if (error) {
      throwIfListingCreationPaused(error);
      throw error;
    }
    if (!data) throw new Error("Ilmoitusluonnoksen luominen epäonnistui.");
    listingId = String(data);

    try {
      let reservedImages: ReservedListingImage[] = [];
      if (preparedImages.length > 0) {
        const { data: reservations, error: reservationError } = await supabase.rpc("reserve_listing_images", {
          p_listing_id: listingId,
          p_images: preparedImages.map((image) => ({
            alt_text: image.alt || listing.title,
            width: image.width,
            height: image.height,
            sort_order: image.sortOrder,
          })),
        });
        if (reservationError) throw reservationError;
        reservedImages = (reservations ?? []) as ReservedListingImage[];

        await uploadReservedImages(reservedImages, preparedImages, uploadedPaths);
      }

      const { error: publishError } = await supabase.rpc("publish_listing_draft", { p_listing_id: listingId });
      if (publishError) {
        throwIfListingCreationPaused(publishError);
        throw publishError;
      }

      return {
        ...listing,
        id: listingId,
        status: "active",
        images: reservedImages.sort((a, b) => a.sort_order - b.sort_order).map((image) => mapImage(image)),
      };
    } catch (caught) {
      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(LISTING_IMAGES_BUCKET)
          .remove(uploadedPaths)
          .catch(() => undefined);
      }
      try {
        await supabase.rpc("discard_listing_draft", { p_listing_id: listingId });
      } catch {
        // Preserve the original error. An incomplete listing remains a private draft.
      }
      throw caught;
    }
  },
};
