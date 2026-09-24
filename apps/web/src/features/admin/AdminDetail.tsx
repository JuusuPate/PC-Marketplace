import { useEffect, useState } from "react";
import {
  getAdminUserDetail,
  getAdminOrderDetail,
  type AdminUserDetail,
  type AdminOrderDetail,
} from "../../lib/admin-detail-service";
import { AdminAccessError } from "../../lib/admin-service";
import { formatMoney } from "../../lib/money";
import type { Locale } from "../../types";
import { getAdminCopy } from "./admin-copy";
import { getAdminTransactionsCopy } from "./admin-transactions-copy";

const en = {
  open: "Open details",
  close: "Close details",
  email: "Email",
  listings: "Listings",
  sales: "Completed sales",
  purchases: "Completed purchases",
  disputes: "Open disputes",
  recent: "Most recent orders (up to 25)",
  total: "Orders in total",
  sale: "Sale",
  purchase: "Purchase",
  provider: "Recorded payment provider",
  reference: "Payment reference",
  inspection: "Inspection deadline",
  carrier: "Carrier",
  tracking: "Tracking code",
  shipped: "Shipped",
  delivered: "Delivered",
  missing: "Not recorded",
  noShipment: "No shipment recorded",
  paymentNote: "These are database records. They do not verify payment, refund or payout with a provider.",
  historyNote:
    "The full order list can be searched by this user's ID. Ratings, verification, sanctions and admin notes are not available here yet.",
};
const fi: typeof en = {
  open: "Avaa tiedot",
  close: "Sulje tiedot",
  email: "Sähköposti",
  listings: "Ilmoituksia",
  sales: "Valmiita myyntejä",
  purchases: "Valmiita ostoja",
  disputes: "Avoimia riitoja",
  recent: "Uusimmat tilaukset (enintään 25)",
  total: "Tilauksia yhteensä",
  sale: "Myynti",
  purchase: "Osto",
  provider: "Tallennettu maksupalvelu",
  reference: "Maksuviite",
  inspection: "Tarkastusajan päättyminen",
  carrier: "Kuljetusyhtiö",
  tracking: "Seurantatunnus",
  shipped: "Lähetetty",
  delivered: "Toimitettu",
  missing: "Ei tallennettu",
  noShipment: "Toimitusta ei ole tallennettu",
  paymentNote: "Tiedot ovat tietokantamerkintöjä. Ne eivät vahvista maksua, hyvitystä tai tilitystä maksupalvelusta.",
  historyNote:
    "Kaikkia tilauksia voi hakea tilauslistasta tämän käyttäjän tunnisteella. Arvostelut, vahvistukset, sanktiot ja ylläpidon muistiinpanot eivät vielä sisälly tähän näkymään.",
};
const sv: typeof en = {
  open: "Öppna detaljer",
  close: "Stäng detaljer",
  email: "E-post",
  listings: "Annonser",
  sales: "Slutförda försäljningar",
  purchases: "Slutförda köp",
  disputes: "Öppna tvister",
  recent: "Senaste beställningar (högst 25)",
  total: "Beställningar totalt",
  sale: "Försäljning",
  purchase: "Köp",
  provider: "Registrerad betaltjänst",
  reference: "Betalningsreferens",
  inspection: "Kontrollfrist",
  carrier: "Transportör",
  tracking: "Spårningskod",
  shipped: "Skickad",
  delivered: "Levererad",
  missing: "Inte registrerat",
  noShipment: "Ingen leverans registrerad",
  paymentNote:
    "Uppgifterna är databasposter. De bekräftar inte betalning, återbetalning eller utbetalning hos en betaltjänst.",
  historyNote:
    "Hela beställningslistan kan sökas med användarens ID. Omdömen, verifiering, sanktioner och administratörsanteckningar ingår ännu inte.",
};
type State =
  | { status: "idle" | "loading" | "error" | "denied" }
  | { status: "user"; data: AdminUserDetail }
  | { status: "order"; data: AdminOrderDetail };
