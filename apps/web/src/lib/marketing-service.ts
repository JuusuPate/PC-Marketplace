import { AdminAccessError } from "./admin-service";
import { supabase } from "./supabase";
import type { Locale } from "../types";

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export interface MarketingAnnouncement {
  id: string;
  locale: Locale;
  title: string;
  body: string;
  isPublished: boolean;
  version: number;
  updatedAt: string;
}

export type AnnouncementInput = {
  id?: string;
  locale: Locale;
  title: string;
  body: string;
  isPublished: boolean;
  expectedVersion?: number;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid announcement response");
  return value as Record<string, unknown>;
}

function content(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length >= min && value.length <= max;
}

function isLocale(value: unknown): value is Locale {
  return value === "fi" || value === "sv" || value === "en";
}

function parsePublic(value: unknown): Pick<MarketingAnnouncement, "id" | "title" | "body"> | null {
  if (value === null) return null;
  const row = object(value);
  if (typeof row.id !== "string" || !uuid.test(row.id) || !content(row.title, 5, 100) || !content(row.body, 10, 400))
    throw new Error("Invalid public announcement");
  return { id: row.id, title: row.title, body: row.body };
}

export function parseAdminMarketingAnnouncements(value: unknown): MarketingAnnouncement[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error("Invalid announcement directory");
  return value.map((item) => {
    const row = object(item);
    if (
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      !isLocale(row.locale) ||
      !content(row.title, 5, 100) ||
      !content(row.body, 10, 400) ||
      typeof row.is_published !== "boolean" ||
      typeof row.version !== "number" ||
      !Number.isSafeInteger(row.version) ||
      row.version < 1 ||
      row.version > 2147483647 ||
      typeof row.updated_at !== "string" ||
      !Number.isFinite(Date.parse(row.updated_at))
    )
      throw new Error("Invalid announcement");
    return {
      id: row.id,
      locale: row.locale,
      title: row.title,
      body: row.body,
      isPublished: row.is_published,
      version: row.version,
      updatedAt: row.updated_at,
    };
  });
}

function throwIfError(error: { code?: string } | null) {
  if (!error) return;
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) throw new AdminAccessError("Admin access required");
  throw error;
}

export async function getPublicMarketingAnnouncement(locale: Locale) {
  if (!isLocale(locale)) throw new Error("Invalid locale");
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_marketing_announcement", { p_locale: locale });
  throwIfError(error);
  return parsePublic(data);
}

export async function getAdminMarketingAnnouncements(): Promise<MarketingAnnouncement[]> {
  if (!supabase) throw new Error("Marketing requires Supabase");
  const { data, error } = await supabase.rpc("get_admin_marketing_announcements");
  throwIfError(error);
  return parseAdminMarketingAnnouncements(data);
}

export async function saveAdminMarketingAnnouncement(input: AnnouncementInput): Promise<void> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (
    !isLocale(input.locale) ||
    !content(title, 5, 100) ||
    !content(body, 10, 400) ||
    typeof input.isPublished !== "boolean" ||
    (input.id !== undefined &&
      (!uuid.test(input.id) ||
        !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion! < 1 ||
        input.expectedVersion! > 2147483647)) ||
    (input.id === undefined && input.expectedVersion !== undefined)
  )
    throw new Error("Invalid announcement");
  if (!supabase) throw new Error("Marketing requires Supabase");
  const { error } = await supabase.rpc("save_admin_marketing_announcement", {
    p_id: input.id ?? null,
    p_locale: input.locale,
    p_title: title,
    p_body: body,
    p_published: input.isPublished,
    p_expected_version: input.expectedVersion ?? null,
  });
  if (error?.code === "40001") throw new MarketingConflictError("Announcement changed");
  throwIfError(error);
}

export class MarketingConflictError extends Error {}
