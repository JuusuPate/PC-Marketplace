import type { MouseEvent } from "react";
import type { CatalogPage } from "../../config/catalog";
import type { Messages } from "../../i18n/messages/fi";
import { Icon } from "../../components/Icon";

interface CategoryHeroProps {
  page: CatalogPage;
  copy: Messages;
  listingCount: number;
  onHome: () => void;
  onSell: () => void;
}

export function CategoryHero({ page, copy, listingCount, onHome, onSell }: CategoryHeroProps) {
  const title = copy[page.labelKey];

  const handleHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome();
  };

  return (
    <section className="category-route-hero" aria-labelledby="category-page-title">
      <div className="category-route-hero-inner section-shell">
        <div className="category-route-copy">
          <nav className="breadcrumbs" aria-label={copy.breadcrumbs}>
            <a href="/" onClick={handleHome}>
              {copy.home}
            </a>
            <span aria-hidden="true">/</span>
            <strong>{title}</strong>
          </nav>
          <span className="category-route-eyebrow">
            {copy.categoryPageEyebrow} <i /> 🇫🇮 FI
          </span>
          <h1 id="category-page-title" tabIndex={-1}>
            {title}
          </h1>
          <p>{copy.categoryPageBody}</p>
          <button className="button button--light" type="button" onClick={onSell}>
            <Icon name="plus" />
            {copy.sell}
          </button>
        </div>

        <div className="category-route-card" aria-hidden="true">
          <span className="category-route-card-status">FINLAND / LIVE</span>
          <strong className="category-route-glyph">{page.glyph}</strong>
          <div>
            <strong>{listingCount}</strong>
            <span>{copy.listings}</span>
          </div>
          <small>{copy.shippingArea}</small>
        </div>
      </div>
    </section>
  );
}
