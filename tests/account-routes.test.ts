import { expect, it } from "vitest";
import { ACCOUNT_PATHS, getAccountPath, getAccountTab } from "../apps/web/src/config/account-routes";
it("matches each private account page, including trailing slashes", () => {
  for (const tab of Object.keys(ACCOUNT_PATHS) as (keyof typeof ACCOUNT_PATHS)[]) {
    expect(getAccountTab(getAccountPath(tab))).toBe(tab);
    expect(getAccountTab(getAccountPath(tab) + "/")).toBe(tab);
  }
});
it.each(["/", "/kirjaudu", "/oma-tili/ei-ole", "/oma-tili-ulkoinen", "https://outside.test/oma-tili"])(
  "does not match unrelated paths: %s",
  (path) => {
    expect(getAccountTab(path)).toBeNull();
  },
);
