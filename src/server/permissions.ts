import type { SessionContext } from "./tenant";
export type Resource =
  "customers" | "products" | "sales" | "inventory" | "quotes";
export function can(
  role: SessionContext["role"],
  resource: Resource | "fiscal",
  write = false,
  permissions?: string[],
) {
  if (role === "CUSTOM")
    return !!permissions?.includes(`${resource}.${write ? "write" : "read"}`);
  if (["OWNER", "ADMINISTRATOR", "ADMIN", "MANAGER"].includes(role))
    return true;
  if (role === "VIEWER") return !write;
  if (role === "CASHIER")
    return write
      ? resource === "sales"
      : ["sales", "customers", "products"].includes(resource);
  if (role === "SALES")
    return (
      !write ||
      resource === "customers" ||
      resource === "sales" ||
      resource === "quotes"
    );
  if (role === "SUPPORT") return !write && resource === "customers";
  if (role === "OPERATIONS" || role === "INVENTORY")
    return resource === "products" || resource === "inventory";
  if (role === "FINANCE")
    return (
      !write &&
      (resource === "sales" || resource === "quotes" || resource === "fiscal")
    );
  return false;
}
