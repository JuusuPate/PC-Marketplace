import { useEffect, useRef, useState } from "react";
import { AdminAccessError } from "../../lib/admin-service";
import { ReportConflictError, reviewAdminReport, type AdminReport } from "../../lib/admin-reports-service";
import type { Locale } from "../../types";
import { getAdminReportsCopy } from "./admin-reports-copy";

export function AdminReportDecisionForm({
  report,
  locale,
  onSaved,
  onDenied,
}: {
  report: AdminReport;
  locale: Locale;
  onSaved: () => void;
  onDenied: () => void;
}) {
  const copy = getAdminReportsCopy(locale);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"conflict" | "error" | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
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
          await reviewAdminReport(report, report.resolvedAt ? "reopen" : "resolve", note);
          if (alive.current) onSaved();
        } catch (failure) {
          if (alive.current) {
            if (failure instanceof AdminAccessError) onDenied();
            else setError(failure instanceof ReportConflictError ? "conflict" : "error");
          }
        } finally {
          inFlight.current = false;
          if (alive.current) setPending(false);
        }
      }}
    >
      <label htmlFor={`decision-${report.id}`}>{copy.decisionNote}</label>
      <textarea
        id={`decision-${report.id}`}
        required
        minLength={10}
        maxLength={2000}
        value={note}
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
      />
      <p>{copy.decisionHelp}</p>
      <button
        type="submit"
        className="button button--outline"
        disabled={pending || note.trim().length < 10 || error === "conflict"}
      >
        {pending ? copy.saving : report.resolvedAt ? copy.reopen : copy.resolve}
      </button>
      {error && <p role="alert">{error === "conflict" ? copy.conflict : copy.saveError}</p>}
    </form>
  );
}
