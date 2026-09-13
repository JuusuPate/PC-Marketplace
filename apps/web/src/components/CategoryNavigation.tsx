import type { MouseEvent } from "react";
import { CATALOG_PAGES, type CatalogPageId } from "../config/catalog";
import type { Messages } from "../i18n/messages/fi";

interface CategoryNavigationProps {
  copy: Messages;
  activePageId: CatalogPageId | null;
  onNavigate: (path: string) => void;
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function CategoryNavigation({ copy, activePageId, onNavigate }: CategoryNavigationProps) {
  return (
    <div className="category-navigation-wrap">
      <nav className="category-navigation section-shell" aria-label={copy.categoryNavigation}>
        <span className="category-navigation-label">{copy.categoryNavigation}</span>
        <div className="category-navigation-links">
          {CATALOG_PAGES.map((page) => (
            <a
              key={page.id}
              href={page.path}
              className={activePageId === page.id ? "active" : ""}
              aria-current={activePageId === page.id ? "page" : undefined}
              onClick={(event) => {
                if (!shouldHandleNavigation(event)) return;
                event.preventDefault();
                onNavigate(page.path);
              }}
            >
              <span aria-hidden="true">{page.glyph}</span>
              {copy[page.labelKey]}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
