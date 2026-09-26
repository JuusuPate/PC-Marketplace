import { adminCount, adminRecord, adminRpc, adminTimestamp, adminUuid } from "./admin-activity-service";
import { dashboardDate, dashboardPeriods, type DashboardPeriod } from "./admin-dashboard-trends-service";

interface PriceSample {
  salesCount: number;
  valueMinor: number;
  averageMinor: number | null;
}
export interface ModelPriceTrends {
  modelId: string;
  days: DashboardPeriod;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  generatedAt: string;
  current: PriceSample;
  previous: PriceSample;
  changeMinor: number | null;
  changePercent: number | null;
  buckets: (PriceSample & { day: string })[];
}

function sample(value: unknown): PriceSample {
  const row = adminRecord(value);
  const salesCount = adminCount(row.sales_count),
    valueMinor = adminCount(row.value_minor);
  const averageMinor = row.average_minor === null ? null : adminCount(row.average_minor);
  if (
    salesCount === 0 ? valueMinor !== 0 || averageMinor !== null : averageMinor !== Math.round(valueMinor / salesCount)
  )
    throw new Error("Inconsistent price sample");
  return { salesCount, valueMinor, averageMinor };
}

export function parseModelPriceTrends(value: unknown): ModelPriceTrends {
  const row = adminRecord(value);
  if (
    typeof row.model_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.model_id) ||
    row.market !== "FI" ||
    row.currency !== "EUR" ||
    row.timezone !== "Europe/Helsinki" ||
    !dashboardPeriods.includes(row.days as DashboardPeriod) ||
    !Array.isArray(row.buckets)
  )
    throw new Error("Invalid model price trends");
  const days = row.days as DashboardPeriod;
  const startDate = dashboardDate(row.start_date),
    endDate = dashboardDate(row.end_date);
  const previousStartDate = dashboardDate(row.previous_start_date),
    previousEndDate = dashboardDate(row.previous_end_date);
  const offset = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 86400000;
  if (
    row.buckets.length !== days ||
    offset(endDate, startDate) !== days - 1 ||
    offset(startDate, previousStartDate) !== days ||
    offset(startDate, previousEndDate) !== 1
  )
    throw new Error("Invalid price period");
  const buckets = row.buckets.map((value, index) => {
    const item = adminRecord(value),
      day = dashboardDate(item.day);
    if (offset(day, startDate) !== index) throw new Error("Invalid price bucket order");
    return { day, ...sample(item) };
  });
  const current = sample(row.current),
    previous = sample(row.previous);
  if (
    adminCount(buckets.reduce((sum, b) => sum + b.salesCount, 0)) !== current.salesCount ||
    adminCount(buckets.reduce((sum, b) => sum + b.valueMinor, 0)) !== current.valueMinor
  )
    throw new Error("Inconsistent period total");
  const changeMinor =
    current.averageMinor === null || previous.averageMinor === null
      ? null
      : current.averageMinor - previous.averageMinor;
  const changePercent =
    changeMinor === null || !previous.averageMinor ? null : (changeMinor / previous.averageMinor) * 100;
  return {
    modelId: row.model_id,
    days,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    generatedAt: adminTimestamp(row.generated_at),
    current,
    previous,
    changeMinor,
    changePercent,
    buckets,
  };
}

export async function getModelPriceTrends(modelId: string, days: DashboardPeriod): Promise<ModelPriceTrends> {
  adminUuid(modelId);
  if (!dashboardPeriods.includes(days)) throw new Error("Invalid model price query");
  const result = parseModelPriceTrends(
    await adminRpc("get_admin_model_price_trends", { p_model_id: modelId, p_days: days }),
  );
  if (result.modelId !== modelId || result.days !== days) throw new Error("Unexpected model price scope");
  return result;
}
