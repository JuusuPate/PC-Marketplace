import { COUNTRY_FLAGS } from "../config/markets";
import type { Messages } from "../i18n/messages/fi";
import { formatMoney } from "../lib/money";
import type { Listing, Locale } from "../types";
import { Icon } from "./Icon";
import { ListingVisual } from "./ListingVisual";

interface ListingCardProps {
  listing: Listing;
  locale: Locale;
  copy: Messages;
  favourite: boolean;
  onFavourite: () => void;
  onOpen: () => void;
}

export function ListingCard({ listing, locale, copy, favourite, onFavourite, onOpen }: ListingCardProps) {
  const conditionLabel = listing.condition === "fair" ? copy.conditionFair : copy[listing.condition];
  return (
    <article className="listing-card">
      <div
        className="card-media"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => event.key === "Enter" && onOpen()}
      >
        <ListingVisual listing={listing} />
        <span className={`price-signal signal--${listing.priceSignal}`}>{copy[listing.priceSignal]}</span>
        <button
          className={`favourite-button ${favourite ? "is-active" : ""}`}
          type="button"
          aria-label={favourite ? copy.saved : copy.save}
          onClick={(event) => {
            event.stopPropagation();
            onFavourite();
          }}
        >
          <Icon name="heart" fill={favourite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="card-content">
        <div className="card-topline">
          <span>{conditionLabel}</span>
          <span>·</span>
          <span>{listing.city}</span>
          <span className="card-time">{listing.createdLabel}</span>
        </div>
        <button className="card-title" type="button" onClick={onOpen}>
          {listing.title}
        </button>
        <p>{listing.subtitle}</p>
        <div className="card-price-row">
          <strong>{formatMoney(listing.priceMinor, listing.currency, locale)}</strong>
          {listing.buyerProtection && (
            <span className="protection-mini">
              <Icon name="shield" /> {copy.buyerProtection}
            </span>
          )}
        </div>
        <div className="card-footer">
          <span className="seller-avatar">{listing.seller.initials}</span>
          <span>{listing.seller.name}</span>
          {listing.seller.verified && (
            <span className="verified-dot" title={copy.verified}>
              <Icon name="check" />
            </span>
          )}
          <span className="seller-rating">
            <Icon name="star" fill="currentColor" /> {listing.seller.rating}
          </span>
          <span className="ship-flags">{listing.shipsTo.map((country) => COUNTRY_FLAGS[country]).join(" ")}</span>
        </div>
      </div>
    </article>
  );
}
