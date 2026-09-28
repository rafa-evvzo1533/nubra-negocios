const sensitive =
  /password|hash|authorization|cookie|token|secret|api.?key|wrapped.?key|encrypted.?data.?key|private.?note|email|phone|address|image|body/i;
export function sanitizeLogPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (Array.isArray(value))
    return value.slice(0, 30).map((v) => sanitizeLogPayload(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([k, v]) => [
          k,
          sensitive.test(k) ? "[REDACTED]" : sanitizeLogPayload(v, depth + 1),
        ]),
    );
  if (typeof value === "string")
    return value
      .slice(0, 500)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
      .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  return value;
}
export function securityLog(event: string, payload: unknown = {}) {
  console.info(
    JSON.stringify({
      event,
      time: new Date().toISOString(),
      payload: sanitizeLogPayload(payload),
    }),
  );
}
