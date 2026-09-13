import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import { getSafeListingImageUrl, ListingVisual } from "../../components/ListingVisual";
import { COUNTRY_FLAGS, MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { Listing, Locale } from "../../types";

export interface ListingDetailPageProps {
  listing: Listing;
  copy: Messages;
  locale: Locale;
  favourite: boolean;
  canBuy: boolean;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFavourite: () => void;
  onBuy: () => void;
}

export function ListingDetailPage({
  listing,
  copy,
  locale,
  favourite,
  canBuy,
  onBack,
  onFavourite,
  onBuy,
}: ListingDetailPageProps) {
  const [reported, setReported] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const images = (listing.images ?? []).filter((image) => getSafeListingImageUrl(image));
  const activeImage = images[activeImageIndex] ?? images[0];
  const conditionLabel = listing.condition === "fair" ? copy.conditionFair : copy[listing.condition];
  const categoryLabel = copy[listing.category];
  const sellerCountry = `${COUNTRY_FLAGS[listing.seller.countryCode]} ${MARKETS[listing.seller.countryCode].name}`;

  useEffect(() => {
    setActiveImageIndex(0);
    setReported(false);
  }, [listing.id]);

  return (
    <section className="listing-detail-page" aria-labelledby="listing-page-title">
      <div className="listing-detail-page__inner">
        <a className="listing-detail-page__back" href="/kategoriat/kaikki" onClick={onBack}>
          <span aria-hidden="true">←</span> {copy.allProducts}
        </a>

        <article className="listing-detail-page__card">
          <div className="detail-layout">
            <div className="detail-media-column">
              <ListingVisual listing={listing} image={activeImage} large />
              {images.length > 1 && (
                <div className="detail-thumbnails" role="group" aria-label={`${listing.title} (${images.length})`}>
                  {images.map((image, index) => {
                    const imageUrl = getSafeListingImageUrl(image);

                    return (
                      <button
                        className={`detail-thumbnail ${index === activeImageIndex ? "is-active" : ""}`}
                        type="button"
                        aria-label={`${listing.title}, ${index + 1} / ${images.length}`}
                        aria-pressed={index === activeImageIndex}
                        onClick={() => setActiveImageIndex(index)}
                        key={image.id || `${image.url}-${index}`}
                      >
                        <img
                          src={imageUrl ?? undefined}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

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
              <h1 id="listing-page-title" tabIndex={-1}>
                {listing.title}
              </h1>
              <p className="detail-subtitle">{listing.subtitle}</p>
              <div className="detail-price">{formatMoney(listing.priceMinor, listing.currency, locale)}</div>
              <div className="detail-meta">
                <span>{conditionLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{listing.city}</span>
                <span aria-hidden="true">·</span>
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
                <h2>{copy.productDetails}</h2>
                <dl>
                  <div>
                    <dt>{copy.category}</dt>
                    <dd>{categoryLabel}</dd>
                  </div>
                  <div>
                    <dt>{copy.brand}</dt>
                    <dd>{listing.brand}</dd>
                  </div>
                  <div>
                    <dt>{copy.condition}</dt>
                    <dd>{conditionLabel}</dd>
                  </div>
                  <div>
                    <dt>{copy.location}</dt>
                    <dd>{listing.city}</dd>
                  </div>
                </dl>
              </section>

              <section className="detail-section">
                <h2>{copy.specs}</h2>
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
                <h2>{copy.description}</h2>
                <p>{listing.description}</p>
              </section>

              <section className="seller-panel" aria-labelledby="listing-seller-title">
                <span className="seller-avatar seller-avatar--large">{listing.seller.initials}</span>
                <div>
                  <small id="listing-seller-title">{copy.sellerDetails}</small>
                  <strong>
                    {listing.seller.name}{" "}
                    {listing.seller.verified && (
                      <span className="verified-dot" title={copy.verified}>
                        <Icon name="check" />
                      </span>
                    )}
                  </strong>
                  <span>
                    <Icon name="star" fill="currentColor" />
                    {listing.seller.reviewCount > 0
                      ? `${listing.seller.rating.toFixed(1)} · ${listing.seller.reviewCount} ${copy.reviews}`
                      : copy.noReviews}
                  </span>
                  {listing.seller.completedSales > 0 && (
                    <span>{`${listing.seller.completedSales} ${copy.completedSales}`}</span>
                  )}
                  <span>
                    {copy.memberSince} {listing.seller.joinedYear}
                  </span>
                  <span className="seller-location">
                    {copy.publicLocation}: {listing.city}
                  </span>
                  <span>{sellerCountry}</span>
                </div>
                <div className="seller-country" aria-hidden="true">
                  {COUNTRY_FLAGS[listing.seller.countryCode]}
                </div>
              </section>

              <aside className="listing-detail-page__privacy">
                <Icon name="shield" />
                <div>
                  <strong>{copy.privateAddress}</strong>
                  <p>{copy.privateAddressHelp}</p>
                </div>
              </aside>

              <div className="detail-shipping">
                <Icon name="truck" />
                <div>
                  <strong>{copy.shipsTo}</strong>
                  <span>
                    {listing.shipsTo
                      .map((country) => `${COUNTRY_FLAGS[country]} ${MARKETS[country].name}`)
                      .join("  ·  ")}
                  </span>
                </div>
              </div>

              <button className="report-button" type="button" onClick={() => setReported(true)}>
                {reported ? "✓ " : ""}
                {copy.report}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
