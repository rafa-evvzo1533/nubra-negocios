import { AsyncLocalStorage } from "node:async_hooks";
export type DatabaseContext = {
  organizationId?: string;
  userId?: string;
  supportGrantId?: string;
  staffId?: string;
};
const storage = new AsyncLocalStorage<DatabaseContext>();
export const databaseContext = () => storage.getStore() ?? {};
export function requestContext<T>(action: () => T): T {
  return storage.run({}, action);
}
export function bindOrganization(ctx: {
  organizationId: string;
  userId: string;
}) {
  const current = storage.getStore();
  if (current) {
    current.organizationId = ctx.organizationId;
    current.userId = ctx.userId;
    delete current.supportGrantId;
  }
}
export function scopedContext<T>(context: DatabaseContext, action: () => T): T {
  return storage.run({ ...context }, action);
}
