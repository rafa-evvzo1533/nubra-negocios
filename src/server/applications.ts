import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAccountSession } from "./auth";
import { requireAdmin } from "./admin";
import { postgres } from "./postgres";
import { transaction } from "./transactions";
import { HttpError } from "./http";
import { planCode, setSubscription } from "./subscriptions";
import { legalDocuments } from "./legal";
const optionalText = (n: number) => z.string().trim().max(n).default("");
const web = z
  .union([
    z.literal(""),
    z.url().refine((s) => ["https:", "http:"].includes(new URL(s).protocol)),
  ])
  .default("");
export const businessDataSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: optionalText(160),
    taxId: optionalText(32),
    sector: z.string().trim().min(2).max(80),
    description: optionalText(2000),
    email: z.email().max(320),
    phone: optionalText(40),
    whatsapp: optionalText(40),
    address: optionalText(240),
    city: optionalText(100),
    province: optionalText(100),
    country: z.string().trim().min(2).max(80),
    postalCode: optionalText(20),
    website: web,
    instagram: optionalText(160),
    facebook: optionalText(160),
    tiktok: optionalText(160),
    employees: z.number().int().min(0).max(1000000).default(0),
    businessType: z.string().trim().min(2).max(80),
    physicalStore: z.boolean().default(false),
    ecommerce: z.boolean().default(false),
    branches: z.number().int().min(0).max(10000).default(1),
    responsibleName: z.string().trim().min(2).max(120),
    responsiblePhone: optionalText(40),
    referral: optionalText(200),
    notes: optionalText(2000),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .refine((v) => {
        try {
          return Intl.supportedValuesOf("currency").includes(v);
        } catch {
          return false;
        }
      })
      .default("ARS"),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("es", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      })
      .default("America/Argentina/Buenos_Aires"),
  })
  .strict();
