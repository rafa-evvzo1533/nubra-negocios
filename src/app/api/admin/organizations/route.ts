import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { organizationInputSchema } from "@/server/validation/organization";
import { ensureFoundationSchema, postgres } from "@/server/postgres";
import { hashPassword, hasAdminSession, getStaffSession } from "@/server/auth";
import { setSubscription } from "@/server/subscriptions";

export const runtime = "nodejs";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { error: "Credenciales de administración inválidas" },
      { status: 401 },
    );
  }

  try {
    await ensureFoundationSchema();
    const result = await postgres.query(
      `SELECT o.id,o.name,o.tax_id AS "taxId",o.email,o.timezone,o.currency,o.active,o.created_at AS "createdAt",(SELECT COUNT(*)::int FROM organization_members m WHERE m.organization_id=o.id) AS "memberCount" FROM organizations o ORDER BY o.created_at DESC`,
    );
    return NextResponse.json({ organizations: result.rows });
  } catch (error) {
    console.error("organization.list failed", {
      code: (error as { code?: string }).code,
    });
    return NextResponse.json(
      { error: "No se pudieron consultar las organizaciones" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { error: "Credenciales de administración inválidas" },
      { status: 401 },
    );
  }

  const parsed = organizationInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos de organización inválidos",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    await ensureFoundationSchema();
    const id = randomUUID();
    const {
      name,
      taxId,
      email,
      timezone,
      currency,
      ownerName,
      ownerEmail,
      ownerPassword,
    } = parsed.data;
    const ownerId = randomUUID();
    const passwordHash = await hashPassword(ownerPassword);
    const client = await postgres.connect();
    let organization: Record<string, unknown>;
    try {
      await client.query("BEGIN");
      const actor = await getStaffSession();
      if (!actor) throw new Error("Session expired");
      const inserted = await client.query(
        `INSERT INTO organizations (id, name, tax_id, email, timezone, currency) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, tax_id AS "taxId", email, timezone, currency, created_at AS "createdAt"`,
        [id, name, taxId ?? null, email ?? null, timezone, currency],
      );
      organization = inserted.rows[0];
      await client.query(
        `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
        [ownerId, ownerEmail.toLowerCase(), ownerName, passwordHash],
      );
      await client.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, 'OWNER')`,
        [randomUUID(), id, ownerId],
      );
      await setSubscription(
        client,
        id,
        "FREE",
        "MANUAL_GRANT",
        actor.id,
        "Creación administrativa",
      );
      await client.query(
        "INSERT INTO platform_audit_logs(id,staff_id,organization_id,action,resource_id) VALUES($1,$2,$3,'organization.created',$3)",
        [randomUUID(), actor.id, id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json(
      { organization, owner: { name: ownerName, email: ownerEmail } },
      { status: 201 },
    );
  } catch (error) {
    console.error("organization.create failed", {
      code: (error as { code?: string }).code,
    });
    return NextResponse.json(
      {
        error:
          (error as { code?: string }).code === "23505"
            ? "Ese email ya pertenece a una cuenta. Usá otro propietario o vinculá la cuenta desde Usuarios y roles."
            : "No se pudo crear la organización",
      },
      { status: (error as { code?: string }).code === "23505" ? 409 : 500 },
    );
  }
}
