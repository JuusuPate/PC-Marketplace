import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import { getSafeListingImageUrl, ListingVisual } from "../../components/ListingVisual";
import { ModalShell } from "../../components/ModalShell";
import { MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { ReportReason } from "../../lib/report-service";
import { backendMode } from "../../lib/supabase";
import type { Listing, Locale } from "../../types";

export interface ListingDetailPageProps {
  listing: Listing;
  copy: Messages;
  locale: Locale;
  favourite: boolean;
  canBuy: boolean;
  canEdit: boolean;
  canReport: boolean;
  reported: boolean;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFavourite: () => void;
  onBuy: () => void;
  onEdit: () => void;
  onRequireReportAuth: () => void;
  onReport: (reason: ReportReason, details: string) => Promise<void>;
}

export function ListingDetailPage({
  listing,
  copy,
  locale,
  favourite,
  canBuy,
  canEdit,
  canReport,
  reported,
  onBack,
  onFavourite,
  onBuy,
  onEdit,
  onRequireReportAuth,
  onReport,
}: ListingDetailPageProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("misleading");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const images = (listing.images ?? []).filter((image) => getSafeListingImageUrl(image));
  const activeImage = images[activeImageIndex] ?? images[0];
  const activeImageUrl = getSafeListingImageUrl(activeImage);
  const conditionLabel = listing.condition === "fair" ? copy.conditionFair : copy[listing.condition];
  const categoryLabel = copy[listing.category];
  const sellerCountry = MARKETS[listing.seller.countryCode].name;
  const showPreviousImage = () => setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  const showNextImage = () => setActiveImageIndex((current) => (current + 1) % images.length);

  useEffect(() => {
    setActiveImageIndex(0);
    setImageViewerOpen(false);
    setReportOpen(false);
    setReportReason("misleading");
    setReportDetails("");
    setReportError("");
  }, [listing.id]);

  const reportCopy =
    locale === "fi"
      ? {
          title: "Ilmoita ongelmasta",
          help: "Valitse syy. Ilmoitus lähetetään ylläpidon käsiteltäväksi.",
          reason: "Ilmoituksen syy",
          details: "Lisätiedot",
          detailsHelp: "Kerro tarkemmin, jos siitä on apua asian selvittämisessä.",
          reasons: {
            misleading: "Virheelliset tuotetiedot",
            prohibited: "Kielletty tai sopimaton tuote",
            scam: "Epäilyttävä tai huijaava ilmoitus",
            other: "Muu syy",
          },
          submit: "Lähetä ilmoitus",
          sending: "Lähetetään…",
          cancel: "Peruuta",
          reported: "Ilmoitettu ylläpidolle",
          own: "Omaa ilmoitusta ei voi raportoida.",
          otherRequired: "Kerro muu syy vähintään 10 merkillä.",
          demo: "Demotilassa ilmoitus tallentuu vain tähän selaimeen.",
        }
      : {
          title: "Report this listing",
          help: "Choose a reason. The report will be sent to the marketplace team.",
          reason: "Reason",
          details: "Additional details",
          detailsHelp: "Tell us more if it helps us review the listing.",
          reasons: {
            misleading: "Misleading product information",
            prohibited: "Prohibited or inappropriate item",
            scam: "Suspicious or fraudulent listing",
            other: "Other reason",
          },
          submit: "Send report",
          sending: "Sending…",
          cancel: "Cancel",
          reported: "Reported to the team",
          own: "You cannot report your own listing.",
          otherRequired: "Describe the other reason in at least 10 characters.",
          demo: "In demo mode, this report is only stored in this browser.",
        };

  const submitReport = async () => {
    if (reportReason === "other" && reportDetails.trim().length < 10) {
      setReportError(reportCopy.otherRequired);
      return;
    }
    setReportBusy(true);
    setReportError("");
    try {
      await onReport(reportReason, reportDetails);
      setReportOpen(false);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : reportCopy.help);
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <section className="listing-detail-page" aria-labelledby="listing-page-title">
      <div className="listing-detail-page__inner">
        <a className="listing-detail-page__back" href="/kategoriat/kaikki" onClick={onBack}>
          <span aria-hidden="true">←</span> {copy.allProducts}
        </a>

        <article className="listing-detail-page__card">
          <div className="detail-layout">
            <div className="detail-media-column">
              {activeImageUrl ? (
                <div className="detail-image-stage">
                  <button
                    className="detail-image-open"
                    type="button"
                    aria-label={locale === "fi" ? "Avaa kuva suuressa koossa" : "Open image in full size"}
                    onClick={() => setImageViewerOpen(true)}
                  >
                    <ListingVisual listing={listing} image={activeImage} large />
                    <span>{locale === "fi" ? "Näytä koko kuva" : "View full image"}</span>
                  </button>
                  {images.length > 1 && (
                    <>
                      <button
                        className="detail-image-arrow detail-image-arrow--previous"
                        type="button"
                        aria-label={locale === "fi" ? "Edellinen kuva" : "Previous image"}
                        onClick={showPreviousImage}
                      >
                        <Icon name="arrow" />
                      </button>
                      <button
                        className="detail-image-arrow detail-image-arrow--next"
                        type="button"
                        aria-label={locale === "fi" ? "Seuraava kuva" : "Next image"}
                        onClick={showNextImage}
                      >
                        <Icon name="arrow" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <ListingVisual listing={listing} image={activeImage} large />
              )}
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
                {canEdit ? (
                  <button className="button button--primary" type="button" onClick={onEdit}>
                    <Icon name="edit" />
                    {locale === "fi" ? "Muokkaa ilmoitusta" : "Edit listing"}
                  </button>
                ) : (
                  <button className="button button--primary" type="button" onClick={onBuy} disabled={!canBuy}>
                    {canBuy ? copy.buyNow : copy.ownListing}
                    {canBuy && <Icon name="arrow" />}
                  </button>
                )}
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
                  {listing.brand && (
                    <div>
                      <dt>{copy.brand}</dt>
                      <dd>{listing.brand}</dd>
                    </div>
                  )}
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

              {Object.keys(listing.specs).length > 0 && (
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
              )}

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
                  <span>{listing.shipsTo.map((country) => MARKETS[country].name).join("  ·  ")}</span>
                </div>
              </div>

              <button
                className="report-button"
                type="button"
                disabled={reported || canEdit}
                title={canEdit ? reportCopy.own : undefined}
                onClick={() => (canReport ? setReportOpen(true) : onRequireReportAuth())}
              >
                {reported ? `✓ ${reportCopy.reported}` : copy.report}
              </button>
            </div>
          </div>
        </article>
      </div>

      {imageViewerOpen && activeImageUrl && (
        <ModalShell
          title={`${listing.title}, ${activeImageIndex + 1} / ${images.length}`}
          onClose={() => setImageViewerOpen(false)}
          size="wide"
        >
          <div className="listing-image-viewer">
            <img src={activeImageUrl} alt={activeImage?.alt || listing.title} />
            <div className="listing-image-viewer__controls">
              <button
                className="button button--outline"
                type="button"
                disabled={images.length < 2}
                onClick={showPreviousImage}
              >
                <Icon className="listing-image-viewer__previous" name="arrow" />
                {locale === "fi" ? "Edellinen" : "Previous"}
              </button>
              <strong>
                {activeImageIndex + 1} / {images.length}
              </strong>
              <button
                className="button button--outline"
                type="button"
                disabled={images.length < 2}
                onClick={showNextImage}
              >
                {locale === "fi" ? "Seuraava" : "Next"}
                <Icon name="arrow" />
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {reportOpen && (
        <ModalShell title={reportCopy.title} onClose={() => !reportBusy && setReportOpen(false)}>
          <div className="listing-report-form">
            <h2>{reportCopy.title}</h2>
            <p>{reportCopy.help}</p>
            {backendMode === "demo" && <p>{reportCopy.demo}</p>}
            <label>
              {reportCopy.reason}
              <select
                value={reportReason}
                disabled={reportBusy}
                onChange={(event) => setReportReason(event.target.value as ReportReason)}
              >
                {(Object.keys(reportCopy.reasons) as ReportReason[]).map((reason) => (
                  <option key={reason} value={reason}>
                    {reportCopy.reasons[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {reportCopy.details}
              <textarea
                rows={4}
                maxLength={2000}
                value={reportDetails}
                disabled={reportBusy}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder={reportCopy.detailsHelp}
              />
            </label>
            {reportError && (
              <p className="form-error" role="alert">
                {reportError}
              </p>
            )}
            <div className="listing-report-form__actions">
              <button
                className="button button--outline"
                type="button"
                disabled={reportBusy}
                onClick={() => setReportOpen(false)}
              >
                {reportCopy.cancel}
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={reportBusy}
                onClick={() => void submitReport()}
              >
                {reportBusy ? reportCopy.sending : reportCopy.submit}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  );
}
