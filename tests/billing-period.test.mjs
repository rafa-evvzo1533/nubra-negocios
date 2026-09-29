import { test } from "node:test";
import assert from "node:assert/strict";
import { periodEnd } from "../src/domain/billing-period.ts";
test("monthly subscriptions clamp month-end without losing the UTC time", () => {
  assert.equal(
    periodEnd(new Date("2027-01-31T12:34:56Z"), "MONTHLY").toISOString(),
    "2027-02-28T12:34:56.000Z",
  );
  assert.equal(
    periodEnd(new Date("2028-01-31T12:34:56Z"), "MONTHLY").toISOString(),
    "2028-02-29T12:34:56.000Z",
  );
});
test("annual subscriptions clamp leap day and retain twelve calendar months", () => {
  assert.equal(
    periodEnd(new Date("2028-02-29T12:00:00Z"), "YEARLY").toISOString(),
    "2029-02-28T12:00:00.000Z",
  );
  assert.equal(
    periodEnd(new Date("2026-09-29T12:00:00Z"), "YEARLY").toISOString(),
    "2027-09-29T12:00:00.000Z",
  );
});
test("orders created before migration retain the promised thirty days", () => {
  assert.equal(
    periodEnd(new Date("2027-01-31T00:00:00Z"), "LEGACY_30_DAYS").toISOString(),
    "2027-03-02T00:00:00.000Z",
  );
});
