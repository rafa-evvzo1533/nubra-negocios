// Loaded only by the isolated test server. Never imported by the application.
const original = globalThis.fetch;
if (
  !process.env.TEST_MP_URL ||
  !new URL(process.env.DATABASE_URL).pathname.startsWith("/nubra_test_")
)
  throw new Error("Isolated tests only");
globalThis.fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url.startsWith("https://api.mercadopago.com/"))
    return original(
      process.env.TEST_MP_URL + url.slice("https://api.mercadopago.com".length),
      init,
    );
  return original(input, init);
};
