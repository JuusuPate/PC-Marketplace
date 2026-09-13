import { useState } from "react";
import { COUNTRY_FLAGS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { Listing, Locale } from "../../types";
import { Icon } from "../../components/Icon";
import { ListingVisual } from "../../components/ListingVisual";
import { ModalShell } from "../../components/ModalShell";

interface ListingDrawerProps {
  listing: Listing;
  copy: Messages;
  locale: Locale;
  favourite: boolean;
  canBuy: boolean;
  onClose: () => void;
  onFavourite: () => void;
  onBuy: () => void;
}

export function ListingDrawer({
  listing,
  copy,
  locale,
  favourite,
  canBuy,
  onClose,
  onFavourite,
  onBuy,
}: ListingDrawerProps) {
  const [reported, setReported] = useState(false);
  const conditionLabel = listing.condition === "fair" ? copy.conditionFair : copy[listing.condition];
  return (
    <ModalShell title={listing.title} onClose={onClose} size="wide">
      <div className="detail-layout">
        <div className="detail-media-column">
          <ListingVisual listing={listing} large />
          <div className="detail-proof-row">
            {listing.serialVerified && (
              <span>
                <Icon name="check" /> {copy.serialVerified}
              </span>
            )}
            {listing.buyerProtection && (
              <span>
                <Icon name="shield" /> {copy.buyerProtection}
              </span>
            )}
          </div>
        </div>
        <div className="detail-content">
          <span className={`price-signal signal--${listing.priceSignal}`}>{copy[listing.priceSignal]}</span>
          <h2>{listing.title}</h2>
          <p className="detail-subtitle">{listing.subtitle}</p>
          <div className="detail-price">{formatMoney(listing.priceMinor, listing.currency, locale)}</div>
          <div className="detail-meta">
            <span>{conditionLabel}</span>
            <span>·</span>
            <span>{listing.city}</span>
            <span>·</span>
            <span>{listing.createdLabel}</span>
          </div>
          <div className="detail-actions">
            <button className="button button--primary" type="button" onClick={onBuy} disabled={!canBuy}>
              {canBuy ? copy.buyNow : copy.ownListing}
              {canBuy && <Icon name="arrow" />}
            </button>
            <button
              className={`button button--outline ${favourite ? "is-active" : ""}`}
              type="button"
              onClick={onFavourite}
            >
              <Icon name="heart" fill={favourite ? "currentColor" : "none"} />
              {favourite ? copy.saved : copy.save}
            </button>
          </div>
          <section className="detail-section">
            <h3>{copy.specs}</h3>
            <dl>
              {Object.entries(listing.specs).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="detail-section">
            <h3>{copy.description}</h3>
            <p>{listing.description}</p>
          </section>
          <section className="seller-panel">
            <span className="seller-avatar seller-avatar--large">{listing.seller.initials}</span>
            <div>
              <small>{copy.seller}</small>
              <strong>
                {listing.seller.name}{" "}
                {listing.seller.verified && (
                  <span className="verified-dot">
                    <Icon name="check" />
                  </span>
                )}
              </strong>
              <span>
                <Icon name="star" fill="currentColor" /> {listing.seller.rating} · {listing.seller.completedSales}{" "}
                {copy.completedSales}
              </span>
            </div>
            <div className="seller-country">{COUNTRY_FLAGS[listing.seller.countryCode]}</div>
          </section>
          <div className="detail-shipping">
            <Icon name="truck" />
            <div>
              <strong>{copy.shipsTo}</strong>
              <span>
                {listing.shipsTo.map((country) => `${COUNTRY_FLAGS[country]} ${copy.shippingArea}`).join("  ·  ")}
              </span>
            </div>
          </div>
          <button className="report-button" type="button" onClick={() => setReported(true)}>
            {reported ? "✓ " : ""}
            {copy.report}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
