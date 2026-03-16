const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ValidationError,
  validateCreateScanPayload,
  validateSavedHistoryViewPayload
} = require("./validation");

test("validateCreateScanPayload applies defaults when optional fields are absent", () => {
  const payload = validateCreateScanPayload({ url: "https://example.com" });

  assert.equal(payload.url, "https://example.com/");
  assert.equal(payload.scanSize, "Standard review");
  assert.equal(payload.loginMode, "No login needed");
  assert.equal(payload.focusArea, "Overall feel");
  assert.equal(payload.projectName, "General");
});

test("validateCreateScanPayload rejects missing url", () => {
  assert.throws(
    () => validateCreateScanPayload({ scanSize: "Quick check" }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_URL_REQUIRED"
  );
});

test("validateCreateScanPayload rejects project names longer than 64 characters", () => {
  assert.throws(
    () =>
      validateCreateScanPayload({
        url: "https://example.com",
        projectName: "A".repeat(65)
      }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_PROJECT_NAME"
  );
});

test("validateCreateScanPayload rejects unsupported enum values", () => {
  assert.throws(
    () =>
      validateCreateScanPayload({
        url: "https://example.com",
        focusArea: "Everything"
      }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_FOCUS_AREA"
  );
});

test("validateCreateScanPayload rejects localhost/private destinations", () => {
  assert.throws(
    () =>
      validateCreateScanPayload({
        url: "http://127.0.0.1/admin"
      }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_URL_UNSAFE_DESTINATION"
  );
});

test("validateCreateScanPayload rejects URLs with embedded credentials", () => {
  assert.throws(
    () =>
      validateCreateScanPayload({
        url: "https://user:pass@example.com"
      }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_URL_CREDENTIALS"
  );
});

test("validateSavedHistoryViewPayload applies defaults for optional fields", () => {
  const payload = validateSavedHistoryViewPayload({ name: "Completed this week" });

  assert.equal(payload.name, "Completed this week");
  assert.equal(payload.statusFilter, "All");
  assert.equal(payload.searchText, "");
});

test("validateSavedHistoryViewPayload rejects missing names", () => {
  assert.throws(
    () => validateSavedHistoryViewPayload({ name: "   " }),
    (error) => error instanceof ValidationError && error.code === "VALIDATION_HISTORY_VIEW_NAME_REQUIRED"
  );
});

test("validateSavedHistoryViewPayload rejects unsupported status values", () => {
  assert.throws(
    () =>
      validateSavedHistoryViewPayload({
        name: "Critical scans",
        statusFilter: "Done"
      }),
    (error) =>
      error instanceof ValidationError &&
      error.code === "VALIDATION_HISTORY_VIEW_STATUS_FILTER"
  );
});

test("validateSavedHistoryViewPayload rejects overly long search text", () => {
  assert.throws(
    () =>
      validateSavedHistoryViewPayload({
        name: "My view",
        searchText: "a".repeat(257)
      }),
    (error) =>
      error instanceof ValidationError &&
      error.code === "VALIDATION_HISTORY_VIEW_SEARCH_TEXT"
  );
});
