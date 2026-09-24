import { postgres, ensureFoundationSchema } from "@/server/postgres";
export async function GET() {
  try {
    await ensureFoundationSchema();
    await postgres.query("SELECT 1");
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
