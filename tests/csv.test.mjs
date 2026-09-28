import test from "node:test";
import assert from "node:assert/strict";
import { encodeCsv } from "../src/domain/csv.ts";
test("spreadsheet formulas from customer data remain literal text", () => {
  for (const value of [
    "=1+2",
    "+SUM(A1)",
    "-1+2",
    "@SUM(A1)",
    '  =HYPERLINK("https://example.invalid")',
    "\t=1",
    "\r=1",
  ]) {
    const csv = encodeCsv([{ name: value }]);
    assert(csv.startsWith('"name"\r\n"\''));
  }
});
test("quotes, delimiters, newlines and negative numeric stock deltas survive export", () => {
  assert.equal(
    encodeCsv([
      { name: 'Producto, "A"\nSegunda línea', quantity: -3, note: null },
    ]),
    '"name","quantity","note"\r\n"Producto, ""A""\nSegunda línea","-3",""',
  );
});
test("column order is stable across differently ordered records and dates are UTC", () => {
  assert.equal(
    encodeCsv([
      { name: "A", date: new Date("2026-09-24T00:00:00Z") },
      { date: null, name: "B" },
    ]),
    '"name","date"\r\n"A","2026-09-24T00:00:00.000Z"\r\n"B",""',
  );
  assert.equal(encodeCsv([]), "");
});
