export type AuthMode = "login" | "register" | "forgot";
const paths: Record<AuthMode, string> = {
  login: "/kirjaudu",
  register: "/rekisteroidy",
  forgot: "/salasana/unohtunut",
};

/** Paluu sallitaan vain sivuston sisäiseen osoitteeseen, ei uudelleen kirjautumissivulle. */
export function safeAuthReturnTo(value: string | null | undefined): string {
  if (!value || value.length > 2000 || !value.startsWith("/") || /[\\\u0000-\u001f]/.test(value)) return "/";
  try {
    if (/[\\\u0000-\u001f]/.test(decodeURIComponent(value))) return "/";
    const url = new URL(value, "https://pc-market.invalid");
    if (url.origin !== "https://pc-market.invalid" || Object.values(paths).includes(url.pathname.replace(/\/+$/, "")))
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function getAuthPath(mode: AuthMode = "login", returnTo = "/") {
  const target = safeAuthReturnTo(returnTo);
  return paths[mode] + (target === "/" ? "" : `?paluu=${encodeURIComponent(target)}`);
}

export function getAuthRoute(pathname: string, search: string) {
  const mode = (Object.entries(paths) as [AuthMode, string][]).find(
    ([, path]) => path === pathname.replace(/\/+$/, ""),
  )?.[0];
  return mode ? { mode, returnTo: safeAuthReturnTo(new URLSearchParams(search).get("paluu")) } : null;
}

/** OAuth ja sähköpostilinkit palaavat samaan istunnon tunnistavaan SPA-reittiin. */
export function authRedirectUrl(origin: string, returnTo = "/") {
  return new URL(getAuthPath("login", returnTo), origin).href;
}
