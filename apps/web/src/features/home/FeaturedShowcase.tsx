import { useEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import { ListingVisual } from "../../components/ListingVisual";
import { getListingPath } from "../../config/listing-routes";
import { DEMO_FEATURED_ENGAGEMENT } from "../../data/demo-featured-engagement";
import type { Messages } from "../../i18n/messages/fi";
import { selectFeaturedListings } from "../../lib/featured-listings";
import { formatMoney } from "../../lib/money";
import type { Listing, Locale } from "../../types";

const SHOWCASE_SIZE = 3;
const ROTATION_INTERVAL_MS = 7_500;
const TRANSITION_MIDPOINT_MS = 190;

interface FeaturedShowcaseProps {
  listings: readonly Listing[];
  locale: Locale;
  copy: Messages;
  onOpen: (listing: Listing) => void;
}

function selectIds(listings: readonly Listing[], count = SHOWCASE_SIZE) {
  return selectFeaturedListings(listings, DEMO_FEATURED_ENGAGEMENT, count).map((listing) => listing.id);
}

export function FeaturedShowcase({ listings, locale, copy, onOpen }: FeaturedShowcaseProps) {
  const [featuredIds, setFeaturedIds] = useState(() => selectIds(listings));
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const [pointerPaused, setPointerPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(document.hidden);
  const [isSwitching, setIsSwitching] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const listingSignature = listings.map((listing) => listing.id).join("|");

  const featuredListings = useMemo(
    () => featuredIds.map((id) => listings.find((listing) => listing.id === id)).filter(Boolean) as Listing[],
    [featuredIds, listings],
  );

  const orderedListings = useMemo(() => {
    if (featuredListings.length === 0) return [];
    return featuredListings.map((_, offset) => featuredListings[(activeIndex + offset) % featuredListings.length]);
  }, [activeIndex, featuredListings]);

  useEffect(() => {
    const desiredCount = Math.min(SHOWCASE_SIZE, listings.length);
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (transitionFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionFrameRef.current);
      transitionFrameRef.current = null;
    }
    setIsSwitching(false);

    setFeaturedIds((currentIds) => {
      const validIds = currentIds.filter((id) => listings.some((listing) => listing.id === id)).slice(0, desiredCount);
      if (validIds.length === desiredCount) return validIds;

      const validIdSet = new Set(validIds);
      const additions = selectIds(
        listings.filter((listing) => !validIdSet.has(listing.id)),
        desiredCount - validIds.length,
      );
      return [...validIds, ...additions];
    });
    setActiveIndex((currentIndex) => Math.min(currentIndex, Math.max(0, desiredCount - 1)));
  }, [listingSignature, listings]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(
    () => () => {
      if (transitionTimeoutRef.current !== null) window.clearTimeout(transitionTimeoutRef.current);
      if (transitionFrameRef.current !== null) window.cancelAnimationFrame(transitionFrameRef.current);
    },
    [],
  );

  const replaceFeaturedGroup = () => {
    const desiredCount = Math.min(SHOWCASE_SIZE, listings.length);
    const currentIdSet = new Set(featuredIds);
    const unseenListings = listings.filter((listing) => !currentIdSet.has(listing.id));
    const pool = unseenListings.length >= desiredCount ? unseenListings : listings;
    const nextIds = selectIds(pool, desiredCount);
    const previousActiveId = featuredListings[activeIndex]?.id;

    if (nextIds.length > 1 && nextIds[0] === previousActiveId) {
      nextIds.push(nextIds.shift() as string);
    }

    setFeaturedIds(nextIds);
    setActiveIndex(0);
  };

  const applyNext = () => {
    if (featuredListings.length <= 1) return;
    if (activeIndex < featuredListings.length - 1) {
      setActiveIndex(activeIndex + 1);
      return;
    }
    replaceFeaturedGroup();
  };

  const applyPrevious = () => {
    if (featuredListings.length <= 1) return;
    setActiveIndex((activeIndex - 1 + featuredListings.length) % featuredListings.length);
  };

  const switchFeatured = (update: () => void) => {
    if (isSwitching) return;
    if (prefersReducedMotion) {
      update();
      return;
    }

    setIsSwitching(true);
    transitionTimeoutRef.current = window.setTimeout(() => {
      transitionTimeoutRef.current = null;
      update();
      transitionFrameRef.current = window.requestAnimationFrame(() => {
        transitionFrameRef.current = window.requestAnimationFrame(() => {
          transitionFrameRef.current = null;
          setIsSwitching(false);
        });
      });
    }, TRANSITION_MIDPOINT_MS);
  };

  const showNext = () => switchFeatured(applyNext);
  const showPrevious = () => switchFeatured(applyPrevious);

  useEffect(() => {
    if (
      featuredListings.length <= 1 ||
      prefersReducedMotion ||
      pointerPaused ||
      focusPaused ||
      documentHidden ||
      isSwitching
    ) {
      return;
    }

    const timeoutId = window.setTimeout(showNext, ROTATION_INTERVAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, documentHidden, featuredIds, focusPaused, isSwitching, pointerPaused, prefersReducedMotion]);

  if (orderedListings.length === 0) return null;

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>, listing: Listing) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen(listing);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusPaused(false);
  };

  return (
    <section
      className={`featured-showcase${isSwitching ? " is-switching" : ""}`}
      aria-label={copy.featuredShowcase}
      aria-roledescription="carousel"
      aria-busy={isSwitching}
      onMouseEnter={() => setPointerPaused(true)}
      onMouseLeave={() => setPointerPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div className="hero-glow" aria-hidden="true" />
      <div className="featured-showcase__grid">
        {orderedListings.map((listing, index) => {
          const isPrimary = index === 0;
          return (
            <a
              className={`featured-card ${isPrimary ? "featured-card--primary" : "featured-card--secondary"}`}
              href={getListingPath(listing.id)}
              key={listing.id}
              aria-label={`${copy.viewItem}: ${listing.title}`}
              onClick={(event) => handleOpen(event, listing)}
            >
              <div className="featured-card__media">
                <ListingVisual listing={listing} />
                <span className={`featured-card__signal signal--${listing.priceSignal}`}>
                  {copy[listing.priceSignal]}
                </span>
              </div>
              <div className="featured-card__content">
                <div className="featured-card__eyebrow">
                  <span>{isPrimary ? copy.featuredListing : copy[listing.category]}</span>
                  {isPrimary && (
                    <span>
                      {activeIndex + 1} / {featuredListings.length}
                    </span>
                  )}
                </div>
                <strong className="featured-card__title">{listing.title}</strong>
                {isPrimary && <p>{listing.subtitle}</p>}
                <div className="featured-card__meta">
                  <strong>{formatMoney(listing.priceMinor, listing.currency, locale)}</strong>
                  <span>{listing.city}</span>
                </div>
                {isPrimary && (
                  <div className="featured-card__footer">
                    <span>
                      <Icon name="shield" /> {copy.buyerProtection}
                    </span>
                    <span>
                      {copy.viewFeatured} <Icon name="arrow" />
                    </span>
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {featuredListings.length > 1 && (
        <div className="featured-showcase__controls">
          <span>{copy.featuredLogic}</span>
          <div role="group" aria-label={copy.featuredControls}>
            <button type="button" aria-label={copy.previousFeatured} aria-disabled={isSwitching} onClick={showPrevious}>
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" aria-label={copy.nextFeatured} aria-disabled={isSwitching} onClick={showNext}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
