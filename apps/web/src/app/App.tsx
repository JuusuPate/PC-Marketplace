import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { ListingCard } from "../components/ListingCard";
import { LAUNCH_MARKET, MARKETS } from "../config/markets";
import { DEMO_LISTINGS } from "../data/demo-listings";
import { AccountModal } from "../features/account/AccountModal";
import { AuthModal } from "../features/auth/AuthModal";
import { CheckoutModal } from "../features/checkout/CheckoutModal";
import { ListingDrawer } from "../features/listings/ListingDrawer";
import { SellModal } from "../features/sell/SellModal";
import { getMessages } from "../i18n";
import { authService } from "../lib/auth-service";
import { demoStorage } from "../lib/demo-storage";
import { listingService } from "../lib/listing-service";
import { formatMoney } from "../lib/money";
import { getRuntimeCopy } from "../lib/runtime-copy";
import { backendMode } from "../lib/supabase";
import type { Category, DemoOrder, DemoUser, Listing, Locale } from "../types";

type SortOption = "newest" | "priceLow" | "bestDeals";

const categories: Array<{ key: "all" | Category; glyph: string }> = [
  { key: "all", glyph: "⌁" },
  { key: "gpu", glyph: "▰" },
  { key: "cpu", glyph: "◆" },
  { key: "memory", glyph: "▥" },
  { key: "motherboard", glyph: "▦" },
  { key: "pc", glyph: "▣" },
];

