import { useEffect, useState } from "react";
import { formatListingAge, listingTimestamp } from "../lib/listing-time";
import type { Listing, Locale } from "../types";

/**
 * Päivittää ilmoituksen suhteellisen iän puolen minuutin välein ja välilehteen palattaessa.
 * Varsinainen julkaisuhetki säilyy time-elementissä ja lajittelu tehdään erikseen aikaleiman perusteella.
 */
export function ListingAge({ listing, locale }: { listing: Listing; locale: Locale }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const timestamp = listingTimestamp(listing);
  const fullDate =
    timestamp === null
      ? undefined
      : new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Helsinki" }).format(
          timestamp,
        );
  return (
    <time
      className="card-time"
      dateTime={timestamp === null ? undefined : new Date(timestamp).toISOString()}
      title={fullDate}
    >
      {formatListingAge(listing, locale, now)}
    </time>
  );
}
