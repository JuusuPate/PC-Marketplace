import { describe, expect, it } from "vitest";
import { authRedirectUrl, getAuthPath, getAuthRoute, safeAuthReturnTo } from "../apps/web/src/config/auth-routes";

describe("authentication routes", () => {
  it("keeps local destinations across sign-in, registration and recovery", () => {
    for (const mode of ["login", "register", "forgot"] as const) {
      const href = getAuthPath(mode, "/kategoriat/pelitietokoneet?maxPrice=1000#marketplace");
      const url = new URL(href, "https://market.test");
      expect(getAuthRoute(url.pathname, url.search)).toEqual({
        mode,
        returnTo: "/kategoriat/pelitietokoneet?maxPrice=1000#marketplace",
      });
    }
    expect(getAuthRoute("/kategoriat/kaikki", "")).toBeNull();
    expect(getAuthRoute("/kirjaudu/", "?paluu=%2Fadmin")?.returnTo).toBe("/admin");
  });
  it.each([
    undefined,
    null,
    "https://outside.test/",
    "//outside.test/",
    "///outside.test/",
    "/\\outside.test/",
    "/%5coutside.test/",
    "/\n/outside.test",
    "/%0d%0aX-test:foo",
    "/kirjaudu?paluu=/myy/uusi",
    "/rekisteroidy/",
    "/salasana/unohtunut",
    "/%zz",
  ])("rejects external, malformed and recursive destinations: %s", (value) => {
    expect(safeAuthReturnTo(value)).toBe("/");
  });
  it("builds the OAuth callback on the current origin and validates the destination again", () => {
    expect(authRedirectUrl("https://market.test", "/myy/uusi")).toBe(
      "https://market.test/kirjaudu?paluu=%2Fmyy%2Fuusi",
    );
    expect(authRedirectUrl("https://market.test", "//outside.test")).toBe("https://market.test/kirjaudu");
  });
});
