import { getDefaultLegalPage } from "../data/legal-pages";
import type { DemoUser, LegalPageContent, LegalPageSlug, Locale } from "../types";
import { demoStorage } from "./demo-storage";
import { backendMode, supabase } from "./supabase";

interface LegalPageRow {
  slug: LegalPageSlug;
  locale: Locale;
  title: string;
  summary: string;
  body: string;
  updated_at: string;
}

function fromRow(row: LegalPageRow): LegalPageContent {
  return {
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    summary: row.summary,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

function validate(page: LegalPageContent) {
  const title = page.title.trim();
  const summary = page.summary.trim();
  const body = page.body.trim();

  if (title.length < 3 || title.length > 120) throw new Error("Otsikon tulee olla 3–120 merkkiä.");
  if (summary.length < 10 || summary.length > 500) throw new Error("Johdannon tulee olla 10–500 merkkiä.");
  if (body.length < 20 || body.length > 30_000) throw new Error("Sisällön tulee olla 20–30 000 merkkiä.");

  return { ...page, title, summary, body };
}

export const legalPageService = {
  async get(slug: LegalPageSlug, locale: Locale): Promise<LegalPageContent> {
    const fallback = getDefaultLegalPage(slug, locale);

    if (backendMode === "demo" || !supabase) {
      return demoStorage.getLegalPage(slug, locale) ?? fallback;
    }

    const client = supabase;
    const selectPage = async (selectedLocale: Locale) =>
      client
        .from("legal_pages")
        .select("slug, locale, title, summary, body, updated_at")
        .eq("slug", slug)
        .eq("locale", selectedLocale)
        .eq("is_published", true)
        .maybeSingle<LegalPageRow>();

    const localized = await selectPage(locale);
    if (!localized.error && localized.data) return fromRow(localized.data);

    if (locale !== "fi") {
      const finnish = await selectPage("fi");
      if (!finnish.error && finnish.data) return { ...fromRow(finnish.data), locale };
    }

    return fallback;
  },

  async save(page: LegalPageContent, user: DemoUser): Promise<LegalPageContent> {
    if (user.role !== "admin") throw new Error("Vain admin-käyttäjä voi muokata sisältösivuja.");
    const validated = validate(page);

    if (backendMode === "demo" || !supabase) {
      const saved = { ...validated, updatedAt: new Date().toISOString() };
      demoStorage.setLegalPage(saved, user);
      return saved;
    }

    const { data, error } = await supabase
      .rpc("upsert_legal_page", {
        p_slug: validated.slug,
        p_locale: validated.locale,
        p_title: validated.title,
        p_summary: validated.summary,
        p_body: validated.body,
      })
      .single<LegalPageRow>();

    if (error) throw error;
    return fromRow(data);
  },
};
