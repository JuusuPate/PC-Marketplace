import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authService, GoogleAuthUnavailableError } from "../apps/web/src/lib/auth-service";
const mock = vi.hoisted(() => ({ google: vi.fn(), oauth: vi.fn(), signup: vi.fn(), reset: vi.fn() }));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  passwordRecoveryRedirect: false,
  googleAuthEnabled: mock.google,
  supabase: { auth: { signInWithOAuth: mock.oauth, signUp: mock.signup, resetPasswordForEmail: mock.reset } },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { origin: "https://market.test" } });
});
afterEach(() => vi.unstubAllGlobals());
it("starts the same Google flow for existing users and new accounts, retaining the internal destination", async () => {
  mock.google.mockResolvedValue(true);
  mock.oauth.mockResolvedValue({ error: null });
  await authService.signInWithGoogle("/myy/uusi");
  expect(mock.oauth).toHaveBeenCalledExactlyOnceWith({
    provider: "google",
    options: { redirectTo: "https://market.test/kirjaudu?paluu=%2Fmyy%2Fuusi" },
  });
});
it("does not navigate to a disabled provider or manufacture a signed-in user", async () => {
  mock.google.mockResolvedValue(false);
  await expect(authService.signInWithGoogle()).rejects.toBeInstanceOf(GoogleAuthUnavailableError);
  expect(mock.oauth).not.toHaveBeenCalled();
});
it("does not start OAuth if availability cannot be checked", async () => {
  mock.google.mockRejectedValue(new Error("Network error"));
  await expect(authService.signInWithGoogle()).rejects.toThrow("Network error");
  expect(mock.oauth).not.toHaveBeenCalled();
});
it("propagates OAuth errors and sanitizes an external return URL", async () => {
  mock.google.mockResolvedValue(true);
  mock.oauth.mockResolvedValue({ error: new Error("OAuth error") });
  await expect(authService.signInWithGoogle("https://outside.test")).rejects.toThrow("OAuth error");
  expect(mock.oauth.mock.calls[0][0].options.redirectTo).toBe("https://market.test/kirjaudu");
});
it("keeps email confirmation pending and uses the safe callback for registration", async () => {
  mock.signup.mockResolvedValue({ data: { session: null, user: null }, error: null });
  expect(await authService.signUp("Test User", "test@example.test", "password", "FI", "fi", "/myy/uusi")).toEqual({
    user: null,
    confirmationRequired: true,
  });
  expect(mock.signup.mock.calls[0][0].options.emailRedirectTo).toBe("https://market.test/kirjaudu?paluu=%2Fmyy%2Fuusi");
});
it("preserves the destination in password reset links", async () => {
  mock.reset.mockResolvedValue({ error: null });
  await authService.requestPasswordReset("test@example.test", "/admin");
  expect(mock.reset).toHaveBeenCalledExactlyOnceWith("test@example.test", {
    redirectTo: "https://market.test/kirjaudu?paluu=%2Fadmin",
  });
});
