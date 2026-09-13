import type { MouseEvent } from "react";
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
  href: string;
  onFavourite: () => void;
  onOpen: () => void;
}

export function ListingCard({ listing, locale, copy, favourite, href, onFavourite, onOpen }: ListingCardProps) {
  const conditionLabel = listing.condition === "fair" ? copy.conditionFair : copy[listing.condition];
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <article className="listing-card">
      <div className="card-media">
        <a
          className="card-media-link"
          href={href}
          aria-label={`${copy.viewItem}: ${listing.title}`}
          onClick={handleOpen}
        >
          <ListingVisual listing={listing} />
        </a>
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
        <a className="card-title" href={href} onClick={handleOpen}>
          {listing.title}
        </a>
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
            <Icon name="star" fill="currentColor" />
            {listing.seller.reviewCount > 0 ? listing.seller.rating.toFixed(1) : "—"}
          </span>
          <span className="ship-flags">{listing.shipsTo.map((country) => COUNTRY_FLAGS[country]).join(" ")}</span>
        </div>
      </div>
    </article>
  );
}
