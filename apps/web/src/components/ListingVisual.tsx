import type { Category, Listing } from "../types";

const shortCategory: Record<Category, string> = {
  gpu: "GPU",
  cpu: "CPU",
  memory: "RAM",
  motherboard: "MB",
  pc: "PC",
  other: "HW",
};

export function ListingVisual({ listing, large = false }: { listing: Listing; large?: boolean }) {
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
