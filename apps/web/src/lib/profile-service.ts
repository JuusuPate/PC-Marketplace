import type { DemoUser } from "../types";
import { getAccountPath } from "../config/account-routes";
import { authRedirectUrl } from "../config/auth-routes";
import { mapUser } from "./auth-service";
import { demoStorage } from "./demo-storage";
import { prepareListingImages, releasePreparedListingImages } from "./listing-images";
import { AVATAR_BUCKET } from "./profile-avatar";
import { supabase } from "./supabase";

export class ProfileEditingUnavailableError extends Error {}
/** Puuttuva palvelinasennus tai verkkovirhe ei saa tuottaa pelkkää Auth-metadataan tallennusta. */
export async function profileEditingAvailable(): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { data, error } = await supabase.rpc("get_profile_editing_enabled");
    return !error && data === true;
  } catch {
    return false;
  }
}

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function demoSave(current: DemoUser, next: DemoUser): DemoUser {
  if (demoStorage.getSession()?.id !== current.id) throw new Error("Session changed");
  demoStorage.setListings(
    demoStorage.getListings().map((listing) =>
      listing.seller.id !== current.id
        ? listing
        : {
            ...listing,
            seller: {
              ...listing.seller,
              name: next.name,
              initials: next.name.slice(0, 2).toUpperCase(),
              avatarUrl: next.avatarUrl,
            },
          },
    ),
  );
  demoStorage.setSession(next);
  return next;
}
/** Kuva valmistellaan ennen latausta. Vanha kuva säilyy, kunnes Authin
 * atominen profiilipäivitys on onnistunut. RLS estää käytössä olevan kuvan poiston. */
export async function savePublicProfile(
  current: DemoUser,
  name: string,
  file: File | null,
  removeAvatar: boolean,
): Promise<DemoUser> {
  name = name.trim();
  if (name.length < 2 || name.length > 60) throw new Error("Invalid display name");
  if (!(await profileEditingAvailable())) throw new ProfileEditingUnavailableError("Profile editing is not installed");
  const images = file ? await prepareListingImages([file], { mode: "demo" }) : [];
  let uploaded: string | undefined;
  let committed = false;
  const client = supabase;
  try {
    if (!client)
      return demoSave(current, {
        ...current,
        name,
        avatarUrl: file ? await dataUrl(images[0].blob) : removeAvatar ? undefined : current.avatarUrl,
      });
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || identity.user?.id !== current.id) throw new Error("Session changed");
    const oldPath =
      typeof identity.user.user_metadata.avatar_path === "string" ? identity.user.user_metadata.avatar_path : null;
    let path = removeAvatar ? null : oldPath;
    if (file) {
      path = `${current.id}/${crypto.randomUUID()}.webp`;
      const { error } = await client.storage
        .from(AVATAR_BUCKET)
        .upload(path, images[0].blob, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
      if (error) throw error;
      uploaded = path;
    }
    const { data: again, error: againError } = await client.auth.getUser();
    if (againError || again.user?.id !== current.id) throw new Error("Session changed");
    const { data, error } = await client.auth.updateUser({ data: { display_name: name, avatar_path: path } });
    if (error) throw error;
    if (data.user?.id !== current.id) throw new Error("Session changed");
    committed = true;
    if (oldPath && oldPath !== path && oldPath.startsWith(current.id + "/")) {
      try {
        await client.storage.from(AVATAR_BUCKET).remove([oldPath]);
      } catch {
        /* Tallennettu profiili säilyy, vaikka vanhan tiedoston siivous epäonnistuu. */
      }
    }
    return mapUser(data.user);
  } finally {
    if (client && uploaded && !committed) {
      try {
        await client.storage.from(AVATAR_BUCKET).remove([uploaded]);
      } catch {
        /* Älä peitä alkuperäistä virhettä. */
      }
    }
    releasePreparedListingImages(images);
  }
}
/** Auth hoitaa sähköpostin vahvistuksen; julkiseen profiles-tauluun ei tallenneta osoitetta. */
export async function requestProfileEmailChange(current: DemoUser, email: string): Promise<DemoUser> {
  email = email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (!supabase) return demoSave(current, { ...current, email });
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || identity.user?.id !== current.id) throw new Error("Session changed");
  const { data, error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: authRedirectUrl(window.location.origin, getAccountPath("profile")) },
  );
  if (error) throw error;
  if (data.user?.id !== current.id) throw new Error("Session changed");
  return mapUser(data.user);
}
