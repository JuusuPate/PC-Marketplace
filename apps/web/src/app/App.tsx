import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CategoryNavigation } from "../components/CategoryNavigation";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { ListingCard } from "../components/ListingCard";
import {
  CATALOG_PAGES,
  getCatalogPage,
  type CatalogNavigationFilter,
  type CatalogPage,
  type CatalogSubmenuItem,
} from "../config/catalog";
import { getLegalPath, getLegalRoute } from "../config/legal-routes";
import { getListingId, getListingPath } from "../config/listing-routes";
import {
  ADMIN_PATH,
  isAdminOverviewPath,
  isAdminPath,
  isAdminUsersPath,
  isAdminListingsPath,
  isAdminTransactionsPath,
} from "../config/admin-routes";
import {
  HOME_HERO_BACKGROUND_IMAGE,
  HOME_HERO_BACKGROUND_POSITION,
  HOME_HERO_BACKGROUND_SIZE,
} from "../config/home-hero";
import { LAUNCH_MARKET, MARKETS } from "../config/markets";
import { DEMO_LISTINGS } from "../data/demo-listings";
import { AccountModal } from "../features/account/AccountModal";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { getAdminCopy } from "../features/admin/admin-copy";
import { AuthModal } from "../features/auth/AuthModal";
import { CategoryHero } from "../features/catalog/CategoryHero";
import { CheckoutModal } from "../features/checkout/CheckoutModal";
import { FavouritesModal } from "../features/favourites/FavouritesModal";
import { FeaturedShowcase } from "../features/home/FeaturedShowcase";
import { ListingDetailPage } from "../features/listings/ListingDetailPage";
import { LegalPage } from "../features/legal/LegalPage";
import { CreateListingPage } from "../features/sell/CreateListingPage";
import { getMessages } from "../i18n";
import { authService } from "../lib/auth-service";
import { applyCatalogNavigationFilter } from "../lib/catalog-filtering";
import { catalogService, type CatalogNavigationCategory, type CatalogRuntimeFilter } from "../lib/catalog-service";
import { demoStorage } from "../lib/demo-storage";
import type { PreparedListingImage } from "../lib/listing-images";
import { listingService } from "../lib/listing-service";
import { getRuntimeCopy } from "../lib/runtime-copy";
import { backendMode } from "../lib/supabase";
import type { Category, DemoOrder, DemoUser, Listing, Locale, PrivatePickupAddress } from "../types";

type SortOption = "newest" | "oldest" | "priceLow" | "priceHigh" | "bestDeals";

const CREATE_LISTING_PATH = "/myy/uusi";
const MAX_NAVIGATION_PRICE_MINOR = 100_000_000;
const HOME_HERO_BACKGROUND_STYLE = HOME_HERO_BACKGROUND_IMAGE
  ? ({
      "--home-hero-background-image": `url(${JSON.stringify(HOME_HERO_BACKGROUND_IMAGE)})`,
      "--home-hero-background-position": HOME_HERO_BACKGROUND_POSITION,
      "--home-hero-background-size": HOME_HERO_BACKGROUND_SIZE,
    } as CSSProperties)
  : undefined;

function toNavigationFilter(filter: CatalogRuntimeFilter): CatalogNavigationFilter | null {
  if (filter.kind === "price_max_minor") return { maxPriceMinor: filter.maxPriceMinor };
  if (filter.kind === "featured") return { featuredOnly: true };
  if (
    filter.kind === "spec_option" &&
    filter.specKey === "gpu_chip_vendor" &&
    (filter.optionKey === "nvidia" || filter.optionKey === "amd")
  ) {
    return { gpuChipVendor: filter.optionKey };
  }
  return null;
}

