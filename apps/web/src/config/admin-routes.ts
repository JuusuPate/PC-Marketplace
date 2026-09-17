export const ADMIN_PATH = "/admin";

export function isAdminPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`);
}

export function isAdminOverviewPath(pathname: string) {
  return (pathname.replace(/\/+$/, "") || "/") === ADMIN_PATH;
}
