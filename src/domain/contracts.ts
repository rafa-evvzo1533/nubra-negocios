export type OrganizationId = string;

export type ProductSource = "MANUAL" | "NUBRA_STORE" | "API" | "IMPORT";

export type RoleName =
  | "OWNER"
  | "ADMINISTRATOR"
  | "MANAGER"
  | "SALES"
  | "SUPPORT"
  | "OPERATIONS"
  | "FINANCE"
  | "CUSTOM";

export interface OrganizationScoped {
  id: string;
  organizationId: OrganizationId;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  organizationId: OrganizationId;
  salesToday: number;
  salesThisMonth: number;
  activeCustomers: number;
  openOrders: number;
  lowStockProducts: number;
}

export interface IntegrationConnection extends OrganizationScoped {
  provider: "NUBRA_STORE" | "NUBRA_BASE" | "MERCADO_PAGO" | "GOOGLE_CALENDAR";
  status: "PENDING" | "CONNECTED" | "PAUSED" | "REVOKED";
  externalAccountId?: string;
  lastSyncAt?: string;
}

export interface WebhookEvent extends OrganizationScoped {
  eventType:
    | "customer.created"
    | "customer.updated"
    | "sale.created"
    | "order.created"
    | "order.updated"
    | "product.updated"
    | "inventory.low"
    | "quote.accepted"
    | "payment.received";
  idempotencyKey: string;
  signature: string;
  payload: Record<string, unknown>;
}