export async function applicationStatus() {
  const account = await getAccountSession();
  if (!account) throw new HttpError(401, "Iniciá sesión");
  const application =
    (
      await postgres.query(
        "SELECT id,status,business_data,requested_plan,review_message,organization_id FROM organization_applications WHERE user_id=$1",
        [account.id],
      )
    ).rows[0] ?? null;
  return { account, application, documents: await legalDocuments() };
}
export async function saveApplication(body: unknown) {
  const account = await getAccountSession();
  if (!account) throw new HttpError(401, "Iniciá sesión");
  if (!account.email_verified_at)
    throw new HttpError(403, "Verificá tu email antes de presentar el negocio");
  const v = z
    .object({
      business: businessDataSchema,
      requestedPlan: planCode,
      submit: z.boolean(),
      legalVersionIds: z.array(z.uuid()).max(2).default([]),
    })
    .strict()
    .parse(body);
  return transaction(async (db) => {
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [account.id]);
    const prior = (
      await db.query(
        "SELECT id,status FROM organization_applications WHERE user_id=$1 FOR UPDATE",
        [account.id],
      )
    ).rows[0];
    if (prior && !["DRAFT", "NEEDS_INFORMATION"].includes(String(prior.status)))
      throw new HttpError(
        409,
        "La solicitud ya fue enviada y no se puede editar en este estado",
      );
    const versions = (
      await db.query<{ id: string }>(
        "SELECT id FROM legal_document_versions WHERE current FOR SHARE",
      )
    ).rows;
    if (
      v.submit &&
      (versions.length !== 2 ||
        !versions.every((d) => v.legalVersionIds.includes(d.id)))
    )
      throw new HttpError(
        400,
        "Aceptá las versiones vigentes de términos y privacidad",
      );
    const id = prior?.id ?? randomUUID();
    await db.query(
      `INSERT INTO organization_applications(id,user_id,business_data,requested_plan,status,submitted_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $5='PENDING' THEN NOW() END)
   ON CONFLICT(user_id) DO UPDATE SET business_data=EXCLUDED.business_data,requested_plan=EXCLUDED.requested_plan,status=EXCLUDED.status,submitted_at=EXCLUDED.submitted_at,updated_at=NOW()`,
      [
        id,
        account.id,
        JSON.stringify(v.business),
        v.requestedPlan,
        v.submit ? "PENDING" : "DRAFT",
      ],
    );
    if (v.submit)
      for (const version of versions)
        await db.query(
          "INSERT INTO legal_acceptances(version_id,user_id,application_id) VALUES($1,$2,$3) ON CONFLICT(version_id,user_id) DO NOTHING",
          [version.id, account.id, id],
        );
    await db.query(
      "INSERT INTO platform_audit_logs(id,user_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [
        randomUUID(),
        account.id,
        v.submit ? "application.submitted" : "application.saved",
        id,
      ],
    );
    return { id, status: v.submit ? "PENDING" : "DRAFT" };
  });
}
export async function reviewApplications() {
  const actor = await requireAdmin("read");
  return {
    actor: { role: actor.role, username: actor.username },
    applications: (
      await postgres.query(
        `SELECT a.id,a.status,a.business_data,a.requested_plan,a.review_message,a.created_at,a.organization_id,u.name,u.email FROM organization_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200`,
      )
    ).rows,
  };
}
export async function approveOrganizationApplication(id: string) {
  const actor = await requireAdmin("review");
  z.uuid().parse(id);
  return transaction(async (db) => {
    const app = (
      await db.query<{
        user_id: string;
        status: string;
        organization_id: string | null;
        business_data: z.infer<typeof businessDataSchema>;
      }>("SELECT * FROM organization_applications WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!app) throw new HttpError(404, "Solicitud no encontrada");
    if (app.status === "APPROVED") return { id: app.organization_id };
    if (!["PENDING", "UNDER_REVIEW"].includes(app.status))
      throw new HttpError(409, "La solicitud no admite aprobación");
    const verified = (
      await db.query(
        "SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL",
        [app.user_id],
      )
    ).rows.length;
    const missing = (
      await db.query(
        `SELECT v.id FROM legal_document_versions v WHERE v.current AND NOT EXISTS(SELECT 1 FROM legal_acceptances a WHERE a.version_id=v.id AND a.user_id=$1 AND a.application_id=$2)`,
        [app.user_id, id],
      )
    ).rows.length;
    if (!verified || missing)
      throw new HttpError(409, "Falta verificación o aceptación legal vigente");
    const organizationId = randomUUID(),
      v = businessDataSchema.parse(app.business_data);
    await db.query(
      "INSERT INTO organizations(id,name,tax_id,email,timezone,currency) VALUES($1,$2,$3,$4,$5,$6)",
      [
        organizationId,
        v.name,
        v.taxId || null,
        v.email,
        v.timezone,
        v.currency,
      ],
    );
    await db.query(
      "INSERT INTO organization_members(id,organization_id,user_id,role) VALUES($1,$2,$3,'OWNER')",
      [randomUUID(), organizationId, app.user_id],
    );
    await setSubscription(
      db,
      organizationId,
      "FREE",
      "FREE_REGISTRATION",
      actor.id,
      "Aprobación de solicitud pública",
    );
    await db.query(
      "UPDATE organization_applications SET status='APPROVED',organization_id=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$1",
      [id, organizationId, actor.id],
    );
    await db.query(
      "UPDATE legal_acceptances SET organization_id=$2 WHERE application_id=$1",
      [id, organizationId],
    );
    await db.query(
      "UPDATE sessions SET organization_id=$2 WHERE user_id=$1 AND kind='user' AND organization_id IS NULL",
      [app.user_id, organizationId],
    );
    await db.query(
      "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id) VALUES($1,$2,$3,'application.approved',$4)",
      [randomUUID(), actor.id, organizationId, id],
    );
    return { id: organizationId };
  });
}
async function review(id: string, status: string, message: string) {
  const actor = await requireAdmin("review");
  z.uuid().parse(id);
  z.string().trim().min(3).max(1000).parse(message);
  return transaction(async (db) => {
    const result = await db.query(
      `UPDATE organization_applications SET status=$2,review_message=$3,reviewed_by=$4,reviewed_at=NOW(),updated_at=NOW() WHERE id=$1 AND status IN ('PENDING','UNDER_REVIEW') RETURNING id`,
      [id, status, message, actor.id],
    );
    if (!result.rows.length)
      throw new HttpError(409, "La solicitud no admite esta transición");
    await db.query(
      "INSERT INTO platform_audit_logs(id,staff_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), actor.id, `application.${status.toLowerCase()}`, id],
    );
    return { id, status };
  });
}
export const rejectOrganizationApplication = (id: string, message: string) =>
  review(id, "REJECTED", message);
export const requestOrganizationInformation = (id: string, message: string) =>
  review(id, "NEEDS_INFORMATION", message);
export const startApplicationReview = (id: string, message: string) =>
  review(id, "UNDER_REVIEW", message);
export async function setOrganizationStatus(
  id: string,
  status: "APPROVED" | "SUSPENDED" | "BLOCKED",
  reason: string,
) {
  const actor = await requireAdmin("operations");
  z.uuid().parse(id);
  z.string().trim().min(3).max(1000).parse(reason);
  return transaction(async (db) => {
    const current = (
      await db.query(
        "SELECT status FROM organizations WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!current) throw new HttpError(404, "Empresa no encontrada");
    if (current.status === "BLOCKED" && actor.role !== "SUPER_ADMIN")
      throw new HttpError(
        403,
        "Solo Super Admin puede reactivar una empresa bloqueada",
      );
    await db.query(
      "UPDATE organizations SET status=$2,active=$3,updated_at=NOW() WHERE id=$1",
      [id, status, status === "APPROVED"],
    );
    await db.query(
      "UPDATE organization_applications SET status=$2,reviewed_by=$3,reviewed_at=NOW(),updated_at=NOW() WHERE organization_id=$1",
      [id, status, actor.id],
    );
    if (status !== "APPROVED")
      await db.query("DELETE FROM sessions WHERE organization_id=$1", [id]);
    await db.query(
      "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id,metadata) VALUES($1,$2,$3,$4,$3,$5)",
      [
        randomUUID(),
        actor.id,
        id,
        `organization.${status.toLowerCase()}`,
        JSON.stringify({ reason }),
      ],
    );
    return { id, status };
  });
}
export const suspendOrganization = (id: string, reason: string) =>
  setOrganizationStatus(id, "SUSPENDED", reason);
export const reactivateOrganization = (id: string, reason: string) =>
  setOrganizationStatus(id, "APPROVED", reason);
