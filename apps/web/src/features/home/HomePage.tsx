import InfiniteSpiral from "../../components/InfiniteSpiral";
import { heroSpiralItems } from "./hero-spiral-items";
import { HomeMarketingAnnouncement } from "./HomeMarketingAnnouncement";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListingCard } from "../../components/ListingCard";
import { Icon } from "../../components/Icon";
import { getListingPath } from "../../config/listing-routes";
import type { Messages } from "../../i18n/messages/fi";
import { newestHomeListings, recommendHomeListings } from "../../lib/home-recommendations";
import { loadOfficialListings } from "../../lib/home-official-service";
import type { Listing, Locale } from "../../types";
import { getHomeCopy } from "./home-copy";

type Props = {
  locale: Locale;
  copy: Messages;
  listings: Listing[];
  favouriteListings: Listing[];
  favourites: string[];
  viewedIds: string[];
  userId?: string;
  seed: number;
  rankingTime: number;
  expanded: boolean;
  onExpand: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onNavigate: (path: string) => void;
  onFavourite: (id: string) => void;
};
export function HomePage(props: Props) {
  const { locale, copy, listings, favourites, onFavourite, onNavigate } = props;
  const text = getHomeCopy(locale);
  const [motionPaused, setMotionPaused] = useState(false);
  const latest = useMemo(() => newestHomeListings(listings).slice(0, 5), [listings]);
  const recommended = useMemo(
    () =>
      recommendHomeListings(
        listings,
        props.favouriteListings,
        props.viewedIds,
        props.userId,
        props.seed,
        props.rankingTime,
      ),
    [listings, props.favouriteListings, props.viewedIds, props.userId, props.seed, props.rankingTime],
  );
  const shown = recommended.slice(0, props.expanded ? 48 : 24);
  const renderCard = (listing: Listing) => (
    <ListingCard
      key={listing.id}
      listing={listing}
      locale={locale}
      copy={copy}
      favourite={favourites.includes(listing.id)}
      href={getListingPath(listing.id)}
      onFavourite={() => onFavourite(listing.id)}
      onOpen={() => onNavigate(getListingPath(listing.id))}
    />
  );
  const state = props.loading ? (
    <p className="home-feed__state" role="status">
      {text.loading}
    </p>
  ) : props.error ? (
    <div className="home-feed__state" role="alert">
      {text.error}{" "}
      <button className="text-button" onClick={props.onRetry}>
        {text.retry}
      </button>
    </div>
  ) : (
    <p className="home-feed__state">{text.empty}</p>
  );
  const link = (path: string, label: string) => (
    <a
      href={path}
      onClick={(event) => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(path);
      }}
    >
      {label}
      <Icon name="arrow" />
    </a>
  );
  return (
    <div className="home-storefront">
      <section
        className={`storefront-hero${motionPaused ? " storefront-hero--paused" : ""}`}
        aria-labelledby="storefront-title"
      >
        <div className="storefront-hero__inner section-shell">
          <div>
            <span className="storefront-hero__eyebrow">RIGI / PC MARKETPLACE</span>
            <h1 id="storefront-title">{text.title}</h1>
            <p>{text.body}</p>
          </div>
          <div className="storefront-hero__spiral" aria-hidden="true">
            <InfiniteSpiral
              items={heroSpiralItems}
              paused={motionPaused}
              animationMode="auto"
              speed={0.4}
              radius={105}
              cardWidth={85}
              cardHeight={85}
              verticalSpacing={45}
              edgeBlur={4}
              imageFit="contain"
            />
          </div>
          <a
            className="button button--primary"
            href="/kategoriat/kaikki"
            onClick={(event) => {
              if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate("/kategoriat/kaikki");
            }}
          >
            {text.browse}
            <Icon name="arrow" />
          </a>
        </div>
        <button
          className="storefront-hero__pause"
          type="button"
          aria-pressed={motionPaused}
          onClick={() => setMotionPaused(!motionPaused)}
        >
          {motionPaused ? text.resumeAnimation : text.pauseAnimation}
        </button>
      </section>
      <HomeMarketingAnnouncement locale={locale} />
      <section className="home-feed section-shell" aria-labelledby="home-latest">
        <div className="home-feed__heading">
          <h2 id="home-latest">
            <span aria-hidden="true">↗</span> {text.newest}
          </h2>
          {link("/kategoriat/kaikki", text.all)}
        </div>
        {latest.length ? <div className="home-feed__grid home-feed__grid--five">{latest.map(renderCard)}</div> : state}
      </section>
      <OfficialSection key={props.userId ?? "anonymous"} locale={locale} renderCard={renderCard} />
      <section className="home-feed home-feed--recommended section-shell" aria-labelledby="home-recommended">
        <div className="home-feed__heading">
          <h2 id="home-recommended">
            <span aria-hidden="true">✦</span> {text.recommendations}
          </h2>
        </div>
        <p className="home-feed__description">{text.explanation}</p>
        {shown.length ? (
          <div id="recommendation-grid" className="home-feed__grid home-feed__grid--six">
            {shown.map(renderCard)}
          </div>
        ) : (
          state
        )}
        {!!shown.length && (
          <div className="home-feed__more">
            <p role="status">
              {shown.length} {text.count}
            </p>
            {!props.expanded && recommended.length > 24 ? (
              <button className="button button--outline" aria-controls="recommendation-grid" onClick={props.onExpand}>
                <Icon name="plus" />
                {text.more}
              </button>
            ) : (
              <p className="home-feed__description">{text.limit}</p>
            )}
          </div>
        )}
      </section>
      <section className="home-trust section-shell" aria-labelledby="home-trust-title">
        <div className="home-feed__heading">
          <h2 id="home-trust-title">{text.trust}</h2>
          {link("/turvallisuus", text.safety)}
        </div>
        <div className="home-trust__grid">
          {[
            ["shield", text.payment, text.paymentBody],
            ["check", text.verified, text.verifiedBody],
            ["truck", text.shipping, text.shippingBody],
          ].map(([icon, title, body]) => (
            <div key={title}>
              <Icon name={icon as "shield" | "check" | "truck"} />
              <span>
                <strong>{title}</strong>
                <small>{body}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function OfficialSection({
  locale,
  renderCard,
}: {
  locale: Locale;
  renderCard: (listing: Listing) => React.ReactNode;
}) {
  const text = getHomeCopy(locale);
  const [items, setItems] = useState<Listing[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [request, setRequest] = useState(0);
  const nextOffset = useRef(0);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      setOffset(0);
      setRequest((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    loadOfficialListings(offset)
      .then((result) => {
        if (!current) return;
        setItems((previous) =>
          offset === 0
            ? result.listings
            : [...new Map([...previous, ...result.listings].map((item) => [item.id, item])).values()],
        );
        setHasMore(result.hasMore);
        nextOffset.current = result.nextOffset;
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [offset, request]);
  if (!loading && !error && items.length === 0) return null;
  return (
    <section className="home-feed home-feed--official section-shell" aria-labelledby="home-official">
      <div className="home-feed__heading">
        <h2 id="home-official">{text.official}</h2>
        {items.length > 5 && (
          <button
            className="text-button"
            aria-expanded={expanded}
            aria-controls="official-grid"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? text.less : text.all}
            <Icon name="arrow" />
          </button>
        )}
      </div>
      <p className="home-feed__description">{text.officialBody}</p>
      <div id="official-grid" className="home-feed__grid home-feed__grid--five">
        {(expanded ? items : items.slice(0, 5)).map((item) => (
          <div className="home-official-product" key={item.id}>
            {renderCard(item)}
            <span className="home-official-product__badge">
              <Icon name="check" /> Rigi
            </span>
          </div>
        ))}
      </div>
      {loading && (
        <p className="home-feed__state" role="status">
          {text.loading}
        </p>
      )}
      {error && (
        <p className="home-feed__state" role="alert">
          {text.error}{" "}
          <button className="text-button" onClick={() => setRequest(request + 1)}>
            {text.retry}
          </button>
        </p>
      )}
      {expanded && hasMore && !loading && !error && (
        <div className="home-feed__more">
          <button className="button button--outline" onClick={() => setOffset(nextOffset.current)}>
            {text.moreOfficial}
          </button>
        </div>
      )}
    </section>
  );
}
