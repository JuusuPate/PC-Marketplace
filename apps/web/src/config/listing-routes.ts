const LISTING_ROUTE_PREFIX = "/ilmoitukset/";

export function getListingPath(id: string) {
  if (!id) throw new Error("Ilmoituksen tunniste puuttuu.");
  return `${LISTING_ROUTE_PREFIX}${encodeURIComponent(id)}`;
}

export function getListingId(pathname: string): string | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (!normalizedPath.startsWith(LISTING_ROUTE_PREFIX)) return null;

  const encodedId = normalizedPath.slice(LISTING_ROUTE_PREFIX.length);
  if (!encodedId || encodedId.includes("/")) return null;

  try {
    const id = decodeURIComponent(encodedId);
    return id.length > 0 ? id : null;
  } catch {
    return null;
  }
}
