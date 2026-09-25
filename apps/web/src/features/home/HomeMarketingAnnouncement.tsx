import { useEffect, useState } from "react";
import { getPublicMarketingAnnouncement } from "../../lib/marketing-service";
import type { Locale } from "../../types";

type PublicAnnouncement = Awaited<ReturnType<typeof getPublicMarketingAnnouncement>>;

export function HomeMarketingAnnouncement({ locale }: { locale: Locale }) {
  const [state, setState] = useState<{ locale: Locale; announcement: PublicAnnouncement } | null>(null);
  useEffect(() => {
    let current = true;
    getPublicMarketingAnnouncement(locale).then(
      (announcement) => {
        if (current) setState({ locale, announcement });
      },
      () => {
        // The home page remains usable if Marketing has not been deployed or is temporarily unavailable.
        if (current) setState({ locale, announcement: null });
      },
    );
    return () => {
      current = false;
    };
  }, [locale]);
  const announcement = state?.locale === locale ? state.announcement : null;
  if (!announcement) return null;
  return (
    <aside className="home-marketing-announcement section-shell" aria-labelledby="home-marketing-title">
      <div className="home-marketing-announcement__content">
        <h2 id="home-marketing-title">{announcement.title}</h2>
        <p>{announcement.body}</p>
      </div>
    </aside>
  );
}
