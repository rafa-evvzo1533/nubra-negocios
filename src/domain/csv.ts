/** Quote every field and neutralize spreadsheet formulas in untrusted text. */
export function encodeCsv(rows: ReadonlyArray<Record<string, unknown>>) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  function cell(value: unknown) {
    let text = value instanceof Date ? value.toISOString() : String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n');
}
