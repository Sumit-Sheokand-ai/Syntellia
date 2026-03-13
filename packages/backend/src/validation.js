class ValidationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.status = status;
  }
}
function normalizeProjectName(value) {
  if (value === undefined || value === null || value === "") {
    return "General";
  }

  if (typeof value !== "string") {
    throw new ValidationError("VALIDATION_PROJECT_NAME", "Project name must be text.");
  }

  const normalized = value.trim();
  if (!normalized) return "General";
  if (normalized.length > 64) {
    throw new ValidationError("VALIDATION_PROJECT_NAME", "Project name must be 64 characters or fewer.");
  }

  return normalized;
}

const ALLOWED_SCAN_SIZES = new Set(["Quick check", "Standard review", "Full walkthrough"]);
const ALLOWED_LOGIN_MODES = new Set(["No login needed", "This page has a login", "I'm not sure"]);
const ALLOWED_FOCUS_AREAS = new Set([
  "Overall feel",
  "Look and brand",
  "Content clarity",
  "Navigation and actions"
]);

function ensureAllowedOrDefault(value, allowedValues, fallback, code, fieldLabel) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new ValidationError(code, `${fieldLabel} must be a text value.`);
  }

  if (!allowedValues.has(value)) {
    throw new ValidationError(code, `${fieldLabel} has an unsupported option.`);
  }

  return value;
}

function validateCreateScanPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("INVALID_REQUEST", "Request payload must be an object.");
  }

  const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";

  if (!rawUrl) {
    throw new ValidationError("VALIDATION_URL_REQUIRED", "Please add a full page link.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new ValidationError(
      "VALIDATION_URL_INVALID",
      "Please use a full link that starts with http:// or https://."
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ValidationError(
      "VALIDATION_URL_PROTOCOL",
      "Please use a full link that starts with http:// or https://."
    );
  }

  return {
    url: parsedUrl.toString(),
    scanSize: ensureAllowedOrDefault(
      payload.scanSize,
      ALLOWED_SCAN_SIZES,
      "Standard review",
      "VALIDATION_SCAN_SIZE",
      "Scan size"
    ),
    loginMode: ensureAllowedOrDefault(
      payload.loginMode,
      ALLOWED_LOGIN_MODES,
      "No login needed",
      "VALIDATION_LOGIN_MODE",
      "Login mode"
    ),
    focusArea: ensureAllowedOrDefault(
      payload.focusArea,
      ALLOWED_FOCUS_AREAS,
      "Overall feel",
      "VALIDATION_FOCUS_AREA",
      "Focus area"
    ),
    projectName: normalizeProjectName(payload.projectName)
  };
}

module.exports = {
  ValidationError,
  validateCreateScanPayload
};
