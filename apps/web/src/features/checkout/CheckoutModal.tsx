import type { Messages } from "../../i18n/messages/fi";
import { formatMoney } from "../../lib/money";
import type { DemoOrder, Listing, Locale } from "../../types";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/ModalShell";

const shippingByCurrency = { EUR: 690, SEK: 7900, DKK: 5900, NOK: 8900 } as const;

interface CheckoutModalProps {
  listing: Listing;
  copy: Messages;
  locale: Locale;
  onClose: () => void;
  onComplete: (order: DemoOrder) => void;
}

export function CheckoutModal({ listing, copy, locale, onClose, onComplete }: CheckoutModalProps) {
  const fee = Math.round(listing.priceMinor * 0.015);
  const shipping = shippingByCurrency[listing.currency];
  const total = listing.priceMinor + fee + shipping;

  return (
    <ModalShell title={copy.checkoutTitle} onClose={onClose}>
      <div className="checkout-wrap">
        <div className="modal-kicker">{copy.demoBadge}</div>
        <h2>{copy.checkoutTitle}</h2>
        <p className="modal-lead">{copy.protectionBody}</p>
        <div className="checkout-item">
          <div className={`checkout-thumb visual--${listing.visual}`}>{listing.category.toUpperCase()}</div>
          <div>
            <strong>{listing.title}</strong>
            <span>
              {listing.seller.name} · {listing.city}
            </span>
          </div>
        </div>
        <dl className="checkout-totals">
          <div>
            <dt>{copy.itemPrice}</dt>
            <dd>{formatMoney(listing.priceMinor, listing.currency, locale)}</dd>
          </div>
          <div>
            <dt>{copy.protectionFee} (1.5%)</dt>
            <dd>{formatMoney(fee, listing.currency, locale)}</dd>
          </div>
          <div>
            <dt>{copy.shipping}</dt>
            <dd>{formatMoney(shipping, listing.currency, locale)}</dd>
          </div>
          <div className="checkout-total">
            <dt>{copy.total}</dt>
            <dd>{formatMoney(total, listing.currency, locale)}</dd>
          </div>
        </dl>
        <div className="safe-note">
          <Icon name="shield" />
          <span>
            <strong>{copy.protectionTitle}</strong>
            <small>{copy.demoNotice}</small>
          </span>
        </div>
        <button
          className="button button--primary button--full"
          type="button"
          onClick={() =>
            onComplete({
              id: `ORD-${Date.now().toString().slice(-6)}`,
              listingId: listing.id,
              title: listing.title,
              totalMinor: total,
              currency: listing.currency,
              status: "paid",
              createdAt: new Date().toISOString(),
            })
          }
        >
          {copy.confirmPurchase}
          <Icon name="arrow" />
        </button>
      </div>
    </ModalShell>
  );
}
