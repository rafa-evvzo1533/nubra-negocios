export type BillingPeriod = "MONTHLY" | "YEARLY";
export function periodEnd(
  start: Date,
  period: BillingPeriod | "LEGACY_30_DAYS",
) {
  if (period === "LEGACY_30_DAYS")
    return new Date(start.getTime() + 30 * 86400000);
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (period === "YEARLY" ? 12 : 1));
  const lastDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}
