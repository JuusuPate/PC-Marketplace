import { useEffect, useMemo, useState } from "react";
import { CategoryNavigation } from "../components/CategoryNavigation";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { ListingCard } from "../components/ListingCard";
import { getCatalogPage } from "../config/catalog";
import { getLegalPath, getLegalRoute } from "../config/legal-routes";
import { getListingId, getListingPath } from "../config/listing-routes";
import { LAUNCH_MARKET, MARKETS } from "../config/markets";
import { DEMO_LISTINGS } from "../data/demo-listings";
import { AccountModal } from "../features/account/AccountModal";
import { AuthModal } from "../features/auth/AuthModal";
import { CategoryHero } from "../features/catalog/CategoryHero";
import { CheckoutModal } from "../features/checkout/CheckoutModal";
import { ListingDetailPage } from "../features/listings/ListingDetailPage";
import { LegalPage } from "../features/legal/LegalPage";
import { CreateListingPage } from "../features/sell/CreateListingPage";
import { getMessages } from "../i18n";
import { authService } from "../lib/auth-service";
import { demoStorage } from "../lib/demo-storage";
import type { PreparedListingImage } from "../lib/listing-images";
import { listingService } from "../lib/listing-service";
import { formatMoney } from "../lib/money";
import { getRuntimeCopy } from "../lib/runtime-copy";
import { backendMode } from "../lib/supabase";
import type { Category, DemoOrder, DemoUser, Listing, Locale, PrivatePickupAddress } from "../types";

type SortOption = "newest" | "priceLow" | "bestDeals";

const CREATE_LISTING_PATH = "/myy/uusi";

function isCreateListingPath(pathname: string) {
  return (pathname.replace(/\/+$/, "") || "/") === CREATE_LISTING_PATH;
}

function isLaunchListing(listing: Listing) {
  return (
    listing.seller.countryCode === LAUNCH_MARKET &&
    listing.currency === MARKETS[LAUNCH_MARKET].currency &&
    listing.shipsTo.includes(LAUNCH_MARKET)
  );
}

const categories: Array<{ key: "all" | Category; glyph: string }> = [
  { key: "all", glyph: "⌁" },
  { key: "gpu", glyph: "▰" },
  { key: "cpu", glyph: "◆" },
  { key: "memory", glyph: "▥" },
  { key: "motherboard", glyph: "▦" },
  { key: "pc", glyph: "▣" },
  { key: "other", glyph: "⌨" },
];

