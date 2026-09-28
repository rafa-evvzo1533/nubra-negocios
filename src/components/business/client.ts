export type Row = {
  id: string;
  source?: string;
  source_reference?: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
  next_contact?: string | null;
  sku?: string;
  price_cents?: number;
  cost_cents?: number;
  category?: string;
  unit?: string;
  supplier_id?: string | null;
  minimum_stock?: number;
  stock?: number;
  quantity?: number;
  reason?: string;
  product_id?: string;
  product_name?: string;
  customer_name?: string;
  customer_id?: string | null;
  total_cents?: string;
  created_at: string;
  valid_until?: string | null;
  sale_id?: string | null;
  items?: Row[];
};
export type PageData = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
};
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    cache: "no-store",
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la operación");
  return data;
}
export function send<T>(path: string, body: unknown, method = "POST") {
  return api<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export const money = (value: number | string, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(
    Number(value) / 100,
  );
export const date = (value: string) =>
  new Date(value).toLocaleDateString("es-AR", { timeZone: "UTC" });
export const statusLabels: Record<string, string> = {
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  LEAD: "Potencial",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  CONVERTED: "Convertido",
};
