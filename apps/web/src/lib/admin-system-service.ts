import { getAdminAudit } from "./admin-audit-service";
import { AdminAccessError, adminService } from "./admin-service";
import { getAdminMarketingAnnouncements } from "./marketing-service";
import { loadProductModels } from "./product-model-service";

export type AdminSystemCheckKey = "overview" | "catalog" | "marketing" | "audit";
export type AdminSystemCheck = {
  key: AdminSystemCheckKey;
  status: "ok" | "error";
  durationMs: number;
};
export type AdminSystemSnapshot = { checkedAt: string; checks: AdminSystemCheck[] };

const probes: { key: AdminSystemCheckKey; run: () => Promise<unknown> }[] = [
  { key: "overview", run: () => adminService.getOverview() },
  { key: "catalog", run: () => loadProductModels("gpu", "", 0, true) },
  { key: "marketing", run: () => getAdminMarketingAnnouncements() },
  { key: "audit", run: () => getAdminAudit("", 0) },
];

export async function getAdminSystemSnapshot(): Promise<AdminSystemSnapshot> {
  const results = await Promise.all(
    probes.map(async ({ key, run }) => {
      const started = performance.now();
      try {
        await run();
        return { key, status: "ok" as const, durationMs: Math.max(0, Math.round(performance.now() - started)) };
      } catch (error) {
        return {
          key,
          status: "error" as const,
          durationMs: Math.max(0, Math.round(performance.now() - started)),
          denied: error instanceof AdminAccessError,
        };
      }
    }),
  );
  if (results.some((result) => "denied" in result && result.denied))
    throw new AdminAccessError("Admin access required");
  return { checkedAt: new Date().toISOString(), checks: results };
}
