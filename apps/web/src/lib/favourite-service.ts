import { demoStorage } from "./demo-storage";
import { supabase } from "./supabase";

export const favouriteService = {
  async listMine(userId: string): Promise<string[]> {
    if (!supabase) return demoStorage.getFavourites();

    const { data, error } = await supabase
      .from("favourites")
      .select("listing_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => String(row.listing_id));
  },

  async add(userId: string, listingId: string): Promise<void> {
    if (!supabase) {
      demoStorage.setFavourites([...new Set([...demoStorage.getFavourites(), listingId])]);
      return;
    }

    const { error } = await supabase.from("favourites").insert({ user_id: userId, listing_id: listingId });
    if (error && error.code !== "23505") throw error;
  },

  async remove(userId: string, listingId: string): Promise<void> {
    if (!supabase) {
      demoStorage.setFavourites(demoStorage.getFavourites().filter((id) => id !== listingId));
      return;
    }

    const { error } = await supabase.from("favourites").delete().eq("user_id", userId).eq("listing_id", listingId);
    if (error) throw error;
  },
};