export function AdminDetail({ id, kind, locale }: { id: string; kind: "user" | "order"; locale: Locale }) {
  const copy = locale === "fi" ? fi : locale === "sv" ? sv : en;
  const common = getAdminCopy(locale),
    transactions = getAdminTransactionsCopy(locale);
  const [open, setOpen] = useState(false),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>({ status: "idle" });
  useEffect(() => {
    if (!open) return;
    let current = true;
    setState({ status: "loading" });
    async function load() {
      try {
        const next: State =
          kind === "user"
            ? { status: "user", data: await getAdminUserDetail(id) }
            : { status: "order", data: await getAdminOrderDetail(id) };
        if (current) setState(next);
      } catch (error) {
        if (current) setState({ status: error instanceof AdminAccessError ? "denied" : "error" });
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [open, id, kind, retry]);
  const date = (value: string | null) => (value === null ? copy.missing : new Date(value).toLocaleString(locale));
  return (
    <div className="admin-detail">
      <button
        type="button"
        className="button button--outline"
        aria-expanded={open}
        onClick={() => {
          setState({ status: "loading" });
          setOpen(!open);
        }}
      >
        {open ? copy.close : copy.open}
      </button>
      {open && (
        <div>
          {state.status === "loading" && <p role="status">{common.loading}</p>}
          {(state.status === "error" || state.status === "denied") && (
            <p role="alert">{state.status === "denied" ? common.deniedBody : common.errorBody}</p>
          )}
          {state.status === "user" && (
            <>
              <dl className="admin-values">
                <div>
                  <dt>{copy.email}</dt>
                  <dd>{state.data.email ?? copy.missing}</dd>
                </div>
                {(["listings", "sales", "purchases", "disputes", "total"] as const).map((key) => (
                  <div key={key}>
                    <dt>{copy[key]}</dt>
                    <dd>{state.data[key].toLocaleString(locale)}</dd>
                  </div>
                ))}
              </dl>
              <h3>{copy.recent}</h3>
              <ul>
                {state.data.orders.map((order) => (
                  <li key={order.id}>
                    {copy[order.direction]} · {transactions[order.status]} ·{" "}
                    {formatMoney(order.value, "EUR", locale, 2)} · {date(order.createdAt)}
                    <br />
                    {order.id}
                  </li>
                ))}
              </ul>
              <p className="admin-note">{copy.historyNote}</p>
            </>
          )}
          {state.status === "order" && (
            <>
              <dl className="admin-values">
                <div>
                  <dt>{transactions.status}</dt>
                  <dd>{transactions[state.data.status]}</dd>
                </div>
                <div>
                  <dt>{copy.provider}</dt>
                  <dd>{state.data.provider || copy.missing}</dd>
                </div>
                <div>
                  <dt>{copy.reference}</dt>
                  <dd>{state.data.reference ?? copy.missing}</dd>
                </div>
                <div>
                  <dt>{copy.inspection}</dt>
                  <dd>{date(state.data.inspection)}</dd>
                </div>
                {state.data.shipment && (
                  <>
                    <div>
                      <dt>{copy.carrier}</dt>
                      <dd>{state.data.shipment.carrier}</dd>
                    </div>
                    <div>
                      <dt>{copy.tracking}</dt>
                      <dd>{state.data.shipment.tracking}</dd>
                    </div>
                    <div>
                      <dt>{copy.shipped}</dt>
                      <dd>{date(state.data.shipment.shipped)}</dd>
                    </div>
                    <div>
                      <dt>{copy.delivered}</dt>
                      <dd>{date(state.data.shipment.delivered)}</dd>
                    </div>
                  </>
                )}
              </dl>
              {!state.data.shipment && <p>{copy.noShipment}</p>}
              <p className="admin-note">{copy.paymentNote}</p>
            </>
          )}
          <button
            type="button"
            className="button button--outline"
            disabled={state.status === "loading"}
            onClick={() => {
              setState({ status: "loading" });
              setRetry((value) => value + 1);
            }}
          >
            {common.refresh}
          </button>
        </div>
      )}
    </div>
  );
}
