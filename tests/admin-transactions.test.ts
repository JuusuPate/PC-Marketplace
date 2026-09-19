import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminTransactions,
  parseAdminTransactions,
  type TransactionFilter,
} from "../apps/web/src/lib/admin-transactions-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
import { AdminTransactionsTable } from "../apps/web/src/features/admin/AdminTransactionsPanel";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { isAdminTransactionsPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  currency: "EUR",
  page: 0,
  page_size: 25,
  total: 1,
  transactions: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      seller_id: "00000000-0000-4000-8000-000000000002",
      title: "<script>GPU</script>",
      seller_name: "<script>Seller</script>",
      status: "paid",
      listing_id: "00000000-0000-4000-8000-000000000003",
      buyer_id: "00000000-0000-4000-8000-000000000004",
      buyer_name: "Buyer",
      item_price_minor: 12000,
      marketplace_fee_minor: 99,
      payment_processing_minor: 0,
      shipping_minor: 500,
      total_minor: 12599,
      created_at: "2026-09-17T12:00:00Z",
    },
  ],
});
beforeEach(() => vi.clearAllMocks());
it("recognizes the transactions route precisely", () => {
  expect(isAdminTransactionsPath("/admin/transactions/")).toBe(true);
  expect(isAdminTransactionsPath("/admin/transactions/unknown")).toBe(false);
});
it("sends search, state and page to the protected RPC", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect(await getAdminTransactions(" GPU ", "paid")).toMatchObject({
    total: 1,
    transactions: [{ totalMinor: 12599 }],
  });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_transactions", {
    p_search: "GPU",
    p_status: "paid",
    p_page: 0,
  });
});
it.each(["42501", "PGRST301", "PGRST302"])("denies access on %s", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(getAdminTransactions()).rejects.toBeInstanceOf(AdminAccessError);
});
it("preserves configuration failures and rejects unexpected pages", async () => {
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(getAdminTransactions()).rejects.toBe(error);
  mock.rpc.mockResolvedValue({ data: { ...response(), page: 1 }, error: null });
  await expect(getAdminTransactions()).rejects.toThrow("Unexpected transaction page");
});
it("rejects invalid filters before making a request", async () => {
  await expect(getAdminTransactions("a".repeat(101))).rejects.toThrow();
  await expect(getAdminTransactions("", "unknown" as TransactionFilter)).rejects.toThrow();
  for (const page of [-1, 1.5, NaN, 1000001]) await expect(getAdminTransactions("", "", page)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects invalid records and unsafe money values", () => {
  for (const change of [
    { status: "unknown" },
    { id: "bad" },
    { listing_id: "bad" },
    { buyer_id: "bad" },
    { buyer_name: null },
    { shipping_minor: -1 },
    { marketplace_fee_minor: Number.MAX_SAFE_INTEGER + 1 },
    { seller_id: "bad" },
    { title: null },
    { seller_name: null },
    { created_at: "bad" },
    { total_minor: 0 },
    { total_minor: -1 },
    { total_minor: 1.5 },
    { total_minor: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const value = response();
    Object.assign(value.transactions[0], change);
    expect(() => parseAdminTransactions(value)).toThrow();
  }
  for (const change of [
    { market: "SE" },
    { currency: "SEK" },
    { page_size: 100 },
    { total: -1 },
    { transactions: null },
  ])
    expect(() => parseAdminTransactions({ ...response(), ...change })).toThrow();
});
it("renders localized, escaped titles and prices with cents", () => {
  for (const locale of ["fi", "sv", "en"] as const) {
    const html = renderToStaticMarkup(
      createElement(AdminTransactionsTable, { data: parseAdminTransactions(response()), locale }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/125[,.]99/);
    expect(html).toContain('scope="col"');
  }
  expect(
    renderToStaticMarkup(
      createElement(AdminTransactionsTable, {
        data: { page: 0, pageSize: 25, total: 0, transactions: [] },
        locale: "fi",
      }),
    ),
  ).toContain("ei löytynyt");
});
it("guards the transactions view during authentication and for ordinary users", () => {
  const props = { locale: "fi" as const, overview: false, transactions: true, onLogin: vi.fn(), onNavigate: vi.fn() };
  const user = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    countryCode: "FI" as const,
    locale: "fi" as const,
    role: "user" as const,
  };
  for (const authLoading of [true, false])
    expect(renderToStaticMarkup(createElement(AdminDashboardPage, { ...props, user, authLoading }))).not.toContain(
      "admin-transaction-search",
    );
  expect(mock.rpc).not.toHaveBeenCalled();
});
