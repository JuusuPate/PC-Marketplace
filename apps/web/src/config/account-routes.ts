export const ACCOUNT_PATHS = {
  profile: "/oma-tili",
  settings: "/oma-tili/asetukset",
  listings: "/oma-tili/ilmoitukset",
  orders: "/oma-tili/ostokset",
} as const;
export type AccountTab = keyof typeof ACCOUNT_PATHS;
export function getAccountPath(tab: AccountTab) {
  return ACCOUNT_PATHS[tab];
}
export function getAccountTab(pathname: string): AccountTab | null {
  const path = pathname.replace(/\/+$/, "");
  return (Object.keys(ACCOUNT_PATHS) as AccountTab[]).find((tab) => ACCOUNT_PATHS[tab] === path) ?? null;
}
