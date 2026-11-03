import { supabase } from "./supabase";
export const AVATAR_BUCKET = "profile-avatars";
export function profileAvatarUrl(path: unknown): string | undefined {
  if (typeof path !== "string" || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(path)) return undefined;
  return supabase?.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}
