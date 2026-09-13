import { useState } from "react";
import type { Category, Listing, ListingImage } from "../types";

const shortCategory: Record<Category, string> = {
  gpu: "GPU",
  cpu: "CPU",
  memory: "RAM",
  motherboard: "MB",
  pc: "PC",
  other: "HW",
};

export function getSafeListingImageUrl(image?: ListingImage) {
  const candidate = image?.url.trim();

  if (!candidate) {
    return null;
  }

  if (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i.test(candidate)) {
    return candidate;
  }

  try {
    const url = new URL(candidate, "https://pc-marketplace.invalid");
    return ["blob:", "http:", "https:"].includes(url.protocol) ? candidate : null;
  } catch {
    return null;
  }
}

interface ListingVisualProps {
  listing: Listing;
  large?: boolean;
  image?: ListingImage;
}

export function ListingVisual({ listing, large = false, image }: ListingVisualProps) {
  const selectedImage = image ?? listing.images?.[0];
  const imageUrl = getSafeListingImageUrl(selectedImage);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayImageUrl = imageUrl && imageUrl !== failedImageUrl ? imageUrl : null;

  if (displayImageUrl) {
    return (
      <div
        className={`listing-visual listing-visual--photo visual--${listing.visual} ${
          large ? "listing-visual--large" : ""
        }`}
      >
        <img
          className="listing-visual__image"
          src={displayImageUrl}
          alt={selectedImage?.alt || listing.title}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(displayImageUrl)}
        />
      </div>
    );
  }

  return (
    <div className={`listing-visual visual--${listing.visual} ${large ? "listing-visual--large" : ""}`}>
      <div className="visual-grid" />
      <div className={`hardware-shape hardware-shape--${listing.category}`}>
        <span className="hardware-brand">{listing.brand}</span>
        <strong>{shortCategory[listing.category]}</strong>
        <span className="hardware-model">{listing.title.split(" ").slice(-2).join(" ")}</span>
      </div>
      <span className="visual-condition">{listing.condition.toUpperCase()}</span>
    </div>
  );
}
