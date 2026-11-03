import { beforeEach, expect, it, vi } from "vitest";
import { savePublicProfile, requestProfileEmailChange } from "../apps/web/src/lib/profile-service";
import type { DemoUser } from "../apps/web/src/types";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  prepare: vi.fn(),
  release: vi.fn(),
}));
vi.mock("../apps/web/src/lib/supabase", () => ({
  backendMode: "supabase",
  supabase: {
    auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
    rpc: mocks.rpc,
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: "https://project.test/" + path } }),
      }),
    },
  },
}));
vi.mock("../apps/web/src/lib/listing-images", () => ({
  prepareListingImages: mocks.prepare,
  releasePreparedListingImages: mocks.release,
}));
const current: DemoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Old name",
  email: "old@example.test",
  locale: "fi",
  role: "user",
  countryCode: "FI",
};
const oldPath = current.id + "/11111111-1111-4111-8111-111111111111.webp";
const identity = {
  id: current.id,
  email: current.email,
  user_metadata: { display_name: current.name, avatar_path: oldPath },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("window", { location: { origin: "http://localhost:4173" } });
  mocks.getUser.mockResolvedValue({ data: { user: identity }, error: null });
  mocks.rpc.mockImplementation(async (name) => ({ data: name === "get_profile_editing_enabled", error: null }));
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.prepare.mockResolvedValue([{ blob: new Blob(["webp"], { type: "image/webp" }), previewUrl: "blob:preview" }]);
  mocks.updateUser.mockImplementation(async (attrs) => ({
    data: { user: { ...identity, user_metadata: { ...identity.user_metadata, ...attrs.data } } },
    error: null,
  }));
});
it("uploads before committing Auth metadata, then removes the superseded image", async () => {
  const next = await savePublicProfile(
    current,
    "New public name",
    new File(["x"], "photo.png", { type: "image/png" }),
    false,
  );
  expect(next.name).toBe("New public name");
  expect(next.role).toBe("user");
  const path = mocks.upload.mock.calls[0][0];
  expect(path).toMatch(new RegExp("^" + current.id + "/.*\\.webp$"));
  expect(mocks.updateUser).toHaveBeenCalledWith({ data: { display_name: "New public name", avatar_path: path } });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([oldPath]);
  expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
  expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
  expect(mocks.release).toHaveBeenCalled();
});
it("a rejected profile write cleans up only the new upload and keeps the old image", async () => {
  mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { code: "invalid" } });
  await expect(savePublicProfile(current, "New name", new File(["x"], "photo.png"), false)).rejects.toEqual({
    code: "invalid",
  });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([mocks.upload.mock.calls[0][0]]);
  expect(mocks.remove).not.toHaveBeenCalledWith([oldPath]);
});
it("checks identity before writing and leaves names outside the allowed length rejected", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { ...identity, id: "another-user" } }, error: null });
  await expect(savePublicProfile(current, "Valid name", null, false)).rejects.toThrow("Session changed");
  await expect(savePublicProfile(current, "x", null, false)).rejects.toThrow("Invalid display name");
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("uses Auth email confirmation and preserves the old address until confirmed", async () => {
  const next = await requestProfileEmailChange(current, "new@example.test");
  expect(next.email).toBe(current.email);
  expect(mocks.updateUser).toHaveBeenCalledWith(
    { email: "new@example.test" },
    { emailRedirectTo: expect.stringContaining("paluu=") },
  );
  await expect(requestProfileEmailChange(current, "bad")).rejects.toThrow("Invalid email");
});

it("fails closed before any write if the remote profile migration is not installed", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(savePublicProfile(current, "Valid name", null, false)).rejects.toThrow(
    "Profile editing is not installed",
  );
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
