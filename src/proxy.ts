import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  ) {
    if (
      request.headers.get("content-type") &&
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return NextResponse.json({ error: "Se requiere JSON" }, { status: 415 });
    const origin = request.headers.get("origin");
    if (
      (origin && origin !== request.nextUrl.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return NextResponse.json(
        { error: "Origen no permitido" },
        { status: 403 },
      );
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (request.nextUrl.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ocr/).*)"],
};
