import { Icon } from "../../components/Icon";
import { ListingVisual } from "../../components/ListingVisual";
import { ModalShell } from "../../components/ModalShell";
import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { Listing, Locale } from "../../types";
import "./favourites-modal.css";

type FavouritesMessages = Pick<Messages, "seller" | "viewItem"> & {
  favourites: string;
  favouritesEmpty: string;
  favouritesEmptyBody: string;
  browseProducts: string;
  removeFromFavourites: string;
};

interface FavouritesModalProps {
  copy: FavouritesMessages;
  locale: Locale;
  listings: Listing[];
  onClose: () => void;
  onOpenListing: (listing: Listing) => void;
  onRemoveFavourite: (listingId: string) => void;
  onBrowseProducts: () => void;
}

export function FavouritesModal({
  copy,
  locale,
  listings,
  onClose,
  onOpenListing,
  onRemoveFavourite,
  onBrowseProducts,
}: FavouritesModalProps) {
  return (
    <ModalShell title={copy.favourites} onClose={onClose} size="wide">
      <div className="favourites-modal">
        <header className="favourites-modal__header">
          <span className="favourites-modal__icon" aria-hidden="true">
            <Icon name="heart" fill="currentColor" />
          </span>
          <div>
            <p className="favourites-modal__eyebrow">PC MARKET</p>
            <div className="favourites-modal__title-row">
              <h2>{copy.favourites}</h2>
              <span
                className="favourites-modal__count"
                aria-label={`${listings.length} ${copy.favourites}`}
                aria-live="polite"
              >
                {listings.length}
              </span>
            </div>
          </div>
        </header>

        {listings.length === 0 ? (
          <section className="favourites-modal__empty" aria-labelledby="favourites-empty-title">
            <span aria-hidden="true">
              <Icon name="heart" />
            </span>
            <h3 id="favourites-empty-title">{copy.favouritesEmpty}</h3>
            <p>{copy.favouritesEmptyBody}</p>
            <button className="button button--dark" type="button" onClick={onBrowseProducts}>
              {copy.browseProducts}
              <Icon name="arrow" />
            </button>
          </section>
        ) : (
          <ul className="favourites-modal__list" aria-label={copy.favourites}>
            {listings.map((listing) => (
              <li key={listing.id}>
                <article className="favourite-listing">
                  <button
                    className="favourite-listing__media"
                    type="button"
                    aria-label={`${copy.viewItem}: ${listing.title}`}
                    onClick={() => onOpenListing(listing)}
                  >
                    <ListingVisual listing={listing} />
                  </button>

                  <div className="favourite-listing__body">
                    <div className="favourite-listing__meta">
                      <span>{listing.city}</span>
                      <span aria-hidden="true">·</span>
                      <span>{listing.createdLabel}</span>
                    </div>
                    <button className="favourite-listing__title" type="button" onClick={() => onOpenListing(listing)}>
                      {listing.title}
                    </button>
                    <p>{listing.subtitle}</p>
                    <span className="favourite-listing__seller">
                      {copy.seller}: <strong>{listing.seller.name}</strong>
                      {listing.seller.reviewCount > 0 && (
                        <span>
                          <Icon name="star" fill="currentColor" />
                          {listing.seller.rating.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="favourite-listing__actions">
                    <strong>{formatMoney(listing.priceMinor, listing.currency, locale)}</strong>
                    <button
                      className="favourite-listing__remove"
                      type="button"
                      aria-label={`${copy.removeFromFavourites}: ${listing.title}`}
                      title={copy.removeFromFavourites}
                      onClick={() => onRemoveFavourite(listing.id)}
                    >
                      <Icon name="heart" fill="currentColor" />
                      <span>{copy.removeFromFavourites}</span>
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
