export type SessionContext = {
  userId: string;
  organizationId: string;
  permissions?: string[];
  role:
    | "OWNER"
    | "ADMINISTRATOR"
    | "ADMIN"
    | "MANAGER"
    | "SALES"
    | "SUPPORT"
    | "OPERATIONS"
    | "FINANCE"
    | "CASHIER"
    | "INVENTORY"
    | "VIEWER"
    | "CUSTOM";
};

export function requireOrganizationContext(
  context: SessionContext | null,
): SessionContext {
  if (!context?.userId || !context.organizationId) {
    throw new Error("Authenticated organization context is required");
  }

  return context;
}
