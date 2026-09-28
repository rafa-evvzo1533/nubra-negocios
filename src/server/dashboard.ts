import { postgres } from "./postgres";
import { can } from "./permissions";
import type { UserSession } from "./auth";
export async function dashboard(ctx: UserSession) {
  const org = [ctx.organizationId];
  const sales = ctx.permissions?.includes("sales.analytics")
    ? (
        await postgres.query(
          `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_cents) FILTER(WHERE (sales.created_at AT TIME ZONE o.timezone)::date=(NOW() AT TIME ZONE o.timezone)::date),0)::text AS today, COALESCE(SUM(total_cents) FILTER(WHERE date_trunc('month',sales.created_at AT TIME ZONE o.timezone)=date_trunc('month',NOW() AT TIME ZONE o.timezone)),0)::text AS month FROM sales JOIN organizations o ON o.id=sales.organization_id WHERE sales.organization_id=$1 AND sales.status='CONFIRMED'`,
          org,
        )
      ).rows[0]
    : null;
  const customers = can(ctx.role, "customers", false, ctx.permissions)
    ? (
        await postgres.query(
          "SELECT COUNT(*)::int AS count FROM customers WHERE organization_id=$1",
          org,
        )
      ).rows[0].count
    : null;
  const products = can(ctx.role, "products", false, ctx.permissions)
    ? (
        await postgres.query(
          "SELECT COUNT(*)::int AS count, COUNT(*) FILTER(WHERE stock<=minimum_stock)::int AS low FROM products WHERE organization_id=$1",
          org,
        )
      ).rows[0]
    : null;
  const activity = ["OWNER", "ADMINISTRATOR", "MANAGER"].includes(ctx.role)
    ? (
        await postgres.query(
          "SELECT id,action,created_at FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 10",
          org,
        )
      ).rows.map((r) => ({
        id: String(r.id),
        action: String(r.action),
        date: new Date(r.created_at as string).toISOString(),
      }))
    : [];
  const trend = sales
    ? (
        await postgres.query<{ day: string; total: string }>(
          `
    WITH days AS (
      SELECT generate_series((NOW() AT TIME ZONE timezone)::date - 13,
        (NOW() AT TIME ZONE timezone)::date, INTERVAL '1 day')::date AS day, timezone
      FROM organizations WHERE id=$1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(SUM(s.total_cents),0)::text AS total
    FROM days d LEFT JOIN sales s ON s.organization_id=$1 AND s.status='CONFIRMED'
      AND (s.created_at AT TIME ZONE d.timezone)::date=d.day
    GROUP BY d.day ORDER BY d.day`,
          org,
        )
      ).rows
    : [];
  const lowProducts = products
    ? (
        await postgres.query<{
          id: string;
          name: string;
          stock: number;
          minimum_stock: number;
        }>(
          "SELECT id,name,stock,minimum_stock FROM products WHERE organization_id=$1 AND stock<=minimum_stock ORDER BY stock, name LIMIT 5",
          org,
        )
      ).rows
    : [];
  return {
    today: sales ? String(sales.today) : null,
    month: sales ? String(sales.month) : null,
    saleCount: sales ? Number(sales.count) : null,
    customers: customers === null ? null : Number(customers),
    products: products ? Number(products.count) : null,
    lowStock: products ? Number(products.low) : null,
    activity,
    trend,
    lowProducts,
  };
}
export type DashboardData = Awaited<ReturnType<typeof dashboard>>;
