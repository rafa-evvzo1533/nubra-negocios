import { endpoint, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { organizationInputSchema } from "@/server/validation/organization";
import { transaction } from "@/server/transactions";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const actor = await requireAdmin();
    const id = z.uuid().parse((await params).id);
    const v = organizationInputSchema
      .omit({ ownerName: true, ownerEmail: true, ownerPassword: true })
      .extend({ active: z.boolean() })
      .strict()
      .parse(await request.json());
    return transaction(async (db) => {
      const current = (
        await db.query(
          "SELECT currency FROM organizations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!current) throw new HttpError(404, "Empresa no encontrada");
      if (
        current.currency !== v.currency &&
        (
          await db.query(
            "SELECT id FROM sales WHERE organization_id=$1 UNION ALL SELECT id FROM products WHERE organization_id=$1 UNION ALL SELECT id FROM quotes WHERE organization_id=$1 LIMIT 1",
            [id],
          )
        ).rows.length
      )
        throw new HttpError(
          409,
          "No se puede cambiar la moneda de una empresa con productos o documentos",
        );
      await db.query(
        "UPDATE organizations SET name=$2,tax_id=$3,email=$4,timezone=$5,currency=$6,active=$7,updated_at=NOW() WHERE id=$1",
        [
          id,
          v.name,
          v.taxId ?? null,
          v.email ?? null,
          v.timezone,
          v.currency,
          v.active,
        ],
      );
      if (!v.active)
        await db.query("DELETE FROM sessions WHERE organization_id=$1", [id]);
      await db.query(
        "UPDATE organizations SET status=CASE WHEN $2 THEN 'APPROVED' ELSE 'SUSPENDED' END WHERE id=$1",
        [id, v.active],
      );
      await db.query(
        "UPDATE organization_applications SET status=CASE WHEN $2 THEN 'APPROVED' ELSE 'SUSPENDED' END WHERE organization_id=$1",
        [id, v.active],
      );
      await db.query(
        "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id) VALUES($1,$2,$3,'organization.updated',$3)",
        [randomUUID(), actor.id, id],
      );
      await db.query(
        "INSERT INTO audit_logs(id,organization_id,action,entity_type,entity_id) VALUES($1,$2,'organizations.updated','organizations',$2)",
        [randomUUID(), id],
      );
      return { id };
    });
  });
}