function mergeCatalogNavigation(categories: readonly CatalogNavigationCategory[]): CatalogPage[] {
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));

  return CATALOG_PAGES.map((page) => {
    const runtimeCategory = categoriesBySlug.get(page.id);
    if (!runtimeCategory) return page;

    const submenu = runtimeCategory.items.flatMap((item): CatalogSubmenuItem[] => {
      const filters = toNavigationFilter(item.filter);
      return filters ? [{ id: item.id, label: item.label, href: item.href, filters }] : [];
    });

    return { ...page, submenu: submenu.length > 0 ? submenu : undefined };
  });
}

function canonicalCatalogHref(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.sort();
  const normalizedSearch = params.toString();
  return `${pathname}${normalizedSearch ? `?${normalizedSearch}` : ""}`;
}

function getCatalogNavigationFilter(pathname: string, search: string): CatalogNavigationFilter | null {
  const page = getCatalogPage(pathname);
  const entries = [...new URLSearchParams(search).entries()];
  if (!page || entries.length !== 1) return null;

  const [[key, value]] = entries;
  if (page.id === "pc" && key === "maxPrice") {
    if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
    const euros = Number(value);
    const maxPriceMinor = Math.round(euros * 100);
    if (Number.isFinite(euros) && euros > 0 && maxPriceMinor <= MAX_NAVIGATION_PRICE_MINOR) {
      return { maxPriceMinor };
    }
  }
  if (page.id === "pc" && key === "featured" && value === "true") return { featuredOnly: true };
  if (page.id === "gpu" && key === "chipVendor" && (value === "nvidia" || value === "amd")) {
    return { gpuChipVendor: value };
  }
  return null;
}

