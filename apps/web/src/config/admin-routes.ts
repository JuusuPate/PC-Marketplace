export const ADMIN_PATH = "/admin";

export function isAdminPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`);
}

export function isAdminOverviewPath(pathname: string) {
  return (pathname.replace(/\/+$/, "") || "/") === ADMIN_PATH;
}

export function isAdminUsersPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/users`;
}

export function isAdminListingsPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/listings`;
}

export function isAdminTransactionsPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/transactions`;
}

export function isAdminRevenuePath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/revenue`;
}

export function isAdminMarketDataPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/market-data`;
}

export function isAdminCatalogPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/catalog`;
}
