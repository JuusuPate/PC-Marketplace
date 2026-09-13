import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import type { LegalRoute } from "../../config/legal-routes";
import { getDefaultLegalPage } from "../../data/legal-pages";
import type { Messages } from "../../i18n/messages/fi";
import { legalPageService } from "../../lib/legal-page-service";
import type { DemoUser, LegalPageContent, Locale } from "../../types";

interface LegalPageProps {
  route: LegalRoute;
  locale: Locale;
  copy: Messages;
  user: DemoUser | null;
  onHome: () => void;
}

interface LegalUiCopy {
  eyebrow: string;
  adminMode: string;
  edit: string;
  editorTitle: string;
  editorHelp: string;
  title: string;
  summary: string;
  body: string;
  formatHelp: string;
  save: string;
  saving: string;
  saved: string;
  loadError: string;
  saveError: string;
  updated: string;
}

const englishUi: LegalUiCopy = {
  eyebrow: "Information page",
  adminMode: "Admin mode",
  edit: "Edit page",
  editorTitle: "Edit page content",
  editorHelp: "Changes become visible immediately after saving.",
  title: "Page title",
  summary: "Introduction",
  body: "Page content",
  formatHelp: "Start a section heading with ##. Separate paragraphs with a blank line.",
  save: "Save changes",
  saving: "Saving…",
  saved: "Changes saved.",
  loadError: "The saved version could not be loaded. The draft content is shown instead.",
  saveError: "Changes could not be saved.",
  updated: "Updated",
};

const uiCopy: Record<Locale, LegalUiCopy> = {
  fi: {
    eyebrow: "Sisältösivu",
    adminMode: "Admin-tila",
    edit: "Muokkaa sivua",
    editorTitle: "Muokkaa sivun sisältöä",
    editorHelp: "Tallennetut muutokset näkyvät käyttäjille heti.",
    title: "Sivun otsikko",
    summary: "Johdanto",
    body: "Sivun sisältö",
    formatHelp: "Aloita väliotsikko merkeillä ##. Erota kappaleet tyhjällä rivillä.",
    save: "Tallenna muutokset",
    saving: "Tallennetaan…",
    saved: "Muutokset tallennettiin.",
    loadError: "Tallennettua versiota ei voitu ladata. Näytetään sivun luonnossisältö.",
    saveError: "Muutoksia ei voitu tallentaa.",
    updated: "Päivitetty",
  },
  sv: {
    eyebrow: "Informationssida",
    adminMode: "Adminläge",
    edit: "Redigera sidan",
    editorTitle: "Redigera sidans innehåll",
    editorHelp: "Sparade ändringar visas genast för användarna.",
    title: "Sidans rubrik",
    summary: "Inledning",
    body: "Sidans innehåll",
    formatHelp: "Börja en mellanrubrik med ##. Separera stycken med en tom rad.",
    save: "Spara ändringar",
    saving: "Sparar…",
    saved: "Ändringarna sparades.",
    loadError: "Den sparade versionen kunde inte laddas. Utkastet visas i stället.",
    saveError: "Ändringarna kunde inte sparas.",
    updated: "Uppdaterad",
  },
  da: englishUi,
  nb: englishUi,
  en: englishUi,
};

function renderBody(body: string) {
  return body
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block, index) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("## ")) {
        const [heading, ...paragraphLines] = trimmed.split("\n");
        const paragraph = paragraphLines.join("\n").trim();
        return (
          <section className="legal-document__section" key={`${index}-${heading}`}>
            <h2>{heading.slice(3)}</h2>
            {paragraph && <p>{paragraph}</p>}
          </section>
        );
      }
      return <p key={`${index}-${trimmed.slice(0, 20)}`}>{trimmed}</p>;
    });
}

export function LegalPage({ route, locale, copy, user, onHome }: LegalPageProps) {
  const [page, setPage] = useState<LegalPageContent>(() => getDefaultLegalPage(route.slug, locale));
  const [draft, setDraft] = useState(page);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const labels = uiCopy[locale];
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let active = true;
    const fallback = getDefaultLegalPage(route.slug, locale);
    setPage(fallback);
    setDraft(fallback);
    setEditing(false);
    setLoading(true);
    setNotice("");
    setError("");

    legalPageService
      .get(route.slug, locale)
      .then((loaded) => {
        if (!active) return;
        setPage(loaded);
        setDraft(loaded);
      })
      .catch(() => {
        if (active) setError(labels.loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [labels.loadError, locale, route.slug]);

  useEffect(() => {
    if (!isAdmin) setEditing(false);
  }, [isAdmin]);

  const navigateHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || user.role !== "admin") return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await legalPageService.save(draft, user);
      setPage(saved);
      setDraft(saved);
      setEditing(false);
      setNotice(labels.saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="legal-page" aria-labelledby="legal-page-title" aria-busy={loading}>
      <div className="legal-page__inner section-shell">
        <nav className="breadcrumbs" aria-label={copy.breadcrumbs}>
          <a href="/" onClick={navigateHome}>
            {copy.home}
          </a>
          <span>/</span>
          <span aria-current="page">{page.title}</span>
        </nav>

        <header className="legal-page__header">
          <div>
            <span className="section-index">{labels.eyebrow}</span>
            <h1 id="legal-page-title" tabIndex={-1}>
              {page.title}
            </h1>
            <p>{page.summary}</p>
          </div>
          {isAdmin && (
            <div className="legal-page__admin-actions">
              <span className="admin-badge">
                <Icon name="shield" /> {labels.adminMode}
              </span>
              {!editing && (
                <button
                  className="button button--dark"
                  type="button"
                  onClick={() => {
                    setDraft(page);
                    setEditing(true);
                    setNotice("");
                    setError("");
                  }}
                >
                  {labels.edit}
                </button>
              )}
            </div>
          )}
        </header>

        {notice && (
          <p className="legal-page__notice" role="status">
            <Icon name="check" /> {notice}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {editing && isAdmin ? (
          <form className="legal-editor" onSubmit={save}>
            <div className="legal-editor__heading">
              <div>
                <span className="section-index">ADMIN</span>
                <h2>{labels.editorTitle}</h2>
                <p>{labels.editorHelp}</p>
              </div>
            </div>
            <label>
              {labels.title}
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                minLength={3}
                maxLength={120}
                required
              />
            </label>
            <label>
              {labels.summary}
              <textarea
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                rows={4}
                minLength={10}
                maxLength={500}
                required
              />
            </label>
            <label>
              {labels.body}
              <textarea
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                rows={20}
                minLength={20}
                maxLength={30000}
                required
              />
              <small>{labels.formatHelp}</small>
            </label>
            <div className="legal-editor__actions">
              <button
                className="button button--outline"
                type="button"
                onClick={() => {
                  setDraft(page);
                  setEditing(false);
                  setError("");
                }}
              >
                {copy.cancel}
              </button>
              <button className="button button--primary" type="submit" disabled={saving}>
                {saving ? labels.saving : labels.save}
                {!saving && <Icon name="check" />}
              </button>
            </div>
          </form>
        ) : (
          <article className="legal-document">{renderBody(page.body)}</article>
        )}

        {page.updatedAt && (
          <p className="legal-page__updated">
            {labels.updated}: {new Date(page.updatedAt).toLocaleDateString(locale)}
          </p>
        )}
      </div>
    </section>
  );
}