function getCatalogRouteFilter(pathname: string, search: string) {
  const filter = getCatalogNavigationFilter(pathname, search);
  return {
    filter,
    activeHref: filter ? canonicalCatalogHref(pathname, search) : null,
  };
}

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
  const [catalogNavigationPages, setCatalogNavigationPages] = useState<readonly CatalogPage[]>(CATALOG_PAGES);
  const [catalogNavigationFilter, setCatalogNavigationFilter] = useState<CatalogNavigationFilter | null>(
    () => getCatalogRouteFilter(window.location.pathname, window.location.search).filter,
  );
  const [activeCatalogSubmenuHref, setActiveCatalogSubmenuHref] = useState<string | null>(
    () => getCatalogRouteFilter(window.location.pathname, window.location.search).activeHref,
  );
  const [legalRoute, setLegalRoute] = useState(() => getLegalRoute(window.location.pathname));
  const [adminPath, setAdminPath] = useState<string | null>(() =>
    isAdminPath(window.location.pathname) ? window.location.pathname : null,
  );
  const [createListingPage, setCreateListingPage] = useState(() => isCreateListingPath(window.location.pathname));
  const [listingPageId, setListingPageId] = useState(() => getListingId(window.location.pathname));
  const [routeListing, setRouteListing] = useState<Listing | null>(null);
  const [listingRouteLoading, setListingRouteLoading] = useState(() => Boolean(getListingId(window.location.pathname)));
  const [user, setUser] = useState<DemoUser | null>(() => (backendMode === "demo" ? demoStorage.getSession() : null));
  const [authLoading, setAuthLoading] = useState(backendMode === "supabase");
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
  const [favouritesOpen, setFavouritesOpen] = useState(false);
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

  const navigationFilteredListings = useMemo(
    () => applyCatalogNavigationFilter(catalogListings, catalogNavigationFilter),
    [catalogListings, catalogNavigationFilter],
  );

  const favouriteListings = useMemo(
    () => listings.filter((listing) => favourites.includes(listing.id)),
    [favourites, listings],
  );

  const categoryFilters = useMemo(() => {
    if (!catalogPage || catalogPage.id === "all") return categories;
    if (catalogPage.id === "components") {
      return categories.filter((item) => item.key === "all" || (item.key !== "pc" && item.key !== "other"));
    }
    return [];
  }, [catalogPage]);

  useEffect(() => authService.subscribe(setUser, setAuthLoading), []);

  useEffect(() => {
    let isCurrent = true;
    catalogService.getNavigation(locale).then((result) => {
      if (isCurrent) setCatalogNavigationPages(mergeCatalogNavigation(result.categories));
    });
    return () => {
      isCurrent = false;
    };
  }, [locale]);

  useEffect(() => {
    const syncRoute = () => {
      const nextListingId = getListingId(window.location.pathname);
      const nextCatalogFilter = getCatalogRouteFilter(window.location.pathname, window.location.search);
      setCatalogPage(getCatalogPage(window.location.pathname));
      setCatalogNavigationFilter(nextCatalogFilter.filter);
      setActiveCatalogSubmenuHref(nextCatalogFilter.activeHref);
      setLegalRoute(getLegalRoute(window.location.pathname));
      setAdminPath(isAdminPath(window.location.pathname) ? window.location.pathname : null);
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
    document.title = adminPath
      ? `${getAdminCopy(locale).title} | PC Market`
      : legalRoute
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
  }, [activeListing, adminPath, catalogPage, copy, createListingPage, legalRoute, listingPageId, locale]);

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
    const matches = navigationFilteredListings.filter((listing) => {
      const haystack =
        `${listing.title} ${listing.subtitle} ${listing.brand} ${Object.values(listing.specs).join(" ")}`.toLocaleLowerCase();
      return (
        listing.shipsTo.includes(market) &&
        (category === "all" || listing.category === category) &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      );
    });
    if (sort === "newest" || sort === "oldest") {
      const timestamps = new Map(
        matches.map((listing, index) => {
          const parsedTimestamp = listing.createdAt ? Date.parse(listing.createdAt) : Number.NaN;
          const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Number.MAX_SAFE_INTEGER - index;
          return [listing.id, timestamp] as const;
        }),
      );
      const direction = sort === "newest" ? -1 : 1;
      return matches.sort((a, b) => direction * ((timestamps.get(a.id) ?? 0) - (timestamps.get(b.id) ?? 0)));
    }
    if (sort === "priceLow") return matches.sort((a, b) => a.priceMinor - b.priceMinor);
    if (sort === "priceHigh") return matches.sort((a, b) => b.priceMinor - a.priceMinor);
    if (sort === "bestDeals")
      return matches.sort((a, b) => Number(b.priceSignal === "great") - Number(a.priceSignal === "great"));
    return matches;
  }, [category, market, navigationFilteredListings, query, sort]);

  const navigateTo = (path: string, hash = "") => {
    const destination = new URL(path, window.location.origin);
    if (hash) destination.hash = hash;
    const { pathname, search } = destination;
    const target = `${pathname}${search}${destination.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== target) {
      window.history.pushState({}, "", target);
    }

    const nextPage = getCatalogPage(pathname);
    const nextCatalogFilter = getCatalogRouteFilter(pathname, search);
    const nextLegalRoute = getLegalRoute(pathname);
    const nextListingId = getListingId(pathname);
    setCatalogPage(nextPage);
    setCatalogNavigationFilter(nextCatalogFilter.filter);
    setActiveCatalogSubmenuHref(nextCatalogFilter.activeHref);
    setLegalRoute(nextLegalRoute);
    setAdminPath(isAdminPath(pathname) ? pathname : null);
    setCreateListingPage(isCreateListingPath(pathname));
    setListingPageId(nextListingId);
    setListingRouteLoading(Boolean(nextListingId && !listings.some((listing) => listing.id === nextListingId)));
    setCategory("all");
    setQuery("");

    window.setTimeout(() => {
      if (destination.hash) {
        document.querySelector(destination.hash)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (nextPage) document.querySelector<HTMLElement>("#category-page-title")?.focus({ preventScroll: true });
      if (nextListingId) document.querySelector<HTMLElement>("#listing-page-title")?.focus({ preventScroll: true });
      if (nextLegalRoute) document.querySelector<HTMLElement>("#legal-page-title")?.focus({ preventScroll: true });
      if (isAdminPath(pathname))
        document.querySelector<HTMLElement>("#admin-page-title")?.focus({ preventScroll: true });
    }, 0);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const completeAuth = (nextUser: DemoUser) => {
    setUser(nextUser);
    setAuthLoading(false);
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

  const searchCatalog = (searchQuery: string) => {
    navigateTo("/kategoriat/kaikki", "#marketplace");
    setQuery(searchQuery.trim());
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
      if (createListingPage || adminPath) navigateTo("/");
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
        searchQuery={query}
        onSearchQuery={setQuery}
        onSearch={searchCatalog}
        favouriteCount={favouriteListings.length}
        onFavourites={() => setFavouritesOpen(true)}
        onAccount={() => setAccountOpen(true)}
      />

      <CategoryNavigation
        copy={copy}
        pages={catalogNavigationPages}
        activePageId={catalogPage?.id ?? null}
        activeSubmenuHref={activeCatalogSubmenuHref}
        onNavigate={(path) => navigateTo(path)}
        onFilterNavigate={(_page, item) => navigateTo(item.href, "#marketplace")}
      />

      <main>
        {adminPath && (
          <AdminDashboardPage
            key={`${user?.id ?? "anonymous"}:${adminPath}`}
            locale={locale}
            user={user}
            authLoading={authLoading}
            overview={isAdminOverviewPath(adminPath)}
            users={isAdminUsersPath(adminPath)}
            listings={isAdminListingsPath(adminPath)}
            transactions={isAdminTransactionsPath(adminPath)}
            onLogin={() => setAuthOpen(true)}
            onNavigate={navigateTo}
          />
        )}
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

        {!adminPath &&
          !legalRoute &&
          !listingPageId &&
          (!createListingPage || !user) &&
          (catalogPage ? (
            <CategoryHero
              page={catalogPage}
              copy={copy}
              listingCount={navigationFilteredListings.length}
              onHome={() => navigateTo("/")}
              onSell={requireSellAuth}
            />
          ) : (
            <>
              <section
                className={`home-hero${HOME_HERO_BACKGROUND_STYLE ? " home-hero--with-background" : ""}`}
                style={HOME_HERO_BACKGROUND_STYLE}
              >
                <div className="hero section-shell">
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
                  <div className="hero-art">
                    <FeaturedShowcase
                      listings={listings}
                      locale={locale}
                      copy={copy}
                      onOpen={(listing) => navigateTo(getListingPath(listing.id))}
                    />
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

        {!adminPath && !legalRoute && !listingPageId && (!createListingPage || !user) && (
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
                  <option value="oldest">{copy.oldest}</option>
                  <option value="priceLow">{copy.priceLow}</option>
                  <option value="priceHigh">{copy.priceHigh}</option>
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
                    if (catalogNavigationFilter && catalogPage) {
                      navigateTo(catalogPage.path, "#marketplace");
                      return;
                    }
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

        {!adminPath && !legalRoute && !listingPageId && (!createListingPage || !user) && !catalogPage && (
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
          onAdmin={() => {
            setAccountOpen(false);
            navigateTo(ADMIN_PATH);
          }}
          onManageLegal={() => {
            setAccountOpen(false);
            navigateTo(getLegalPath("terms"));
          }}
        />
      )}
      {favouritesOpen && (
        <FavouritesModal
          copy={copy}
          locale={locale}
          listings={favouriteListings}
          onClose={() => setFavouritesOpen(false)}
          onOpenListing={(listing) => {
            setFavouritesOpen(false);
            navigateTo(getListingPath(listing.id));
          }}
          onRemoveFavourite={toggleFavourite}
          onBrowseProducts={() => {
            setFavouritesOpen(false);
            navigateTo("/kategoriat/kaikki");
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
