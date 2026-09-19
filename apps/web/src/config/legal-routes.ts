import type { LegalPageSlug } from "../types";

export type LegalLabelKey = "terms" | "privacy" | "accessibility" | "safety";

export interface LegalRoute {
  slug: LegalPageSlug;
  path: string;
  labelKey: LegalLabelKey;
}

export const LEGAL_ROUTES: LegalRoute[] = [
  { slug: "terms", path: "/kayttoehdot", labelKey: "terms" },
  { slug: "privacy", path: "/tietosuoja", labelKey: "privacy" },
  { slug: "accessibility", path: "/saavutettavuus", labelKey: "accessibility" },
  { slug: "safety", path: "/turvallisuus", labelKey: "safety" },
];

export function getLegalRoute(pathname: string): LegalRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return LEGAL_ROUTES.find((route) => route.path === normalizedPath) ?? null;
}

export function getLegalPath(slug: LegalPageSlug) {
  return LEGAL_ROUTES.find((route) => route.slug === slug)?.path ?? "/";
}
