import { demoStorage } from "./demo-storage";
import { supabase } from "./supabase";

export type ReportReason = "misleading" | "prohibited" | "scam" | "other";

/**
 * Hakee omat raportoidut ilmoitukset ja lähettää uuden raportin.
 * Supabase-RPC tunnistaa raportoijan istunnosta; demossa tallennetaan vain paikallinen raportointimerkintä.
 */
export const reportService = {
  async listMine(userId: string): Promise<string[]> {
    if (!supabase) return demoStorage.getReportedListingIds(userId);

    const { data, error } = await supabase.rpc("get_my_reported_listing_ids");
    if (error) throw error;
    return (data ?? []).map((row: { listing_id: string }) => String(row.listing_id));
  },

  async submit(userId: string, listingId: string, reason: ReportReason, details: string): Promise<void> {
    if (!supabase) {
      demoStorage.markReportedListing(listingId, userId);
      return;
    }

    const { error } = await supabase.rpc("submit_listing_report", {
      p_listing_id: listingId,
      p_reason: reason,
      p_details: details.trim() || null,
    });
    if (error) throw error;
  },
};
