export function readReceiptText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  let total = "";
  let reference = "";
  let soldOn = "";
  for (const line of lines) {
    if (
      /\btotal\b/i.test(line) &&
      !/sub\s*total|iva|impuesto|descuento/i.test(line)
    ) {
      const amounts = line.match(/\d[\d.,]*[.,]\d{2}(?!\d)/g);
      const raw = amounts?.at(-1);
      if (raw) {
        const comma = raw.lastIndexOf(","),
          dot = raw.lastIndexOf(".");
        const decimal = Math.max(comma, dot);
        const normalized =
          raw.slice(0, decimal).replace(/[.,]/g, "") +
          "." +
          raw.slice(decimal + 1);
        if (Number(normalized) > 0) total = normalized;
      }
    }
    if (
      !reference &&
      /(factura|ticket|comprobante|boleta|nro|número|numero)/i.test(line)
    ) {
      const match = line.match(/\b\d{3,5}\s*[-–]\s*\d{4,12}\b/);
      if (match) reference = match[0].replace(/\s/g, "");
    }
    if (!soldOn) {
      const match = line.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
      if (match) soldOn = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }
  return { total, reference, soldOn };
}
