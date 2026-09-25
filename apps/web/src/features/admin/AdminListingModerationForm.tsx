import { useEffect, useRef, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import {
  ListingModerationConflictError,
  ListingModerationOrderError,
  moderateAdminListing,
  type AdminListing,
} from "../../lib/admin-listings-service";
import type { Locale } from "../../types";
import { getAdminListingsCopy } from "./admin-listings-copy";

export function AdminListingModerationForm({
  listing,
  locale,
  onSaved,
  onDenied,
}: {
  listing: AdminListing;
  locale: Locale;
  onSaved: () => void;
  onDenied: () => void;
}) {
  const copy = getAdminListingsCopy(locale);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"conflict" | "order" | "error" | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  if (!listing.moderationAvailable || (listing.status !== "active" && !listing.moderationHidden)) return null;
  const action = listing.moderationHidden ? "restore" : "hide";
  return (
    <form
      className="admin-report-decision"
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError(null);
        try {
          await moderateAdminListing(listing, action, reason);
          if (alive.current) onSaved();
        } catch (failure) {
          if (alive.current) {
            if (failure instanceof AdminAccessError) onDenied();
            else if (failure instanceof ListingModerationConflictError) setError("conflict");
            else if (failure instanceof ListingModerationOrderError) setError("order");
            else setError("error");
          }
        } finally {
          inFlight.current = false;
          if (alive.current) setPending(false);
        }
      }}
    >
      <label htmlFor={`moderation-${listing.id}`}>{copy.reason}</label>
      <textarea
        id={`moderation-${listing.id}`}
        required
        minLength={10}
        maxLength={2000}
        value={reason}
        disabled={pending}
        onChange={(event) => setReason(event.target.value)}
      />
      <button
        type="submit"
        className="button button--outline"
        disabled={pending || reason.trim().length < 10 || error === "conflict"}
      >
        {pending ? copy.saving : action === "hide" ? copy.hide : copy.restore}
      </button>
      {error && <p role="alert">{copy[error]}</p>}
    </form>
  );
}
