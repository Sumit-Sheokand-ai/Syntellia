import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE, getLocaleDirection, resolveLocale, translate } from "./i18n";

test("resolveLocale returns Spanish for es* values", () => {
  assert.equal(resolveLocale("es"), "es");
  assert.equal(resolveLocale("es-MX"), "es");
});
test("resolveLocale returns Arabic for ar* values", () => {
  assert.equal(resolveLocale("ar"), "ar");
  assert.equal(resolveLocale("ar-EG"), "ar");
});

test("resolveLocale falls back to default locale", () => {
  assert.equal(resolveLocale("fr-FR"), DEFAULT_LOCALE);
  assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
  assert.equal(resolveLocale(null), DEFAULT_LOCALE);
});
test("getLocaleDirection returns rtl for Arabic and ltr otherwise", () => {
  assert.equal(getLocaleDirection("ar"), "rtl");
  assert.equal(getLocaleDirection("es"), "ltr");
  assert.equal(getLocaleDirection("en"), "ltr");
});

test("translate returns localized copy and falls back to english key set", () => {
  assert.equal(translate("es", "nav.dashboard"), "Panel");
  assert.equal(translate("en", "auth.signIn"), "Sign in");
  assert.equal(translate("ar", "scan.status.completed"), "مكتمل");
});

test("translate interpolates variables in localized templates", () => {
  assert.equal(
    translate("es", "scan.history.alerts.completed", { count: 4 }),
    "Completados desde la última visita: 4"
  );
  assert.equal(
    translate("ar", "dashboard.snapshot.plan", { value: "enterprise" }),
    "الخطة: enterprise"
  );
});
