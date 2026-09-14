import type { Category, Condition, CountryCode, Currency, Listing, ListingImage, PrivatePickupAddress } from "../types";
import { demoStorage } from "./demo-storage";
import { MAX_LISTING_IMAGES, type PreparedListingImage } from "./listing-images";
import { backendMode, supabase } from "./supabase";

const LISTING_IMAGES_BUCKET = "listing-images";
const LISTING_SELECT =
  "id,title,description,category,condition,price_minor,currency,city,specs,created_at,seller:profiles!listings_seller_id_fkey(id,display_name,country_code,joined_at,reviews:reviews!reviews_subject_id_fkey(rating)),destinations:listing_shipping_countries(country_code),images:listing_images(id,storage_path,alt_text,width,height,sort_order)";

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
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  price_minor: number;
  currency: Currency;
  city: string;
  specs: Record<string, string> | null;
  created_at: string;
  seller: DbSeller | DbSeller[];
  destinations: Array<{ country_code: CountryCode }>;
  images?: DbListingImage[];
}

interface ReservedListingImage extends DbListingImage {}

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
      p_specs: listing.specs,
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

    if (error) throw error;
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

        if (reservedImages.length !== preparedImages.length) {
          throw new Error("Kuvapaikkojen varaaminen epäonnistui.");
        }

        const preparedByOrder = new Map(preparedImages.map((image) => [image.sortOrder, image]));
        for (const reservation of reservedImages) {
          const image = preparedByOrder.get(reservation.sort_order);
          if (!image) throw new Error("Kuvien järjestys ei vastaa tallennusvarausta.");

          const { error: uploadError } = await supabase.storage
            .from(LISTING_IMAGES_BUCKET)
            .upload(reservation.storage_path, image.blob, {
              cacheControl: "31536000",
              contentType: "image/webp",
              upsert: false,
            });
          if (uploadError) throw uploadError;
          uploadedPaths.push(reservation.storage_path);
        }
      }

      const { error: publishError } = await supabase.rpc("publish_listing_draft", { p_listing_id: listingId });
      if (publishError) throw publishError;

      return {
        ...listing,
        id: listingId,
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
