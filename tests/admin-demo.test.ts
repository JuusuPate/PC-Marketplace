import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminDashboardPage } from "../apps/web/src/features/admin/AdminDashboardPage";
import { adminService } from "../apps/web/src/lib/admin-service";

vi.mock("../apps/web/src/lib/supabase", () => ({ backendMode: "demo", supabase: null }));

it("does not manufacture dashboard metrics in demo mode", async () => {
  const html = renderToStaticMarkup(
    createElement(AdminDashboardPage, {
      locale: "fi",
      user: {
        id: "demo-admin",
        name: "Admin",
        email: "admin@pcmarket.fi",
        role: "admin",
        countryCode: "FI",
        locale: "fi",
      },
      authLoading: false,
      overview: true,
      onLogin: vi.fn(),
      onNavigate: vi.fn(),
    }),
  );
  expect(html).toContain("Dashboard tarvitsee palveluyhteyden");
  expect(html).not.toContain("Rekisteröityneet käyttäjät");
  await expect(adminService.getOverview()).rejects.toThrow("requires Supabase");
});
