import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { postgres } from "./postgres";
import { getUserSession } from "./auth";
import { can, type Resource } from "./permissions";
import { HttpError } from "./http";
import { requirePermission } from "./rbac";
import { enforceCapacity, hasFeature } from "./subscriptions";
import {
  transaction,
  audit,
  recordSale,
  type PricedItem,
} from "./transactions";

const name = z.string().trim().min(1).max(120);
export const optionalDate = z
  .union([z.iso.date(), z.literal("")])
  .nullable()
  .optional();
const customer = z
  .object({
    name,
    email: z.union([z.email(), z.literal("")]).default(""),
    phone: z.string().max(40).default(""),
    notes: z.string().max(5000).default(""),
    status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("ACTIVE"),
    nextContact: optionalDate,
  })
  .strict();
const product = z
  .object({
    name,
    sku: z.string().trim().min(1).max(80),
    priceCents: z.number().int().min(0).max(100000000),
    minimumStock: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();
const movement = z
  .object({
    productId: z.uuid(),
    quantity: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0),
    reason: z.string().trim().min(1).max(240),
  })
  .strict();
export const saleInput = z
  .object({
    customerId: z.uuid().optional(),
    idempotencyKey: z.uuid().optional(),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(1000000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const resources = z.enum([
  "customers",
  "products",
  "sales",
  "inventory",
  "quotes",
]);
export async function authorize(resource: Resource, write = false) {
  const session = await getUserSession();
  if (!session) throw new HttpError(401, "Iniciá sesión");
  if (!can(session.role, resource, write, session.permissions))
    throw new HttpError(403, "Permisos insuficientes");
  await requirePermission(session, `${resource}.${write ? "write" : "read"}`);
  if (!(await hasFeature(session, "core_business")))
    throw new HttpError(403, "Tu suscripción no habilita esta función");
  return session;
}
const tables = {
  customers: "customers",
  products: "products",
  sales: "sales",
  inventory: "inventory_movements",
  quotes: "quotes",
} as const;
const queryInput = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  paginated: z.enum(["0", "1"]).default("0"),
  filter: z
    .enum([
      "all",
      "low",
      "in",
      "out",
      "LEAD",
      "ACTIVE",
      "INACTIVE",
      "due",
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
      "CONVERTED",
    ])
    .default("all"),
});
export async function list(
  resource: Resource,
  id?: string,
  params?: URLSearchParams,
) {
  const ctx = await authorize(resource);
  if (id) z.uuid().parse(id);
  const opts = queryInput.parse(Object.fromEntries(params ?? []));
  const values: unknown[] = [ctx.organizationId];
  const where = ["r.organization_id=$1"];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (id) where.push(`r.id=${add(id)}`);
  let joins = "";
  let columns = "r.*";
  if (resource === "inventory") {
    joins =
      "JOIN products p ON p.organization_id=r.organization_id AND p.id=r.product_id";
    columns += ", p.name AS product_name";
  }
  if (resource === "sales" || resource === "quotes") {
    joins =
      "LEFT JOIN customers c ON c.organization_id=r.organization_id AND c.id=r.customer_id";
    columns += ", c.name AS customer_name";
  }
  if (resource === "customers")
    columns += ", to_char(r.next_contact,'YYYY-MM-DD') AS next_contact";
  if (resource === "quotes")
    columns += ", to_char(r.valid_until,'YYYY-MM-DD') AS valid_until";
  const searchable = {
    customers: "concat_ws(' ',r.name,r.email,r.phone)",
    products: "concat_ws(' ',r.name,r.sku)",
    sales: "concat_ws(' ',r.id::text,c.name)",
    inventory: "concat_ws(' ',p.name,r.reason)",
    quotes: "concat_ws(' ',r.id::text,c.name,r.notes)",
  };
  if (opts.q)
    where.push(
      `strpos(lower(${searchable[resource]}), lower(${add(opts.q)})) > 0`,
    );
  if (opts.filter !== "all") {
    if (resource === "products" && opts.filter === "low")
      where.push("r.stock<=r.minimum_stock");
    else if (resource === "inventory" && ["in", "out"].includes(opts.filter))
      where.push(opts.filter === "in" ? "r.quantity>0" : "r.quantity<0");
    else if (
      resource === "customers" &&
      ["LEAD", "ACTIVE", "INACTIVE"].includes(opts.filter)
    )
      where.push(`r.status=${add(opts.filter)}`);
    else if (resource === "customers" && opts.filter === "due")
      where.push(
        "r.next_contact <= (SELECT (NOW() AT TIME ZONE timezone)::date FROM organizations WHERE id=$1)",
      );
    else if (
      resource === "quotes" &&
      ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CONVERTED"].includes(
        opts.filter,
      )
    )
      where.push(`r.status=${add(opts.filter)}`);
    else throw new HttpError(400, "Filtro no disponible");
  }
  const from = `FROM ${tables[resource]} r ${joins} WHERE ${where.join(" AND ")}`;
  const total =
    !id && opts.paginated === "1"
      ? Number(
          (await postgres.query(`SELECT COUNT(*) AS total ${from}`, values))
            .rows[0].total,
        )
      : 0;
  const limit = opts.paginated === "1" ? opts.pageSize : 100;
  const result = await postgres.query(
    `SELECT ${columns} ${from} ORDER BY r.created_at DESC,r.id LIMIT ${add(limit)} OFFSET ${add(id ? 0 : (opts.page - 1) * limit)}`,
    values,
  );
  if (id && !result.rows.length)
    throw new HttpError(404, "Recurso no encontrado");
  if (id && (resource === "quotes" || resource === "sales")) {
    const itemTable = resource === "quotes" ? "quote_items" : "sale_items";
    const key = resource === "quotes" ? "quote_id" : "sale_id";
    const itemName = resource === "quotes" ? "i.product_name" : "p.name";
    const items = await postgres.query(
      `SELECT i.*, ${itemName} AS product_name FROM ${itemTable} i JOIN products p ON p.organization_id=i.organization_id AND p.id=i.product_id WHERE i.organization_id=$1 AND i.${key}=$2 ORDER BY i.id`,
      [ctx.organizationId, id],
    );
    return { ...result.rows[0], items: items.rows };
  }
  return id
    ? result.rows[0]
    : opts.paginated === "1"
      ? { items: result.rows, total, page: opts.page, pageSize: opts.pageSize }
      : result.rows;
}
export async function mutate(
  resource: Resource,
  body: unknown,
  id?: string,
  remove = false,
) {
  const ctx = await authorize(resource, true);
  if (id) z.uuid().parse(id);
  if (
    resource === "quotes" ||
    (id && resource !== "customers" && resource !== "products")
  )
    throw new HttpError(405, "Operación no permitida");
  const entityId = id ?? randomUUID();
  return transaction(async (db) => {
    if (!id && (resource === "customers" || resource === "products"))
      await enforceCapacity(db, ctx, resource);
    if (id) {
      const found = await db.query(
        `SELECT id FROM ${tables[resource]} WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [ctx.organizationId, id],
      );
      if (!found.rows.length) throw new HttpError(404, "Recurso no encontrado");
    }
    if (remove) {
      await db.query(
        `DELETE FROM ${tables[resource]} WHERE organization_id=$1 AND id=$2`,
        [ctx.organizationId, id],
      );
    } else if (resource === "customers") {
      const v = customer.parse(body);
      await db.query(
        id
          ? "UPDATE customers SET name=$3,email=$4,phone=$5,notes=$6,status=$7,next_contact=$8 WHERE organization_id=$1 AND id=$2"
          : "INSERT INTO customers(organization_id,id,name,email,phone,notes,status,next_contact) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          ctx.organizationId,
          entityId,
          v.name,
          v.email,
          v.phone,
          v.notes,
          v.status,
          v.nextContact || null,
        ],
      );
    } else if (resource === "products") {
      const v = product.parse(body);
      await db.query(
        id
          ? "UPDATE products SET name=$3,sku=$4,price_cents=$5,minimum_stock=$6 WHERE organization_id=$1 AND id=$2"
          : "INSERT INTO products(organization_id,id,name,sku,price_cents,minimum_stock) VALUES($1,$2,$3,$4,$5,$6)",
        [
          ctx.organizationId,
          entityId,
          v.name,
          v.sku,
          v.priceCents,
          v.minimumStock,
        ],
      );
    } else if (resource === "inventory") {
      const v = movement.parse(body);
      const updated = await db.query(
        "UPDATE products SET stock=stock+$3 WHERE organization_id=$1 AND id=$2 AND stock+$3>=0 RETURNING id",
        [ctx.organizationId, v.productId, v.quantity],
      );
      if (!updated.rows.length)
        throw new HttpError(409, "Producto no disponible o stock insuficiente");
      await db.query(
        "INSERT INTO inventory_movements(id,organization_id,product_id,quantity,reason,previous_quantity,new_quantity,user_id) SELECT $1,$2,$3,$4,$5,stock-$4,stock,$6 FROM products WHERE organization_id=$2 AND id=$3",
        [
          entityId,
          ctx.organizationId,
          v.productId,
          v.quantity,
          v.reason,
          ctx.userId,
        ],
      );
    } else {
      const v = saleInput.extend({ idempotencyKey: z.uuid() }).parse(body);
      await db.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [
        ctx.organizationId,
      ]);
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify({ customerId: v.customerId ?? null, items: v.items }),
        )
        .digest("hex");
      const prior = (
        await db.query(
          "SELECT id,request_hash FROM sales WHERE organization_id=$1 AND idempotency_key=$2",
          [ctx.organizationId, v.idempotencyKey],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== requestHash)
          throw new HttpError(409, "La solicitud ya se usó con otros datos");
        return { id: prior.id };
      }
      if (v.customerId) {
        const found = await db.query(
          "SELECT id FROM customers WHERE organization_id=$1 AND id=$2 FOR KEY SHARE",
          [ctx.organizationId, v.customerId],
        );
        if (!found.rows.length)
          throw new HttpError(404, "Cliente no encontrado");
      }
      const quantities = new Map<string, number>();
      for (const item of v.items)
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity,
        );
      const items: PricedItem[] = [];
      for (const [productId, quantity] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const result = await db.query<{ price_cents: number }>(
          "SELECT price_cents FROM products WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [ctx.organizationId, productId],
        );
        if (!result.rows.length)
          throw new HttpError(
            409,
            "Producto no disponible o stock insuficiente",
          );
        items.push({ productId, quantity, price: result.rows[0].price_cents });
      }
      await recordSale(db, ctx, entityId, v.customerId ?? null, items);
      await db.query(
        "UPDATE sales SET idempotency_key=$3,request_hash=$4 WHERE organization_id=$1 AND id=$2",
        [ctx.organizationId, entityId, v.idempotencyKey, requestHash],
      );
    }
    await audit(
      db,
      ctx,
      `${resource}.${remove ? "deleted" : id ? "updated" : "created"}`,
      entityId,
      resource,
    );
    return { id: entityId };
  });
}
