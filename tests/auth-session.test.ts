import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authService } from "../apps/web/src/lib/auth-service";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  supabase: { rpc: mock.rpc, auth: { onAuthStateChange: mock.onAuthStateChange } },
}));
const authUser = {
  id: "admin-id",
  email: "admin@example.test",
  user_metadata: { display_name: "Admin", role: "admin" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout });
  mock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mock.unsubscribe } } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps the dashboard waiting until the server resolves the admin role", async () => {
  mock.rpc.mockResolvedValue({ data: true, error: null });
  const listener = vi.fn();
  const loading = vi.fn();
  const stop = authService.subscribe(listener, loading);
  const callback = mock.onAuthStateChange.mock.calls[0][0];
  callback("INITIAL_SESSION", { user: authUser });
  expect(loading).toHaveBeenLastCalledWith(true);
  expect(listener).not.toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: "admin-id", role: "admin" }));
  expect(loading).toHaveBeenLastCalledWith(false);
  stop();
});

it("ignores a pending admin lookup after sign-out", async () => {
  let finish!: (value: unknown) => void;
  mock.rpc.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const listener = vi.fn();
  const loading = vi.fn();
  const stop = authService.subscribe(listener, loading);
  const callback = mock.onAuthStateChange.mock.calls[0][0];
  callback("SIGNED_IN", { user: authUser });
  await vi.runAllTimersAsync();
  callback("SIGNED_OUT", null);
  finish({ data: true, error: null });
  await Promise.resolve();
  await Promise.resolve();
  expect(listener).toHaveBeenCalledExactlyOnceWith(null);
  expect(loading).toHaveBeenLastCalledWith(false);
  stop();
});

it("fails closed when the role lookup fails, regardless of user metadata", async () => {
  mock.rpc.mockRejectedValue(new Error("Connection lost"));
  const listener = vi.fn();
  const stop = authService.subscribe(listener);
  mock.onAuthStateChange.mock.calls[0][0]("INITIAL_SESSION", { user: authUser });
  await vi.runAllTimersAsync();
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ role: "user" }));
  stop();
});

it("does not update auth state after unsubscribing", async () => {
  mock.rpc.mockResolvedValue({ data: true, error: null });
  const listener = vi.fn();
  const stop = authService.subscribe(listener);
  mock.onAuthStateChange.mock.calls[0][0]("INITIAL_SESSION", { user: authUser });
  stop();
  await vi.runAllTimersAsync();
  expect(listener).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.unsubscribe).toHaveBeenCalledOnce();
});
