import { useEffect, useRef, type MouseEvent } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { getAccountPath } from "../../config/account-routes";
import { ADMIN_PATH } from "../../config/admin-routes";
import type { Messages } from "../../i18n/messages/fi";
import type { DemoUser, Locale } from "../../types";
import { getAccountCopy } from "./account-copy";

/** Navigaatiovalikko ei myönnä oikeuksia: kohdesivut ja palvelin varmistavat ne edelleen. */
export function AccountMenu({
  copy,
  locale,
  user,
  open,
  onOpenChange,
  currentPath,
  onNavigate,
  onLogout,
  favouriteCount,
}: {
  copy: Messages;
  locale: Locale;
  user: DemoUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  favouriteCount: number;
}) {
  const text = getAccountCopy(locale);
  const rootRef = useRef<HTMLDivElement>(null),
    triggerRef = useRef<HTMLButtonElement>(null),
    focusLast = useRef(false);
  useEffect(() => {
    onOpenChange(false);
  }, [currentPath, user.id]);
  useEffect(() => {
    if (!open) return;
    const items = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items?.length) items[focusLast.current ? items.length - 1 : 0].focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = (restoreFocus = false) => {
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const follow = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
    onNavigate(path);
  };
  const links: { label: string; path: string; icon: IconName }[] = [
    { label: text.profile, path: getAccountPath("profile"), icon: "user" },
    { label: text.listings, path: getAccountPath("listings"), icon: "package" },
  ];
  return (
    <div className="account-menu" ref={rootRef}>
      <button
        className="button button--dark account-button"
        type="button"
        ref={triggerRef}
        aria-label={copy.account}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu-items"
        onClick={() => {
          focusLast.current = false;
          onOpenChange(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            focusLast.current = event.key === "ArrowUp";
            onOpenChange(true);
          }
        }}
      >
        <span className="mini-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.slice(0, 2).toUpperCase()}
        </span>
        <span>{copy.account}</span>
      </button>
      {open && (
        <div
          id="account-menu-items"
          className="account-menu__panel"
          role="menu"
          aria-label={copy.account}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
              return;
            }
            if (event.key === "Tab") {
              close(true);
              return;
            }
            const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next =
              event.key === "ArrowDown"
                ? (index + 1) % items.length
                : event.key === "ArrowUp"
                  ? (index - 1 + items.length) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          <div className="account-menu__identity" role="presentation">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          {links.map((item) => (
            <a
              role="menuitem"
              tabIndex={-1}
              key={item.path}
              href={item.path}
              onClick={(event) => follow(event, item.path)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
          <a
            role="menuitem"
            tabIndex={-1}
            href={getAccountPath("favourites")}
            onClick={(event) => follow(event, getAccountPath("favourites"))}
          >
            <Icon name="heart" />
            <span>{text.favourites}</span>
            {favouriteCount > 0 && <small>{favouriteCount}</small>}
          </a>
          <a
            role="menuitem"
            tabIndex={-1}
            href={getAccountPath("orders")}
            onClick={(event) => follow(event, getAccountPath("orders"))}
          >
            <Icon name="truck" />
            <span>{text.orders}</span>
          </a>
          <a
            role="menuitem"
            tabIndex={-1}
            href={getAccountPath("settings")}
            onClick={(event) => follow(event, getAccountPath("settings"))}
          >
            <Icon name="edit" />
            <span>{text.settings}</span>
          </a>
          {user.role === "admin" && (
            <>
              <div role="separator" />
              <a role="menuitem" tabIndex={-1} href={ADMIN_PATH} onClick={(event) => follow(event, ADMIN_PATH)}>
                <Icon name="shield" />
                <span>{text.admin}</span>
              </a>
              <a role="menuitem" tabIndex={-1} href="/kayttoehdot" onClick={(event) => follow(event, "/kayttoehdot")}>
                <Icon name="edit" />
                <span>{text.content}</span>
              </a>
            </>
          )}
          <div role="separator" />
          <button
            className="account-menu__logout"
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={() => {
              close();
              onLogout();
            }}
          >
            <Icon name="arrow" />
            <span>{copy.logout}</span>
          </button>
        </div>
      )}
    </div>
  );
}
