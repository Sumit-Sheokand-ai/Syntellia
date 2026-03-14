const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { __testables } = require("./processor");

test("evaluateSecurityHeaders marks missing and weak values", () => {
  const result = __testables.evaluateSecurityHeaders({
    "content-security-policy": "default-src * 'unsafe-inline'",
    "x-frame-options": "ALLOWALL",
    "x-content-type-options": "none"
  });

  assert.ok(result.missing.some((entry) => entry.key === "strict-transport-security"));
  assert.ok(result.missing.some((entry) => entry.key === "referrer-policy"));
  assert.ok(result.weak.some((entry) => entry.key === "content-security-policy"));
  assert.ok(result.weak.some((entry) => entry.key === "x-frame-options"));
  assert.ok(result.weak.some((entry) => entry.key === "x-content-type-options"));
});

test("analyzeSetCookieHeaders computes hardening rates", () => {
  const summary = __testables.analyzeSetCookieHeaders([
    "session=abc; Path=/; Secure; HttpOnly; SameSite=Lax",
    "prefs=123; Path=/; SameSite=None",
    "theme=dark; Path=/"
  ]);

  assert.equal(summary.totalSetCookie, 3);
  assert.equal(summary.secureRate, 33);
  assert.equal(summary.httpOnlyRate, 33);
  assert.equal(summary.sameSiteRate, 67);
  assert.ok(summary.issues.some((issue) => issue.includes("Secure")));
  assert.ok(summary.issues.some((issue) => issue.includes("HttpOnly")));
});

test("assessLinkAndFormHardening detects unsafe targets and insecure http actions", () => {
  const $ = cheerio.load(`
    <main>
      <a href="https://example.com" target="_blank">External</a>
      <a href="http://insecure.example" target="_blank" rel="nofollow">Insecure external</a>
      <a href="/relative">Relative</a>
      <form action="http://insecure.example/submit"><input type="text" /></form>
    </main>
  `);

  const result = __testables.assessLinkAndFormHardening($, "https://site.test/page");
  assert.equal(result.targetBlankCount, 2);
  assert.equal(result.unsafeTargetBlankCount, 2);
  assert.equal(result.insecureLinkCount, 1);
  assert.equal(result.insecureFormActionCount, 1);
});
test("assessScriptSurface detects mixed content and missing SRI for external scripts", () => {
  const $ = cheerio.load(`
    <main>
      <script>window.inline=true;</script>
      <script src="https://cdn.example.com/lib.js"></script>
      <script src="http://cdn.insecure.com/insecure.js"></script>
      <script src="/assets/local.js"></script>
      <img src="http://images.insecure.com/hero.png" />
    </main>
  `);

  const result = __testables.assessScriptSurface($, "https://site.test/page", "https:");
  assert.equal(result.externalScriptCount, 2);
  assert.equal(result.externalScriptHostCount, 2);
  assert.equal(result.scriptsWithoutSriCount, 2);
  assert.equal(result.inlineScriptCount, 1);
  assert.equal(result.mixedContentCount, 2);
});

test("assessCorsPolicy flags wildcard origin with credentials", () => {
  const result = __testables.assessCorsPolicy({
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true"
  });

  assert.equal(result.allowOrigin, "*");
  assert.equal(result.allowsCredentials, true);
  assert.equal(result.issues.length, 2);
});

test("assessCachePolicy flags sensitive pages without no-store controls", () => {
  const result = __testables.assessCachePolicy({}, true);
  assert.equal(result.cacheControl, "not-set");
  assert.ok(result.issues.some((issue) => issue.includes("Sensitive form page")));
  assert.ok(result.issues.some((issue) => issue.includes("Cache-Control header is not present")));
});

test("assessAuthSurface identifies password flows without CSRF indicators", () => {
  const $ = cheerio.load(`
    <form action="/login">
      <input type="email" name="email" />
      <input type="password" name="password" autocomplete="off" />
    </form>
  `);

  const result = __testables.assessAuthSurface($);
  assert.equal(result.hasPasswordFlow, true);
  assert.equal(result.passwordFormCount, 1);
  assert.equal(result.csrfSignalCount, 0);
  assert.equal(result.passwordAutocompleteOffCount, 1);
  assert.ok(result.issues.some((issue) => issue.includes("CSRF")));
  assert.ok(result.issues.some((issue) => issue.includes("autocomplete=off")));
});

test("computeSecurityPostureScore penalizes missing coverage and weak hardening", () => {
  const score = __testables.computeSecurityPostureScore({
    securityTechnical: {
      transport: {
        httpsCoverage: 40
      },
      headers: {
        missing: [
          { key: "content-security-policy", impact: "high" },
          { key: "strict-transport-security", impact: "high" },
          { key: "referrer-policy", impact: "medium" }
        ],
        weak: [{ key: "x-frame-options", issue: "bad value" }]
      },
      linksAndForms: {
        unsafeTargetBlankCount: 3,
        insecureFormActionCount: 1,
        insecureLinkCount: 2
      },
      scriptSurface: {
        mixedContentCount: 2,
        scriptsWithoutSriCount: 3
      },
      cors: {
        riskyPageCount: 2
      },
      authSurface: {
        passwordFlowMissingCsrfCount: 1
      }
    }
  });

  assert.ok(score < 80);
  assert.ok(score >= 35);
});
