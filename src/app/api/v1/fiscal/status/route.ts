import { NextResponse } from "next/server";
import { getUserSession } from "@/server/auth";
import { ArcaWsfev1Provider } from "@/server/fiscal";
import { can } from "@/server/permissions";

export const runtime = "nodejs";

export async function GET() {
  const session = await getUserSession();
  if (!session)
    return NextResponse.json({ error: "Iniciá sesión" }, { status: 401 });
  if (!can(session.role, "fiscal"))
    return NextResponse.json(
      { error: "Permisos insuficientes" },
      { status: 403 },
    );
  const provider = new ArcaWsfev1Provider("HOMOLOGATION");
  return NextResponse.json({
    organizationId: session.organizationId,
    provider: provider.getCapabilities(),
    configured: false,
    message:
      "Configuración fiscal pendiente de certificados y asociación ARCA.",
  });
}