export function App() {
  const [locale, setLocale] = useState<Locale>("fi");
  const market = LAUNCH_MARKET;
  const [catalogPage, setCatalogPage] = useState(() => getCatalogPage(window.location.pathname));
  const [legalRoute, setLegalRoute] = useState(() => getLegalRoute(window.location.pathname));
  const [createListingPage, setCreateListingPage] = useState(() => isCreateListingPath(window.location.pathname));
  const [listingPageId, setListingPageId] = useState(() => getListingId(window.location.pathname));
  const [routeListing, setRouteListing] = useState<Listing | null>(null);
  const [listingRouteLoading, setListingRouteLoading] = useState(() => Boolean(getListingId(window.location.pathname)));
  const [user, setUser] = useState<DemoUser | null>(() => (backendMode === "demo" ? demoStorage.getSession() : null));
  const [customListings, setCustomListings] = useState<Listing[]>(() =>
    backendMode === "demo" ? demoStorage.getListings() : [],
  );
  const [orders, setOrders] = useState<DemoOrder[]>(() => demoStorage.getOrders());
  const [favourites, setFavourites] = useState<string[]>(() => demoStorage.getFavourites());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [checkoutListing, setCheckoutListing] = useState<Listing | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingSell, setPendingSell] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<Listing | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const copy = getMessages(locale);
  const runtimeCopy = getRuntimeCopy(locale);
  const listings = useMemo(
    () =>
      [...customListings, ...DEMO_LISTINGS]
        .filter(isLaunchListing)
        .map((listing) => ({ ...listing, shipsTo: [LAUNCH_MARKET] })),
    [customListings],
  );

  const activeListing = useMemo(() => {
    if (!listingPageId) return null;
    return (
      listings.find((listing) => listing.id === listingPageId) ??
      (routeListing?.id === listingPageId ? routeListing : null)
    );
  }, [listingPageId, listings, routeListing]);

  const catalogListings = useMemo(() => {
    if (!catalogPage?.categories) return listings;
    return listings.filter((listing) => catalogPage.categories?.includes(listing.category));
  }, [catalogPage, listings]);

  const categoryFilters = useMemo(() => {
    if (!catalogPage || catalogPage.id === "all") return categories;
    if (catalogPage.id === "components") {
      return categories.filter((item) => item.key === "all" || (item.key !== "pc" && item.key !== "other"));
    }
    return [];
  }, [catalogPage]);

  useEffect(() => authService.subscribe(setUser), []);

  useEffect(() => {
    const syncRoute = () => {
      const nextListingId = getListingId(window.location.pathname);
      setCatalogPage(getCatalogPage(window.location.pathname));
      setLegalRoute(getLegalRoute(window.location.pathname));
      setCreateListingPage(isCreateListingPath(window.location.pathname));
      setListingPageId(nextListingId);
      setListingRouteLoading(Boolean(nextListingId));
      setCategory("all");
      setQuery("");
    };

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (!listingPageId || listings.some((listing) => listing.id === listingPageId)) {
      setRouteListing(null);
      setListingRouteLoading(false);
      return;
    }

    let isCurrent = true;
    setRouteListing(null);
    setListingRouteLoading(true);

    listingService
      .getActiveById(listingPageId)
      .then((listing) => {
        if (!isCurrent) return;
        setRouteListing(listing && isLaunchListing(listing) ? { ...listing, shipsTo: [LAUNCH_MARKET] } : null);
      })
      .catch(() => {
        if (isCurrent) showToast(getRuntimeCopy(locale).listingError);
      })
      .finally(() => {
        if (isCurrent) setListingRouteLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [listingPageId, listings]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = legalRoute
      ? `${copy[legalRoute.labelKey]} | PC Market`
      : activeListing
        ? `${activeListing.title} | PC Market`
        : listingPageId
          ? `${copy.noResults} | PC Market`
          : createListingPage
            ? `${copy.sellTitle} | PC Market`
            : catalogPage
              ? `${copy[catalogPage.labelKey]} | PC Market`
              : copy.siteTitle;
  }, [activeListing, catalogPage, copy, createListingPage, legalRoute, listingPageId, locale]);

  useEffect(() => {
    if (!createListingPage) return;
    if (user) {
      setAuthOpen(false);
      setPendingSell(false);
      return;
    }
    setPendingSell(true);
    setAuthOpen(true);
  }, [createListingPage, user]);

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
    const matches = catalogListings.filter((listing) => {
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
  }, [catalogListings, category, market, query, sort]);

  const navigateTo = (path: string, hash = "") => {
    const target = `${path}${hash}`;
    if (`${window.location.pathname}${window.location.hash}` !== target) {
      window.history.pushState({}, "", target);
    }

    const nextPage = getCatalogPage(path);
    const nextLegalRoute = getLegalRoute(path);
    const nextListingId = getListingId(path);
    setCatalogPage(nextPage);
    setLegalRoute(nextLegalRoute);
    setCreateListingPage(isCreateListingPath(path));
    setListingPageId(nextListingId);
    setListingRouteLoading(Boolean(nextListingId && !listings.some((listing) => listing.id === nextListingId)));
    setCategory("all");
    setQuery("");

    window.setTimeout(() => {
      if (hash) {
        document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (nextPage) document.querySelector<HTMLElement>("#category-page-title")?.focus({ preventScroll: true });
      if (nextListingId) document.querySelector<HTMLElement>("#listing-page-title")?.focus({ preventScroll: true });
      if (nextLegalRoute) document.querySelector<HTMLElement>("#legal-page-title")?.focus({ preventScroll: true });
    }, 0);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const completeAuth = (nextUser: DemoUser) => {
    setUser(nextUser);
    if (backendMode === "demo") demoStorage.setSession(nextUser);
    setAuthOpen(false);
    if (pendingCheckout) {
      setCheckoutListing(pendingCheckout);
      setPendingCheckout(null);
    } else if (pendingSell) {
      setPendingSell(false);
      navigateTo(CREATE_LISTING_PATH);
    }
  };

  const requireSellAuth = () => {
    if (user) navigateTo(CREATE_LISTING_PATH);
    else {
      setPendingSell(true);
      setAuthOpen(true);
    }
  };

  const beginCheckout = (listing: Listing) => {
    if (user?.id === listing.seller.id) return;
    if (user) {
      setCheckoutListing(listing);
    } else {
      setPendingCheckout(listing);
      setAuthOpen(true);
    }
  };

  const publishListing = async (
    listing: Listing,
    images: PreparedListingImage[],
    pickupAddress: PrivatePickupAddress,
  ) => {
    const savedListing = await listingService.create(listing, market, images, pickupAddress);
    const nextListings = [savedListing, ...customListings];
    if (backendMode === "demo") {
      try {
        demoStorage.setListings(nextListings);
      } catch (caught) {
        demoStorage.removePrivatePickupAddress(savedListing.id, listing.seller.id);
        throw caught;
      }
    }
    setCustomListings(nextListings);
    setCategory("all");
    showToast(copy.published);
    navigateTo(getListingPath(savedListing.id));
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
      if (createListingPage) navigateTo("/");
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
        user={user}
        onHome={(hash) => navigateTo("/", hash)}
        onLocale={setLocale}
        onAuth={() => setAuthOpen(true)}
        onSell={requireSellAuth}
        onAccount={() => setAccountOpen(true)}
      />

      <CategoryNavigation copy={copy} activePageId={catalogPage?.id ?? null} onNavigate={(path) => navigateTo(path)} />

      <main>
        {legalRoute && (
          <LegalPage route={legalRoute} locale={locale} copy={copy} user={user} onHome={() => navigateTo("/")} />
        )}

        {createListingPage && user && (
          <CreateListingPage
            copy={copy}
            locale={locale}
            market={market}
            user={user}
            seller={customListings.find((listing) => listing.seller.id === user.id)?.seller}
            onCancel={() => navigateTo("/kategoriat/kaikki")}
            onPublish={publishListing}
          />
        )}

        {listingPageId &&
          (activeListing ? (
            <ListingDetailPage
              listing={activeListing}
              copy={copy}
              locale={locale}
              favourite={favourites.includes(activeListing.id)}
              canBuy={!user || user.id !== activeListing.seller.id}
              onBack={(event) => {
                event.preventDefault();
                navigateTo("/kategoriat/kaikki");
              }}
              onFavourite={() => toggleFavourite(activeListing.id)}
              onBuy={() => beginCheckout(activeListing)}
            />
          ) : (
            <section className="listing-page-state section-shell" aria-busy={listingRouteLoading}>
              <div aria-hidden="true">{listingRouteLoading ? "…" : "⌁"}</div>
              <h1 id="listing-page-title" tabIndex={-1}>
                {listingRouteLoading ? copy.marketplace : copy.noResults}
              </h1>
              {!listingRouteLoading && (
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => navigateTo("/kategoriat/kaikki")}
                >
                  {copy.allProducts}
                </button>
              )}
            </section>
          ))}

        {!legalRoute &&
          !listingPageId &&
          (!createListingPage || !user) &&
          (catalogPage ? (
            <CategoryHero
              page={catalogPage}
              copy={copy}
              listingCount={catalogListings.length}
              onHome={() => navigateTo("/")}
              onSell={requireSellAuth}
            />
          ) : (
            <>
              <section className="hero section-shell">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="eyebrow-dot" />
                    {copy.heroEyebrow}
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
                      <strong>7</strong>
                      <span>{copy.categoryNavigation}</span>
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
                  </span>
                </div>
              </section>
            </>
          ))}

        {!legalRoute && !listingPageId && (!createListingPage || !user) && (
          <section
            className={`marketplace-section section-shell${catalogPage ? " marketplace-section--category" : ""}`}
            id="marketplace"
          >
            <div className="section-heading">
              <div>
                <span className="section-index">{catalogPage ? "01 / CATEGORY" : "01 / MARKET"}</span>
                <h2>{catalogPage ? copy.categoryListings : copy.marketplace}</h2>
              </div>
              <span className="listing-count">
                {visibleListings.length} {copy.listings}
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
            {categoryFilters.length > 0 && (
              <div className="category-row">
                {categoryFilters.map((item) => (
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
            )}
            {visibleListings.length > 0 ? (
              <div className="listing-grid">
                {visibleListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    locale={locale}
                    copy={copy}
                    favourite={favourites.includes(listing.id)}
                    href={getListingPath(listing.id)}
                    onFavourite={() => toggleFavourite(listing.id)}
                    onOpen={() => navigateTo(getListingPath(listing.id))}
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
        )}

        {!legalRoute && !listingPageId && (!createListingPage || !user) && !catalogPage && (
          <>
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
              <div className="cta-map cta-map--finland" aria-label={copy.marketShipping}>
                <span className="map-country map-fi">✓</span>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer section-shell">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigateTo("/");
          }}
        >
          <span className="brand-mark">
            <span />
          </span>
          <span>
            <strong>PC MARKET</strong>
            <small>{copy.footerNote}</small>
          </span>
        </a>
        <div>
          {(["terms", "privacy", "accessibility"] as const).map((slug) => {
            const path = getLegalPath(slug);
            return (
              <a
                href={path}
                key={slug}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigateTo(path);
                }}
              >
                {copy[slug]}
              </a>
            );
          })}
        </div>
        <span>© 2026 PC Market Demo</span>
      </footer>

      {authOpen && (
        <AuthModal
          copy={copy}
          locale={locale}
          market={market}
          onClose={() => {
            setAuthOpen(false);
            if (pendingSell && createListingPage) navigateTo("/");
            setPendingSell(false);
            setPendingCheckout(null);
          }}
          onComplete={completeAuth}
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
          onManageLegal={() => {
            setAccountOpen(false);
            navigateTo(getLegalPath("terms"));
          }}
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
