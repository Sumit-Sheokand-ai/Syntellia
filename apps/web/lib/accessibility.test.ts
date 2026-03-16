import assert from "node:assert/strict";
import test from "node:test";
import { formatDateTimeForLocale, shouldReduceMotion } from "./accessibility";

test("shouldReduceMotion returns true only for reduce preference", () => {
  assert.equal(shouldReduceMotion("reduce"), true);
  assert.equal(shouldReduceMotion("REDUCE"), true);
  assert.equal(shouldReduceMotion("no-preference"), false);
  assert.equal(shouldReduceMotion(undefined), false);
});

test("formatDateTimeForLocale returns original input for invalid dates", () => {
  assert.equal(formatDateTimeForLocale("not-a-date", "en-US"), "not-a-date");
});

test("formatDateTimeForLocale uses locale and falls back when locale is invalid", () => {
  const value = "2026-03-15T00:00:00.000Z";
  assert.equal(formatDateTimeForLocale(value, "en-US"), new Date(value).toLocaleString("en-US"));
  assert.equal(formatDateTimeForLocale(value, "invalid_locale_tag"), new Date(value).toLocaleString());
});
