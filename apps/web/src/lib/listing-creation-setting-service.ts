import { AdminAccessError } from "./admin-service";
import { backendMode, supabase } from "./supabase";

export interface ListingCreationSetting {
  enabled: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export class ListingCreationSettingConflictError extends Error {}
export class ListingCreationPausedError extends Error {}

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function parseListingCreationSetting(value: unknown): ListingCreationSetting {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid listing creation setting");
  const row = value as Record<string, unknown>;
  if (
    typeof row.enabled !== "boolean" ||
    typeof row.version !== "number" ||
    !Number.isSafeInteger(row.version) ||
    row.version < 1 ||
    row.version > 2147483647 ||
    typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.updated_at)) ||
    (row.updated_by !== null && (typeof row.updated_by !== "string" || !uuid.test(row.updated_by)))
  )
    throw new Error("Invalid listing creation setting");
  return {
    enabled: row.enabled,
    version: row.version,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function throwIfError(error: { code?: string } | null) {
  if (!error) return;
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) throw new AdminAccessError("Admin access required");
  if (error.code === "40001") throw new ListingCreationSettingConflictError("Setting changed");
  throw error;
}

export async function getPublicListingCreationEnabled(): Promise<boolean> {
  if (backendMode === "demo") return true;
  if (!supabase) throw new Error("Supabase required");
  const { data, error } = await supabase.rpc("get_listing_creation_enabled");
  if (error) throw error;
  if (typeof data !== "boolean") throw new Error("Invalid listing creation status");
  return data;
}

export async function getAdminListingCreationSetting(): Promise<ListingCreationSetting> {
  if (!supabase) throw new Error("Supabase required");
  const { data, error } = await supabase.rpc("get_admin_listing_creation_setting");
  throwIfError(error);
  return parseListingCreationSetting(data);
}

export async function saveAdminListingCreationSetting(enabled: boolean, expectedVersion: number) {
  if (
    typeof enabled !== "boolean" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    expectedVersion > 2147483647
  )
    throw new Error("Invalid listing creation setting");
  if (!supabase) throw new Error("Supabase required");
  const { data, error } = await supabase.rpc("save_admin_listing_creation_setting", {
    p_enabled: enabled,
    p_expected_version: expectedVersion,
  });
  throwIfError(error);
  const result = parseListingCreationSetting(data);
  if (result.enabled !== enabled || result.version < expectedVersion || result.version > expectedVersion + 1)
    throw new Error("Unexpected listing creation setting");
  return result;
}

export function throwIfListingCreationPaused(error: unknown): void {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    error.code === "P0001" &&
    error.message === "Listing creation paused"
  )
    throw new ListingCreationPausedError("Listing creation paused");
}
