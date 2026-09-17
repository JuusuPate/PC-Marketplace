import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { adminService, AdminAccessError, parseAdminUsers } from "../apps/web/src/lib/admin-service";
import { AdminUsersTable } from "../apps/web/src/features/admin/AdminUsersPanel";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { isAdminUsersPath } from "../apps/web/src/config/admin-routes";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "supabase", supabase: { rpc: mock.rpc } }));
const response = () => ({
  market: "FI",
  page: 0,
  page_size: 25,
  total: 1,
  users: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      display_name: "<script>Boss</script>",
      locale: "fi",
      joined_at: "2026-09-17T12:00:00Z",
      role: "admin",
    },
  ],
});
beforeEach(() => vi.clearAllMocks());
it("recognizes only the users route", () => {
  expect(isAdminUsersPath("/admin/users/")).toBe(true);
  expect(isAdminUsersPath("/admin/users/unknown")).toBe(false);
});
it("calls the bounded directory RPC", async () => {
  mock.rpc.mockResolvedValue({ data: response(), error: null });
  expect(await adminService.getUsers(" Boss ")).toMatchObject({ total: 1, users: [{ role: "admin" }] });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_users", { p_search: "Boss", p_page: 0 });
});
it.each(["42501", "PGRST301", "PGRST302"])("denies %s and propagates configuration errors", async (code) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code } });
  await expect(adminService.getUsers()).rejects.toBeInstanceOf(AdminAccessError);
  const error = { code: "PGRST202" };
  mock.rpc.mockResolvedValue({ data: null, error });
  await expect(adminService.getUsers()).rejects.toBe(error);
});
it("rejects invalid queries before calling Supabase", async () => {
  await expect(adminService.getUsers("a".repeat(101))).rejects.toThrow();
  for (const page of [-1, 1.5, 1000001, NaN]) await expect(adminService.getUsers("", page)).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects malformed rows and unexpected page numbers", async () => {
  for (const change of [{ role: "owner" }, { id: "invalid" }, { joined_at: "invalid" }, { display_name: null }]) {
    const value = response();
    Object.assign(value.users[0], change);
    expect(() => parseAdminUsers(value)).toThrow();
  }
  for (const change of [{ market: "SE" }, { total: -1 }, { page_size: 100 }, { users: null }])
    expect(() => parseAdminUsers({ ...response(), ...change })).toThrow();
  mock.rpc.mockResolvedValue({ data: { ...response(), page: 1 }, error: null });
  await expect(adminService.getUsers()).rejects.toThrow("Unexpected user page");
});
it("renders translated tables, escapes names and explains empty results", () => {
  for (const locale of ["fi", "sv", "en"] as const) {
    const html = renderToStaticMarkup(createElement(AdminUsersTable, { data: parseAdminUsers(response()), locale }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  }
  expect(
    renderToStaticMarkup(
      createElement(AdminUsersTable, { data: { page: 0, pageSize: 25, total: 0, users: [] }, locale: "fi" }),
    ),
  ).toContain("ei löytynyt");
});
it("keeps the users page guarded during login and role checks", () => {
  const props = { locale: "fi" as const, overview: false, users: true, onLogin: vi.fn(), onNavigate: vi.fn() };
  const user = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    countryCode: "FI" as const,
    locale: "fi" as const,
    role: "user" as const,
  };
  for (const authLoading of [true, false]) {
    const html = renderToStaticMarkup(createElement(AdminDashboardPage, { ...props, user, authLoading }));
    expect(html).not.toContain("admin-user-search");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