export function App() {
  const [locale, setLocale] = useState<Locale>("fi");
  const market = LAUNCH_MARKET;
  const [user, setUser] = useState<DemoUser | null>(() => (backendMode === "demo" ? demoStorage.getSession() : null));
  const [customListings, setCustomListings] = useState<Listing[]>(() =>
    backendMode === "demo" ? demoStorage.getListings() : [],
  );
  const [orders, setOrders] = useState<DemoOrder[]>(() => demoStorage.getOrders());
  const [favourites, setFavourites] = useState<string[]>(() => demoStorage.getFavourites());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingSell, setPendingSell] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<Listing | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const copy = getMessages(locale);
  const runtimeCopy = getRuntimeCopy(locale);
  const listings = useMemo(
    () =>
      [...customListings, ...DEMO_LISTINGS]
        .filter(
          (listing) =>
            listing.seller.countryCode === LAUNCH_MARKET &&
            listing.currency === MARKETS[LAUNCH_MARKET].currency &&
            listing.shipsTo.includes(LAUNCH_MARKET),
        )
        .map((listing) => ({ ...listing, shipsTo: [LAUNCH_MARKET] })),
    [customListings],
  );

  useEffect(() => authService.subscribe(setUser), []);

  useEffect(() => {
    if (backendMode !== "supabase") return;
    let isCurrent = true;

    listingService
      .listActive()
      .then((nextListings) => {
        if (isCurrent) setCustomListings(nextListings);
      })
      .catch(() => {
        if (!isCurrent) return;
        setToast(getRuntimeCopy(locale).listingError);
        window.setTimeout(() => setToast(null), 3200);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const visibleListings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = listings.filter((listing) => {
      const haystack =
        `${listing.title} ${listing.subtitle} ${listing.brand} ${Object.values(listing.specs).join(" ")}`.toLocaleLowerCase();
      return (
        listing.shipsTo.includes(market) &&
        (category === "all" || listing.category === category) &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      );
    });
    if (sort === "priceLow") return matches.sort((a, b) => a.priceMinor - b.priceMinor);
    if (sort === "bestDeals")
      return matches.sort((a, b) => Number(b.priceSignal === "great") - Number(a.priceSignal === "great"));
    return matches;
  }, [category, listings, market, query, sort]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const completeAuth = (nextUser: DemoUser) => {
    setUser(nextUser);
    if (backendMode === "demo") demoStorage.setSession(nextUser);
    setAuthOpen(false);
    if (pendingCheckout) {
      setSelectedListing(null);
      setCheckoutListing(pendingCheckout);
      setPendingCheckout(null);
    } else if (pendingSell) {
      setSellOpen(true);
      setPendingSell(false);
    }
  };

  const requireSellAuth = () => {
    if (user) setSellOpen(true);
    else {
      setPendingSell(true);
      setAuthOpen(true);
    }
  };

  const beginCheckout = (listing: Listing) => {
    if (user?.id === listing.seller.id) return;
    if (user) {
      setSelectedListing(null);
      setCheckoutListing(listing);
    } else {
      setPendingCheckout(listing);
      setAuthOpen(true);
    }
  };

  const publishListing = async (listing: Listing) => {
    const savedListing = await listingService.create(listing, market);
    setCustomListings((current) => {
      const next = [savedListing, ...current];
      if (backendMode === "demo") demoStorage.setListings(next);
      return next;
    });
    setSellOpen(false);
    setCategory("all");
    showToast(copy.published);
    window.setTimeout(() => document.querySelector("#marketplace")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const completeOrder = (order: DemoOrder) => {
    const next = [order, ...orders];
    setOrders(next);
    demoStorage.setOrders(next);
    setCheckoutListing(null);
    showToast(`${copy.orderCreated} — ${copy.orderCreatedBody}`);
  };

  const toggleFavourite = (listingId: string) => {
    const next = favourites.includes(listingId)
      ? favourites.filter((id) => id !== listingId)
      : [...favourites, listingId];
    setFavourites(next);
    demoStorage.setFavourites(next);
  };

  const logout = async () => {
    try {
      await authService.signOut();
    } finally {
      setUser(null);
      if (backendMode === "demo") demoStorage.setSession(null);
      setAccountOpen(false);
    }
  };

  return (
    <div id="top">
      <div className="demo-banner">
        <span>{backendMode === "supabase" ? runtimeCopy.connectedBadge : copy.demoBadge}</span>
        <p>{backendMode === "supabase" ? runtimeCopy.connectedNotice : copy.demoNotice}</p>
      </div>
      <Header
        copy={copy}
        locale={locale}
        market={market}
        user={user}
        onLocale={setLocale}
        onAuth={() => setAuthOpen(true)}
        onSell={requireSellAuth}
        onAccount={() => setAccountOpen(true)}
      />

      <main>
        <section className="hero section-shell">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              {copy.heroEyebrow}
              <span className="eyebrow-market">
                {MARKETS[market].flag} {MARKETS[market].status.toUpperCase()}
              </span>
            </div>
            <h1>
              {copy.heroTitleA}
              <br />
              <em>{copy.heroTitleB}</em>
            </h1>
            <p>{copy.heroBody}</p>
            <div className="hero-actions">
              <a className="button button--primary" href="#marketplace">
                {copy.browseDeals}
                <Icon name="arrow" />
              </a>
              <button className="button button--outline" type="button" onClick={requireSellAuth}>
                <Icon name="plus" />
                {copy.listForSale}
              </button>
            </div>
            <div className="hero-proof">
              <div>
                <strong>1.5%</strong>
                <span>demo fee</span>
              </div>
              <div>
                <strong>48 h</strong>
                <span>inspection</span>
              </div>
              <div>
                <strong>1</strong>
                <span>{copy.launchMarket}</span>
              </div>
            </div>
          </div>
          <div className="hero-art" aria-label="Esimerkkituotteen kortti">
            <div className="hero-glow" />
            <div className="hero-card hero-card--back">
              <span>PRICE INTELLIGENCE</span>
              <strong>−8.4%</strong>
              <small>vs. 30 day median</small>
            </div>
            <div className="hero-product">
              <div className="hero-product-top">
                <span>VERIFIED HARDWARE</span>
                <Icon name="check" />
              </div>
              <div className="hero-gpu">
                <span>GEFORCE</span>
                <strong>RTX</strong>
                <small>4070 SUPER</small>
                <i />
                <i />
                <i />
              </div>
              <div className="hero-product-copy">
                <div>
                  <small>ASUS TUF GAMING</small>
                  <strong>RTX 4070 SUPER OC</strong>
                </div>
                <strong>{formatMoney(48900, "EUR", locale)}</strong>
              </div>
              <div className="hero-product-foot">
                <span>
                  <Icon name="shield" /> {copy.buyerProtection}
                </span>
                <span>🇫🇮 FI</span>
              </div>
            </div>
            <div className="hero-card hero-card--front">
              <span className="pulse" />
              <div>
                <small>MARKET SIGNAL</small>
                <strong>{copy.great}</strong>
              </div>
              <span>↑ 94</span>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div>
            <Icon name="shield" />
            <span>
              <strong>{copy.protectedPurchases}</strong>
              <small>48 h inspection window</small>
            </span>
          </div>
          <div>
            <Icon name="check" />
            <span>
              <strong>{copy.verifiedSellers}</strong>
              <small>Identity & trade history</small>
            </span>
          </div>
          <div>
            <Icon name="truck" />
            <span>
              <strong>{copy.marketShipping}</strong>
              <small>{copy.shippingArea}</small>
            </span>
          </div>
        </section>

        <section className="marketplace-section section-shell" id="marketplace">
          <div className="section-heading">
            <div>
              <span className="section-index">01 / MARKET</span>
              <h2>{copy.marketplace}</h2>
            </div>
            <span className="listing-count">
              {visibleListings.length} {copy.listings} · {MARKETS[market].flag} {MARKETS[market].name}
            </span>
          </div>
          <div className="market-toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="sort-select">
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                <option value="newest">{copy.newest}</option>
                <option value="priceLow">{copy.priceLow}</option>
                <option value="bestDeals">{copy.bestDeals}</option>
              </select>
              <Icon name="chevron" />
            </label>
          </div>
          <div className="category-row">
            {categories.map((item) => (
              <button
                key={item.key}
                type="button"
                className={category === item.key ? "active" : ""}
                onClick={() => setCategory(item.key)}
              >
                <span>{item.glyph}</span>
                {copy[item.key]}
              </button>
            ))}
          </div>
          {visibleListings.length > 0 ? (
            <div className="listing-grid">
              {visibleListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  locale={locale}
                  copy={copy}
                  favourite={favourites.includes(listing.id)}
                  onFavourite={() => toggleFavourite(listing.id)}
                  onOpen={() => setSelectedListing(listing)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div>⌁</div>
              <h3>{copy.noResults}</h3>
              <button
                className="button button--outline"
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                {copy.resetFilters}
              </button>
            </div>
          )}
        </section>

        <section className="protection-section" id="safety">
          <div className="section-shell protection-inner">
            <div className="protection-art">
              <div className="protection-ring protection-ring--one" />
              <div className="protection-ring protection-ring--two" />
              <div className="large-shield">
                <Icon name="shield" />
                <span>48H</span>
              </div>
              <div className="protection-chip chip--top">
                <Icon name="package" />
                <span>
                  TRACKED<small>Shipment verified</small>
                </span>
              </div>
              <div className="protection-chip chip--bottom">
                <Icon name="check" />
                <span>
                  PAYOUT<small>Ready after inspection</small>
                </span>
              </div>
            </div>
            <div className="protection-copy">
              <span className="section-index section-index--light">02 / PROTECTION</span>
              <h2>{copy.protectionTitle}</h2>
              <p>{copy.protectionBody}</p>
              <div className="protection-points">
                <span>
                  <Icon name="check" /> Serial evidence
                </span>
                <span>
                  <Icon name="check" /> Tracked delivery
                </span>
                <span>
                  <Icon name="check" /> Dispute workflow
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="how-section section-shell" id="how-it-works">
          <div className="section-heading">
            <div>
              <span className="section-index">03 / FLOW</span>
              <h2>{copy.howTitle}</h2>
            </div>
          </div>
          <div className="steps-grid">
            {[copy.stepList, copy.stepBuy, copy.stepInspect, copy.stepPayout].map((step, index) => (
              <article key={step}>
                <span className="step-number">0{index + 1}</span>
                <div className="step-icon">
                  <Icon name={index === 0 ? "plus" : index === 1 ? "shield" : index === 2 ? "truck" : "check"} />
                </div>
                <h3>{step}</h3>
                {index < 3 && <Icon className="step-arrow" name="arrow" />}
              </article>
            ))}
          </div>
        </section>

        <section className="cta-section section-shell">
          <div>
            <span className="section-index section-index--light">{copy.launchBadge}</span>
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
            <button
              className="button button--light"
              type="button"
              onClick={() => (user ? setAccountOpen(true) : setAuthOpen(true))}
            >
              {copy.joinDemo}
              <Icon name="arrow" />
            </button>
          </div>
          <div className="cta-map cta-map--finland" aria-label={copy.shippingArea}>
            <span className="map-country map-fi">
              FI<small>LIVE</small>
            </span>
          </div>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            <strong>PC MARKET</strong>
            <small>{copy.footerNote}</small>
          </span>
        </a>
        <div>
          <a href="#terms">{copy.terms}</a>
          <a href="#privacy">{copy.privacy}</a>
          <a href="#accessibility">{copy.accessibility}</a>
        </div>
        <span>© 2026 PC Market Demo</span>
      </footer>

      {selectedListing && (
        <ListingDrawer
          listing={selectedListing}
          copy={copy}
          locale={locale}
          favourite={favourites.includes(selectedListing.id)}
          canBuy={!user || user.id !== selectedListing.seller.id}
          onFavourite={() => toggleFavourite(selectedListing.id)}
          onBuy={() => beginCheckout(selectedListing)}
          onClose={() => setSelectedListing(null)}
        />
      )}
      {authOpen && (
        <AuthModal
          copy={copy}
          locale={locale}
          market={market}
          onClose={() => {
            setAuthOpen(false);
            setPendingSell(false);
            setPendingCheckout(null);
          }}
          onComplete={completeAuth}
        />
      )}
      {sellOpen && user && (
        <SellModal
          copy={copy}
          locale={locale}
          market={market}
          user={user}
          onClose={() => setSellOpen(false)}
          onPublish={publishListing}
        />
      )}
      {checkoutListing && (
        <CheckoutModal
          listing={checkoutListing}
          copy={copy}
          locale={locale}
          onClose={() => setCheckoutListing(null)}
          onComplete={completeOrder}
        />
      )}
      {accountOpen && user && (
        <AccountModal
          copy={copy}
          locale={locale}
          user={user}
          orders={orders}
          ownListings={customListings.filter((listing) => listing.seller.id === user.id)}
          onClose={() => setAccountOpen(false)}
          onLogout={logout}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" />
          {toast}
        </div>
      )}
    </div>
  );
}
