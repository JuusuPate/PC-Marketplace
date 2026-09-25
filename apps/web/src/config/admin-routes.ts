export const ADMIN_PATH = "/admin";

export function isAdminAuditPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/audit`;
}

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

export function isAdminMarketingPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/marketing`;
}

export function isAdminReportsPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/reports`;
}

export function isAdminDisputesPath(pathname: string) {
  return pathname.replace(/\/+$/, "") === `${ADMIN_PATH}/disputes`;
}
