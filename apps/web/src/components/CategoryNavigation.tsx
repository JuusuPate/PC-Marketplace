import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { CATALOG_PAGES, type CatalogPage, type CatalogPageId, type CatalogSubmenuItem } from "../config/catalog";
import type { Messages } from "../i18n/messages/fi";

interface CategoryNavigationProps {
  copy: Messages;
  activePageId: CatalogPageId | null;
  activeSubmenuHref?: string | null;
  pages?: readonly CatalogPage[];
  onNavigate: (path: string) => void;
  onFilterNavigate?: (page: CatalogPage, item: CatalogSubmenuItem) => void;
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function CategoryNavigation({
  copy,
  activePageId,
  activeSubmenuHref,
  pages = CATALOG_PAGES,
  onNavigate,
  onFilterNavigate,
}: CategoryNavigationProps) {
  const [openMenuId, setOpenMenuId] = useState<CatalogPageId | null>(null);
  const [menuViewportTop, setMenuViewportTop] = useState<number | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const toggleRefs = useRef<Partial<Record<CatalogPageId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!openMenuId) return;

    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;
    const updateMenuPosition = () => {
      const bottom = navigationRef.current?.getBoundingClientRect().bottom;
      if (bottom !== undefined) setMenuViewportTop(Math.ceil(bottom));
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition);
    };
  }, [openMenuId]);

  const closeMenu = () => setOpenMenuId(null);
  const openMenu = (pageId: CatalogPageId) => {
    const bottom = navigationRef.current?.getBoundingClientRect().bottom;
    if (bottom !== undefined) setMenuViewportTop(Math.ceil(bottom));
    setOpenMenuId(pageId);
  };

  const handleEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || !openMenuId) return;
    const menuToClose = openMenuId;
    event.preventDefault();
    closeMenu();
    window.requestAnimationFrame(() => toggleRefs.current[menuToClose]?.focus());
  };

  return (
    <div className="category-navigation-wrap">
      <nav
        ref={navigationRef}
        className="category-navigation section-shell"
        aria-label={copy.categoryNavigation}
        onKeyDown={handleEscape}
      >
        <ul className="category-navigation-links">
          {pages.map((page) => {
            const hasSubmenu = Boolean(page.submenu?.length);
            const isOpen = openMenuId === page.id;
            const isActive = activePageId === page.id;
            const submenuId = `category-submenu-${page.id}`;
            const pageLabel = copy[page.labelKey];

            const categoryLink = (
              <a
                href={page.path}
                className="category-navigation-link"
                aria-current={isActive && !activeSubmenuHref ? "page" : undefined}
                onClick={(event) => {
                  if (!shouldHandleNavigation(event)) return;
                  event.preventDefault();
                  closeMenu();
                  onNavigate(page.path);
                }}
              >
                <span className="category-navigation-glyph" aria-hidden="true">
                  {page.glyph}
                </span>
                <span>{pageLabel}</span>
              </a>
            );

            return (
              <li
                key={page.id}
                className={`category-navigation-item${hasSubmenu ? " has-submenu" : ""}${isActive ? " is-active" : ""}${isOpen ? " is-menu-open" : ""}`}
                onMouseEnter={() => {
                  if (hasSubmenu) openMenu(page.id);
                }}
                onMouseLeave={() => {
                  if (isOpen) closeMenu();
                }}
                onFocusCapture={(event) => {
                  // Focusing the category link exposes its submenu. The disclosure
                  // button opens only when activated, which keeps touch/click toggling stable.
                  if (hasSubmenu && !toggleRefs.current[page.id]?.contains(event.target as Node)) {
                    openMenu(page.id);
                  }
                }}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
                }}
              >
                {hasSubmenu ? (
                  <div className="category-navigation-trigger">
                    {categoryLink}
                    <button
                      ref={(element) => {
                        toggleRefs.current[page.id] = element;
                      }}
                      type="button"
                      className="category-navigation-toggle"
                      aria-label={`${pageLabel} — ${copy.categoryNavigation}`}
                      aria-expanded={isOpen}
                      aria-controls={submenuId}
                      onClick={(event) => {
                        // A mouse has already opened the menu through hover before
                        // click fires. Keep it open; touch and keyboard use a true toggle.
                        if (event.detail > 0 && window.matchMedia("(hover: hover)").matches) {
                          openMenu(page.id);
                          return;
                        }
                        if (isOpen) closeMenu();
                        else openMenu(page.id);
                      }}
                    />
                    <span className="category-navigation-indicator" aria-hidden="true" />
                  </div>
                ) : (
                  categoryLink
                )}

                {page.submenu && (
                  <ul
                    id={submenuId}
                    className="category-navigation-submenu"
                    aria-label={pageLabel}
                    style={
                      menuViewportTop === null
                        ? undefined
                        : ({ "--category-submenu-top": `${menuViewportTop}px` } as CSSProperties)
                    }
                  >
                    {page.submenu.map((item) => {
                      const isSubmenuActive = activeSubmenuHref === item.href;
                      return (
                        <li key={item.id} className={isSubmenuActive ? "is-active" : undefined}>
                          <a
                            href={item.href}
                            aria-current={isSubmenuActive ? "page" : undefined}
                            onClick={(event) => {
                              if (!shouldHandleNavigation(event) || !onFilterNavigate) return;
                              event.preventDefault();
                              closeMenu();
                              onFilterNavigate(page, item);
                            }}
                          >
                            {item.label}
                            <span aria-hidden="true">↗</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
