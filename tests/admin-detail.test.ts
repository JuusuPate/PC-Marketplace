import { beforeEach, expect, it, vi } from "vitest";
import {
  getAdminUserDetail,
  getAdminOrderDetail,
  parseAdminUserDetail,
  parseAdminOrderDetail,
} from "../apps/web/src/lib/admin-detail-service";
import { AdminAccessError } from "../apps/web/src/lib/admin-service";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({ supabase: { rpc: mock.rpc } }));
const id = "00000000-0000-4000-8000-000000000001";
const base = { id, market: "FI", currency: "EUR" };
const user = {
  ...base,
  email: "user@example.test",
  listings: 0,
  sales: 0,
  purchases: 0,
  disputes: 0,
  orders_total: 0,
  orders: [],
};
const order = {
  ...base,
  status: "paid",
  payment_provider: "test",
  payment_reference: null,
  inspection_deadline: null,
  shipment: null,
};
beforeEach(() => vi.clearAllMocks());
it("validates and loads details by exact UUID", async () => {
  mock.rpc.mockResolvedValue({ data: user, error: null });
  expect((await getAdminUserDetail(id)).email).toBe("user@example.test");
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("get_admin_user_detail", { p_user_id: id });
  mock.rpc.mockResolvedValue({ data: order, error: null });
  expect((await getAdminOrderDetail(id)).shipment).toBeNull();
  expect(() => parseAdminOrderDetail({ ...order, id: "00000000-0000-4000-8000-000000000002" }, id)).toThrow();
});
it("does not turn missing or invalid data into success", () => {
  for (const patch of [{ email: 4 }, { sales: -1 }, { orders_total: 0, orders: [{}] }, { market: "SE" }])
    expect(() => parseAdminUserDetail({ ...user, ...patch }, id)).toThrow();
  for (const patch of [
    { status: "unknown" },
    { inspection_deadline: "bad" },
    { shipment: {} },
    { payment_reference: {} },
  ])
    expect(() => parseAdminOrderDetail({ ...order, ...patch }, id)).toThrow();
});
it("rejects invalid IDs before transport and handles revoked access", async () => {
  await expect(getAdminUserDetail("bad")).rejects.toThrow();
  await expect(getAdminOrderDetail("bad")).rejects.toThrow();
  expect(mock.rpc).not.toHaveBeenCalled();
  mock.rpc.mockResolvedValue({ error: { code: "42501" } });
  await expect(getAdminUserDetail(id)).rejects.toBeInstanceOf(AdminAccessError);
  await expect(getAdminOrderDetail(id)).rejects.toBeInstanceOf(AdminAccessError);
});
