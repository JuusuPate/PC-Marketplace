import { MARKETS, PUBLIC_MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { DemoOrder, DemoUser, Listing, Locale } from "../../types";
import { getRuntimeCopy } from "../../lib/runtime-copy";
import { backendMode } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/ModalShell";
import { getAdminCopy } from "../admin/admin-copy";

interface AccountModalProps {
  copy: Messages;
  locale: Locale;
  user: DemoUser;
  orders: DemoOrder[];
  ownListings: Listing[];
  onClose: () => void;
  onLogout: () => void;
  onManageLegal: () => void;
  onAdmin: () => void;
}

export function AccountModal({
  copy,
  locale,
  user,
  orders,
  ownListings,
  onClose,
  onLogout,
  onManageLegal,
  onAdmin,
}: AccountModalProps) {
  const runtimeCopy = getRuntimeCopy(locale);

  return (
    <ModalShell title={copy.account} onClose={onClose} size="wide">
      <div className="account-wrap">
        <aside className="account-profile">
          <div className="account-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          {user.role === "admin" && <span className="admin-badge">ADMIN</span>}
          <span className="demo-pill">{backendMode === "supabase" ? runtimeCopy.connectedBadge : copy.demoBadge}</span>
          <button className="button button--outline button--full" type="button" onClick={onLogout}>
            {copy.logout}
          </button>
        </aside>
        <div className="account-content">
          <section>
            <div className="section-heading-mini">
              <h3>{copy.myOrders}</h3>
              <span>{orders.length}</span>
            </div>
            {orders.length === 0 ? (
              <p className="empty-copy">{copy.noOrders}</p>
            ) : (
              <div className="account-list">
                {orders.map((order) => (
                  <article key={order.id}>
                    <span className="order-icon">
                      <Icon name="package" />
                    </span>
                    <div>
                      <strong>{order.title}</strong>
                      <small>
                        {order.id} · {new Date(order.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                    <div className="order-value">
                      <strong>{formatMoney(order.totalMinor, order.currency, locale)}</strong>
                      <span className="status-chip status--live">
                        {copy[order.status === "shipping" ? "shippingStatus" : order.status]}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section>
            <div className="section-heading-mini">
              <h3>{copy.myListings}</h3>
              <span>{ownListings.length}</span>
            </div>
            {ownListings.length === 0 ? (
              <p className="empty-copy">{copy.noOwnListings}</p>
            ) : (
              <div className="account-list">
                {ownListings.map((listing) => (
                  <article key={listing.id}>
                    <span className={`order-icon visual--${listing.visual}`}>{listing.category.toUpperCase()}</span>
                    <div>
                      <strong>{listing.title}</strong>
                      <small>{listing.city}</small>
                    </div>
                    <div className="order-value">
                      <strong>{formatMoney(listing.priceMinor, listing.currency, locale)}</strong>
                      <span className="status-chip status--beta">DEMO</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          {user.role === "admin" && (
            <section>
              <div className="section-heading-mini">
                <h3>{copy.marketAdmin}</h3>
                <span>ADMIN</span>
              </div>
              <div className="market-status-grid">
                {PUBLIC_MARKETS.map((countryCode) => {
                  const market = MARKETS[countryCode];
                  return (
                    <article key={market.countryCode}>
                      <span aria-hidden="true">✓</span>
                      <div>
                        <strong>{market.name}</strong>
                        <small>
                          {market.currency} · {market.feePercent}% fee
                        </small>
                      </div>
                    </article>
                  );
                })}
              </div>
              <button className="button button--dark button--full" type="button" onClick={onAdmin}>
                {getAdminCopy(locale).title}
              </button>
              <button className="button button--outline button--full" type="button" onClick={onManageLegal}>
                {locale === "fi" ? "Muokkaa sisältösivuja" : "Manage content pages"}
              </button>
            </section>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
