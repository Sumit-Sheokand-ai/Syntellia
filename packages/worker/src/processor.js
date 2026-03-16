const cheerio = require("cheerio");
const dns = require("node:dns/promises");
const net = require("node:net");

// ── Groq SDK — optional dependency, loaded lazily ──
let _groqSdkModule;
let _groqSdkLoaded = false;
function getGroqSdk() {
  if (_groqSdkLoaded) return _groqSdkModule;
  _groqSdkLoaded = true;
  try {
    // eslint-disable-next-line global-require
    _groqSdkModule = require("groq-sdk");
  } catch {
    _groqSdkModule = null;
  }
  return _groqSdkModule;
}

// In-memory token bucket for Groq rate limiting (single-process worker)
const _groqRateLimiter = {
  calls: [],
  isAllowed(maxPerMinute) {
    const now = Date.now();
    this.calls = this.calls.filter((t) => now - t < 60_000);
    if (this.calls.length >= maxPerMinute) return false;
    this.calls.push(now);
    return true;
  }
};

const COLOR_PATTERN = /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}{]+)/gi;
const CTA_PATTERN = /\b(sign up|get started|start free|book|buy|try|contact|request|demo|subscribe|checkout|apply|join|schedule)\b/i;
const TRUST_PATTERN = /\b(privacy|terms|refund|returns|shipping|contact|support|about|security|guarantee|policy|legal)\b/i;
const FAQ_PATTERN = /\bfaq|frequently asked questions\b/i;
const HIGHLIGHT_WORDS = new Set([
  "free", "fast", "simple", "trusted", "secure", "save", "instant", "easy", "guarantee", "support"
]);
const GENERIC_FONT_TOKENS = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "cursive",
  "fantasy", "ui-sans-serif", "ui-serif", "ui-monospace"
]);
const SECURITY_HEADER_RULES = [
  { key: "content-security-policy", label: "Content protection policy", impact: "high" },
  { key: "strict-transport-security", label: "HTTPS enforcement", impact: "high" },
  { key: "x-frame-options", label: "Clickjacking protection", impact: "high" },
  { key: "x-content-type-options", label: "Content type safety", impact: "medium" },
  { key: "referrer-policy", label: "Referrer privacy", impact: "medium" },
  { key: "permissions-policy", label: "Browser feature limits", impact: "medium" },
  { key: "cross-origin-opener-policy", label: "Cross-origin isolation", impact: "medium" },
  { key: "cross-origin-resource-policy", label: "Cross-origin resource control", impact: "low" }
];
const SECURITY_HEADER_RULES_BY_KEY = Object.fromEntries(
  SECURITY_HEADER_RULES.map((rule) => [rule.key, rule])
);

const CRAWLER_USER_AGENT = "SyntelliaBot/0.2 (+https://syntellia.app)";
const DEFAULT_FAST_TIMEOUT_MS = 12_000;
const DEFAULT_BROWSER_TIMEOUT_MS = 20_000;
const DEFAULT_STYLESHEET_TIMEOUT_MS = 8_000;

const sizeConfig = {
  "Quick check": {
    pageLimit: 1,
    maxDepth: 0,
    timeBudgetMs: 15_000,
    scope: "Single page review",
    detail: "A fast look at one page."
  },
  "Standard review": {
    pageLimit: 5,
    maxDepth: 1,
    timeBudgetMs: 35_000,
    scope: "Up to 5 important pages",
    detail: "A balanced review of the main journey."
  },
  "Full walkthrough": {
    pageLimit: 10,
    maxDepth: 2,
    timeBudgetMs: 55_000,
    scope: "Up to 10 key pages",
    detail: "A broader review for a fuller picture."
  }
};

function readOptionalPositiveInteger(rawValue) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function applyCap(value, cap) {
  if (!Number.isFinite(cap) || cap <= 0) return value;
  return Math.min(value, cap);
}

const GROQ_RATE_LIMIT_RPM = readOptionalPositiveInteger(process.env.GROQ_RATE_LIMIT_RPM) ?? 8;

const MAX_DEPTH_MODE = (process.env.SCAN_MAX_DEPTH_MODE ?? "").toLowerCase();
const MAX_DEPTH_OVERRIDE = readOptionalPositiveInteger(process.env.SCAN_MAX_DEPTH_DEFAULT);
const PAGE_LIMIT_OVERRIDE = readOptionalPositiveInteger(process.env.SCAN_PAGE_LIMIT_DEFAULT);
const TIME_BUDGET_OVERRIDE_MS = readOptionalPositiveInteger(process.env.SCAN_TIME_BUDGET_MS);
const MAX_DEPTH_CAP = readOptionalPositiveInteger(process.env.SCAN_MAX_DEPTH_CAP);
const PAGE_LIMIT_CAP = readOptionalPositiveInteger(process.env.SCAN_PAGE_LIMIT_CAP);
const TIME_BUDGET_CAP_MS = readOptionalPositiveInteger(process.env.SCAN_TIME_BUDGET_CAP_MS);
const GLOBAL_MAX_DEPTH = Math.max(...Object.values(sizeConfig).map((entry) => entry.maxDepth));
const GLOBAL_MAX_PAGE_LIMIT = Math.max(...Object.values(sizeConfig).map((entry) => entry.pageLimit));
const GLOBAL_MAX_TIME_BUDGET = Math.max(...Object.values(sizeConfig).map((entry) => entry.timeBudgetMs));

const focusConfig = {
  "Overall feel": {
    checks: ["Visual consistency", "Ease of use", "Main messages", "User flow"],
    outputs: ["A plain-language summary", "Style highlights", "Top UX observations"],
    components: ["Hero sections", "Content blocks", "Buttons and calls to action", "Menus and page structure"],
    interactions: ["Overall feel", "Visual style", "Page clarity", "User path"]
  },
  "Look and brand": {
    checks: ["Colors", "Fonts", "Spacing", "Visual rhythm"],
    outputs: ["Style summary", "Color and font review", "Brand consistency notes"],
    components: ["Brand headers", "Feature cards", "Buttons", "Highlight sections"],
    interactions: ["Look and brand", "Color balance", "Typography", "Visual consistency"]
  },
  "Content clarity": {
    checks: ["Headline clarity", "Reading flow", "Section order", "Supporting copy"],
    outputs: ["Clarity summary", "Readability notes", "Message structure review"],
    components: ["Headlines", "Supporting sections", "Lists and cards", "Calls to action"],
    interactions: ["Content clarity", "Reading order", "Message flow", "Decision points"]
  },
  "Navigation and actions": {
    checks: ["Navigation", "Primary actions", "Page hierarchy", "Decision points"],
    outputs: ["Navigation summary", "Action-path notes", "Hierarchy review"],
    components: ["Navigation bars", "Menus", "Buttons", "Forms and conversion points"],
    interactions: ["Navigation and actions", "Primary next steps", "Wayfinding", "Action clarity"]
  }
};

class ScanProcessingError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ScanProcessingError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

function isPrivateIpv4(ip) {
  const octets = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((value) => !Number.isFinite(value))) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

function isUnsafeHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home.arpa")
  ) {
    return true;
  }

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
}

async function assertSafeNetworkTarget(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  if (isUnsafeHostname(hostname)) {
    throw new ScanProcessingError(
      "UNSAFE_TARGET_HOST",
      "The target host is blocked for security reasons.",
      { retryable: false }
    );
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
      throw new ScanProcessingError(
        "UNRESOLVABLE_TARGET_HOST",
        "The target host could not be resolved.",
        { retryable: false }
      );
    }
    if (records.some((record) => isUnsafeHostname(record.address))) {
      throw new ScanProcessingError(
        "UNSAFE_TARGET_IP",
        "The target resolves to an internal or blocked IP range.",
        { retryable: false }
      );
    }
  } catch (error) {
    if (error instanceof ScanProcessingError) throw error;
    throw new ScanProcessingError(
      "TARGET_DNS_LOOKUP_FAILED",
      "The target host DNS lookup failed.",
      { retryable: true }
    );
  }
}

let playwrightModule;
let playwrightLoaded = false;

function getPlaywright() {
  if (playwrightLoaded) {
    return playwrightModule;
  }

  playwrightLoaded = true;
  try {
    // Optional dependency; keep runtime working without browser install.
    // eslint-disable-next-line global-require
    playwrightModule = require("playwright");
  } catch {
    playwrightModule = null;
  }

  return playwrightModule;
}

function uniqueValues(values, limit) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, limit);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRuleRegex(rawRulePath) {
  const hasTerminal = rawRulePath.endsWith("$");
  const pattern = hasTerminal ? rawRulePath.slice(0, -1) : rawRulePath;
  const wildcardSafePattern = pattern
    .split("*")
    .map((part) => escapeRegex(part))
    .join(".*");
  return new RegExp(`^${wildcardSafePattern}${hasTerminal ? "$" : ""}`);
}

function parseRobotsRules(content) {
  const groups = [];
  let currentGroup = null;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const noComment = rawLine.split("#")[0].trim();
    if (!noComment) continue;

    const separatorIndex = noComment.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = noComment.slice(0, separatorIndex).trim().toLowerCase();
    const value = noComment.slice(separatorIndex + 1).trim();
    if (!key) continue;

    if (key === "user-agent") {
      if (!currentGroup || currentGroup.rules.length > 0) {
        currentGroup = { userAgents: [], rules: [] };
        groups.push(currentGroup);
      }
      currentGroup.userAgents.push(value.toLowerCase());
      continue;
    }

    if (key !== "allow" && key !== "disallow") continue;
    if (!currentGroup) continue;
    if (key === "disallow" && value === "") continue;

    currentGroup.rules.push({
      type: key,
      path: value
    });
  }

  return groups;
}

function createRobotsPolicy(seedUrl, robotsContent) {
  const groups = parseRobotsRules(robotsContent);
  const botToken = "syntelliabot";

  const exactMatchRules = groups
    .filter((group) => group.userAgents.some((userAgent) => userAgent !== "*" && botToken.includes(userAgent)))
    .flatMap((group) => group.rules);
  const wildcardRules = groups
    .filter((group) => group.userAgents.includes("*"))
    .flatMap((group) => group.rules);
  const selectedRules = exactMatchRules.length ? exactMatchRules : wildcardRules;

  return {
    initialUrl: seedUrl,
    selectedRules,
    isAllowed(targetUrl) {
      if (!selectedRules.length) return true;
      const parsed = new URL(targetUrl);
      const normalizedPath = `${parsed.pathname}${parsed.search}`;
      const matches = [];

      for (const rule of selectedRules) {
        if (!rule.path) continue;
        const regex = toRuleRegex(rule.path);
        if (!regex.test(normalizedPath)) continue;

        matches.push({
          type: rule.type,
          pathLength: rule.path.length
        });
      }

      if (!matches.length) return true;

      matches.sort((a, b) => b.pathLength - a.pathLength);
      const mostSpecificLength = matches[0].pathLength;
      const mostSpecificMatches = matches.filter((match) => match.pathLength === mostSpecificLength);

      // RFC tie-break guidance: allow should win for equivalent match length.
      if (mostSpecificMatches.some((match) => match.type === "allow")) return true;
      return false;
    }
  };
}

async function fetchRobotsPolicy(seedUrl) {
  const robotsUrl = new URL("/robots.txt", seedUrl).toString();

  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": CRAWLER_USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return {
        source: robotsUrl,
        available: false,
        notes: [`robots.txt returned ${response.status}; fallback allow-all policy applied.`],
        isAllowed: () => true
      };
    }

    const content = await response.text();
    const policy = createRobotsPolicy(seedUrl, content);

    return {
      initialUrl: seedUrl,
      source: robotsUrl,
      available: true,
      notes: [],
      isAllowed: policy.isAllowed
    };
  } catch {
    return {
      source: robotsUrl,
      available: false,
      notes: ["robots.txt could not be fetched; fallback allow-all policy applied."],
      isAllowed: () => true
    };
  }
}

function normalizeCrawlUrl(candidate, baseUrl) {
  let parsed;
  try {
    parsed = new URL(candidate, baseUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  parsed.hash = "";
  return parsed.toString();
}

function collectText($elements, limit) {
  return uniqueValues(
    $elements
      .map((_, el) => normalizeWhitespace(cheerio.load(el).text()))
      .get()
      .filter((v) => v.length > 1 && v.length <= 80),
    limit
  );
}

function collectColors(input) {
  return uniqueValues(input.match(COLOR_PATTERN) ?? [], 12);
}

function collectFonts(input) {
  const fonts = [];
  for (const match of input.matchAll(FONT_FAMILY_PATTERN)) {
    const candidates = match[1]
      .split(",")
      .map((t) => t.replace(/["']/g, "").trim())
      .filter((t) => t && !GENERIC_FONT_TOKENS.has(t.toLowerCase()));
    fonts.push(...candidates);
  }
  return uniqueValues(fonts, 8);
}

function detectComponents($) {
  const components = [];
  if ($("header, nav").length) components.push("Navigation bar");
  if ($("main h1").length || $("section[class*='hero'], section[id*='hero'], [class*='banner']").length) components.push("Hero section");
  if ($("article, [class*='card'], [data-testid*='card']").length) components.push("Card layouts");
  if ($("form").length) components.push("Forms");
  if ($("footer").length) components.push("Footer");
  if ($("[role='dialog'], [class*='modal']").length) components.push("Dialogs or modals");
  if ($("table").length) components.push("Tables");
  if ($("[class*='pricing']").length) components.push("Pricing block");
  if ($("[class*='testimonial'], [data-testid*='testimonial']").length) components.push("Testimonials");
  if ($("section, article").length >= 3) components.push("Stacked content sections");
  return uniqueValues(components, 8);
}

function extractCallToActions($, buttonLabels) {
  const linkLabels = collectText($("a"), 30).filter((label) => CTA_PATTERN.test(label));
  return uniqueValues([...buttonLabels.filter((label) => CTA_PATTERN.test(label)), ...linkLabels], 10);
}

function extractTrustSignals($) {
  const trustLinks = uniqueValues(
    $("a[href]")
      .map((_, el) => {
        const text = normalizeWhitespace($(el).text());
        const href = ($(el).attr("href") ?? "").toLowerCase();
        const candidate = `${text} ${href}`.trim();
        return TRUST_PATTERN.test(candidate) ? (text || href) : "";
      })
      .get(),
    12
  );

  const hasContactDetails = Boolean($("a[href^='mailto:'], a[href^='tel:'], address").length);
  const hasTestimonials = Boolean(
    $("[class*='testimonial'], [data-testid*='testimonial'], [class*='review'], [aria-label*='review']").length
  );
  const hasFaq = Boolean(
    $("[id*='faq'], [class*='faq']").length ||
    $("h2, h3, h4")
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .some((text) => FAQ_PATTERN.test(text))
  );
  const hasPolicyPages = trustLinks.some((value) => /privacy|terms|refund|returns|policy/i.test(value));

  return {
    trustLinks,
    hasContactDetails,
    hasTestimonials,
    hasFaq,
    hasPolicyPages
  };
}

function assessAccessibility($) {
  const imageCount = $("img").length;
  const imagesWithAlt = $("img[alt]").length;
  const altCoverage = imageCount ? Math.round((imagesWithAlt / imageCount) * 100) : 100;

  const formFields = $("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select");
  let labeledFieldCount = 0;
  formFields.each((_, el) => {
    const id = $(el).attr("id");
    const hasLinkedLabel = id
      ? $("label")
        .filter((__, labelEl) => ($(labelEl).attr("for") ?? "") === id)
        .length > 0
      : false;
    const hasWrappedLabel = $(el).parents("label").length > 0;
    const hasAriaLabel = Boolean($(el).attr("aria-label") || $(el).attr("aria-labelledby"));
    const hasPlaceholder = Boolean($(el).attr("placeholder"));
    if (hasLinkedLabel || hasWrappedLabel || hasAriaLabel || hasPlaceholder) {
      labeledFieldCount += 1;
    }
  });

  const fieldCount = formFields.length;
  const formLabelCoverage = fieldCount ? Math.round((labeledFieldCount / fieldCount) * 100) : 100;

  return {
    imageCount,
    imagesWithAlt,
    altCoverage,
    fieldCount,
    labeledFieldCount,
    formLabelCoverage,
    hasViewportMeta: Boolean($("meta[name='viewport']").length)
  };
}

function assessReadability($) {
  const paragraphs = $("p")
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter((text) => text.length > 25);

  const paragraphWordCounts = paragraphs.map((text) => text.split(/\s+/).filter(Boolean).length);
  const avgParagraphWords = paragraphWordCounts.length
    ? Math.round(paragraphWordCounts.reduce((sum, count) => sum + count, 0) / paragraphWordCounts.length)
    : 0;
  const longParagraphCount = paragraphWordCounts.filter((count) => count > 45).length;

  const combinedText = normalizeWhitespace($("main, article, body").first().text() || $("body").text());
  const words = combinedText.split(/\s+/).filter((token) => token.length > 1);
  const sentenceCount = combinedText
    .split(/[.!?]+/)
    .map((value) => value.trim())
    .filter(Boolean).length;
  const avgWordsPerSentence = sentenceCount ? Math.round(words.length / sentenceCount) : 0;

  return {
    paragraphCount: paragraphs.length,
    avgParagraphWords,
    longParagraphCount,
    wordCount: words.length,
    sentenceCount,
    avgWordsPerSentence
  };
}

function assessHeadingFlow($) {
  const headingLevels = $("h1, h2, h3, h4, h5, h6")
    .map((_, el) => Number((el.tagName ?? "h1").slice(1)))
    .get()
    .filter((value) => Number.isFinite(value));

  let headingJumpCount = 0;
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] - headingLevels[index - 1] > 1) {
      headingJumpCount += 1;
    }
  }

  return {
    headingLevels,
    headingJumpCount
  };
}

function assessFormComplexity($) {
  const forms = $("form");
  const fieldCounts = forms
    .map((_, form) => $(form).find("input, textarea, select").length)
    .get();
  const complexForms = fieldCounts.filter((count) => count >= 6).length;

  return {
    formCount: forms.length,
    complexForms
  };
}

function collectHighlightTerms(textValues) {
  const matches = [];
  textValues.forEach((value) => {
    value
      .toLowerCase()
      .split(/\W+/)
      .forEach((token) => {
        if (HIGHLIGHT_WORDS.has(token)) {
          matches.push(token);
        }
      });
  });

  return uniqueValues(matches, 12);
}

function normalizeHeaderRecord(headers) {
  const normalized = {};
  if (!headers || typeof headers !== "object") return normalized;
  for (const [key, value] of Object.entries(headers)) {
    if (!key) continue;
    const normalizedKey = key.toLowerCase();
    normalized[normalizedKey] = typeof value === "string" ? value : String(value ?? "");
  }
  return normalized;
}

function evaluateSecurityHeaders(headers) {
  const normalized = normalizeHeaderRecord(headers);
  const present = [];
  const missing = [];
  const weak = [];

  for (const rule of SECURITY_HEADER_RULES) {
    const value = normalized[rule.key] ?? "";
    if (!value) {
      missing.push({
        key: rule.key,
        label: rule.label,
        impact: rule.impact
      });
      continue;
    }

    present.push({
      key: rule.key,
      label: rule.label,
      value: value.slice(0, 220)
    });
  }

  const csp = normalized["content-security-policy"] ?? "";
  if (csp && /unsafe-inline|unsafe-eval|\*/i.test(csp)) {
    weak.push({
      key: "content-security-policy",
      label: SECURITY_HEADER_RULES_BY_KEY["content-security-policy"].label,
      issue: "Permissive CSP directives detected."
    });
  }

  const hsts = normalized["strict-transport-security"] ?? "";
  const maxAgeMatch = hsts.match(/max-age\s*=\s*(\d+)/i);
  if (hsts && !maxAgeMatch) {
    weak.push({
      key: "strict-transport-security",
      label: SECURITY_HEADER_RULES_BY_KEY["strict-transport-security"].label,
      issue: "HSTS header is missing max-age."
    });
  } else if (hsts && Number(maxAgeMatch?.[1] ?? "0") < 15_552_000) {
    weak.push({
      key: "strict-transport-security",
      label: SECURITY_HEADER_RULES_BY_KEY["strict-transport-security"].label,
      issue: "HSTS max-age looks short."
    });
  }

  const xfo = normalized["x-frame-options"] ?? "";
  if (xfo && !/deny|sameorigin/i.test(xfo)) {
    weak.push({
      key: "x-frame-options",
      label: SECURITY_HEADER_RULES_BY_KEY["x-frame-options"].label,
      issue: "X-Frame-Options value may not prevent framing."
    });
  }

  const xcto = normalized["x-content-type-options"] ?? "";
  if (xcto && !/nosniff/i.test(xcto)) {
    weak.push({
      key: "x-content-type-options",
      label: SECURITY_HEADER_RULES_BY_KEY["x-content-type-options"].label,
      issue: "X-Content-Type-Options should usually be nosniff."
    });
  }

  const referrer = normalized["referrer-policy"] ?? "";
  if (referrer && /unsafe-url/i.test(referrer)) {
    weak.push({
      key: "referrer-policy",
      label: SECURITY_HEADER_RULES_BY_KEY["referrer-policy"].label,
      issue: "Referrer-Policy exposes full URLs."
    });
  }

  return { present, missing, weak };
}

function analyzeSetCookieHeaders(setCookieHeaders) {
  const values = Array.isArray(setCookieHeaders) ? setCookieHeaders.filter(Boolean) : [];
  let secureCount = 0;
  let httpOnlyCount = 0;
  let sameSiteCount = 0;
  const issues = new Set();

  values.forEach((cookieLine) => {
    const attributes = cookieLine
      .split(";")
      .slice(1)
      .map((segment) => segment.trim().toLowerCase());
    const hasSecure = attributes.some((attribute) => attribute === "secure");
    const hasHttpOnly = attributes.some((attribute) => attribute === "httponly");
    const sameSite = attributes.find((attribute) => attribute.startsWith("samesite="));

    if (hasSecure) secureCount += 1;
    if (hasHttpOnly) httpOnlyCount += 1;
    if (sameSite) sameSiteCount += 1;

    if (!hasSecure) {
      issues.add("Some cookies are missing the Secure flag.");
    }
    if (!hasHttpOnly) {
      issues.add("Some cookies are missing the HttpOnly flag.");
    }
    if (!sameSite) {
      issues.add("Some cookies are missing a SameSite policy.");
    }
    if (sameSite?.includes("none") && !hasSecure) {
      issues.add("SameSite=None cookies should also include Secure.");
    }
  });

  const totalSetCookie = values.length;
  const toRate = (count) => (totalSetCookie ? Math.round((count / totalSetCookie) * 100) : 100);

  return {
    totalSetCookie,
    secureCount,
    httpOnlyCount,
    sameSiteCount,
    secureRate: toRate(secureCount),
    httpOnlyRate: toRate(httpOnlyCount),
    sameSiteRate: toRate(sameSiteCount),
    issues: [...issues]
  };
}

function assessLinkAndFormHardening($, baseUrl) {
  let targetBlankCount = 0;
  let unsafeTargetBlankCount = 0;
  let insecureLinkCount = 0;
  let insecureFormActionCount = 0;

  $("a[href]").each((_, element) => {
    const target = ($(element).attr("target") ?? "").toLowerCase();
    const rel = ($(element).attr("rel") ?? "").toLowerCase();
    const href = normalizeCrawlUrl($(element).attr("href"), baseUrl);

    if (target === "_blank") {
      targetBlankCount += 1;
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) {
        unsafeTargetBlankCount += 1;
      }
    }

    if (href && href.startsWith("http://")) {
      insecureLinkCount += 1;
    }
  });

  $("form").each((_, element) => {
    const action = normalizeCrawlUrl($(element).attr("action"), baseUrl);
    if (action && action.startsWith("http://")) {
      insecureFormActionCount += 1;
    }
  });

  return {
    targetBlankCount,
    unsafeTargetBlankCount,
    insecureLinkCount,
    insecureFormActionCount
  };
}

function assessScriptSurface($, baseUrl, finalProtocol) {
  const pageOrigin = new URL(baseUrl).origin;
  const externalHosts = new Set();
  let externalScriptCount = 0;
  let scriptsWithoutSriCount = 0;
  let mixedContentCount = 0;
  const inlineScriptCount = $("script:not([src])").length;

  $("script[src]").each((_, element) => {
    const src = normalizeCrawlUrl($(element).attr("src"), baseUrl);
    if (!src) return;
    const parsed = new URL(src);
    if (finalProtocol === "https:" && parsed.protocol === "http:") mixedContentCount += 1;
    if (parsed.origin !== pageOrigin) {
      externalScriptCount += 1;
      externalHosts.add(parsed.hostname);
      if (!$(element).attr("integrity")) scriptsWithoutSriCount += 1;
    }
  });

  const mixedSelectors = [
    "img[src]",
    "source[src]",
    "video[src]",
    "audio[src]",
    "iframe[src]",
    "link[href]"
  ];
  mixedSelectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const attr = selector.includes("href") ? "href" : "src";
      const assetUrl = normalizeCrawlUrl($(element).attr(attr), baseUrl);
      if (!assetUrl) return;
      if (finalProtocol === "https:" && assetUrl.startsWith("http://")) {
        mixedContentCount += 1;
      }
    });
  });

  return {
    externalScriptCount,
    externalScriptHostCount: externalHosts.size,
    externalScriptHosts: [...externalHosts].slice(0, 10),
    scriptsWithoutSriCount,
    inlineScriptCount,
    mixedContentCount
  };
}

function assessCorsPolicy(headers) {
  const normalized = normalizeHeaderRecord(headers);
  const allowOrigin = normalized["access-control-allow-origin"] ?? "";
  const allowCredentials = normalized["access-control-allow-credentials"] ?? "";
  const issues = [];

  if (allowOrigin === "*") {
    issues.push("CORS allows all origins via Access-Control-Allow-Origin: *.");
  }
  if (allowOrigin === "*" && /true/i.test(allowCredentials)) {
    issues.push("CORS wildcard origin with credentials is unsafe and typically invalid.");
  }

  return {
    allowOrigin: allowOrigin || "not-set",
    allowsCredentials: /true/i.test(allowCredentials),
    issues
  };
}

function assessCachePolicy(headers, hasSensitiveForm) {
  const normalized = normalizeHeaderRecord(headers);
  const cacheControl = normalized["cache-control"] ?? "";
  const pragma = normalized.pragma ?? "";
  const issues = [];

  if (hasSensitiveForm && !/no-store/i.test(cacheControl) && !/no-cache/i.test(pragma)) {
    issues.push("Sensitive form page is missing no-store/no-cache protections.");
  }
  if (!cacheControl) {
    issues.push("Cache-Control header is not present.");
  }

  return {
    cacheControl: cacheControl || "not-set",
    pragma: pragma || "not-set",
    issues
  };
}

function assessAuthSurface($) {
  const passwordInputs = $("input[type='password']");
  const passwordInputCount = passwordInputs.length;
  const formNodes = new Set();
  passwordInputs.each((_, element) => {
    const parentForm = $(element).closest("form").get(0);
    if (parentForm) formNodes.add(parentForm);
  });

  const hiddenNames = $("input[type='hidden']")
    .map((_, element) => ($(element).attr("name") ?? "").toLowerCase())
    .get();
  const csrfSignalCount = hiddenNames.filter((name) => /(csrf|xsrf|token)/i.test(name)).length;
  const passwordAutocompleteOffCount = passwordInputs
    .filter((_, element) => (($(element).attr("autocomplete") ?? "").toLowerCase() === "off"))
    .length;

  const issues = [];
  if (passwordInputCount > 0 && csrfSignalCount === 0) {
    issues.push("Password flow detected without obvious CSRF/token form fields.");
  }
  if (passwordAutocompleteOffCount > 0) {
    issues.push("Password fields with autocomplete=off may reduce password manager safety.");
  }

  return {
    hasPasswordFlow: passwordInputCount > 0,
    passwordInputCount,
    passwordFormCount: formNodes.size,
    csrfSignalCount,
    passwordAutocompleteOffCount,
    issues
  };
}

function assessSecurityTechnical($, scanUrl, fetched) {
  const headers = evaluateSecurityHeaders(fetched.responseHeaders);
  const cookies = analyzeSetCookieHeaders(fetched.setCookieHeaders);
  const linksAndForms = assessLinkAndFormHardening($, fetched.finalUrl);
  const authSurface = assessAuthSurface($);

  const scanProtocol = new URL(scanUrl).protocol;
  const finalProtocol = new URL(fetched.finalUrl).protocol;
  const transport = {
    scanProtocol,
    finalProtocol,
    usesHttps: finalProtocol === "https:",
    redirectedToHttps: scanProtocol === "http:" && finalProtocol === "https:",
    downgradedToHttp: scanProtocol === "https:" && finalProtocol === "http:"
  };
  const scriptSurface = assessScriptSurface($, fetched.finalUrl, finalProtocol);
  const cors = assessCorsPolicy(fetched.responseHeaders);
  const cachePolicy = assessCachePolicy(fetched.responseHeaders, authSurface.hasPasswordFlow);
  const normalizedHeaders = normalizeHeaderRecord(fetched.responseHeaders);
  const hstsValue = normalizedHeaders["strict-transport-security"] ?? "";
  const hstsMaxAge = Number((hstsValue.match(/max-age\s*=\s*(\d+)/i) ?? [])[1] ?? "0");
  const hstsIncludesSubdomains = /includesubdomains/i.test(hstsValue);
  const hstsPreloadFlag = /preload/i.test(hstsValue);
  const hstsPreloadReady = Boolean(
    hstsValue && hstsMaxAge >= 31_536_000 && hstsIncludesSubdomains && hstsPreloadFlag
  );

  const notes = [];
  if (!transport.usesHttps) {
    notes.push("Final page response was not served over HTTPS.");
  }
  if (headers.missing.length) {
    notes.push(`${headers.missing.length} recommended security header(s) are missing.`);
  }
  if (headers.weak.length) {
    notes.push(`${headers.weak.length} header value issue(s) were detected.`);
  }
  if (linksAndForms.unsafeTargetBlankCount > 0) {
    notes.push(`${linksAndForms.unsafeTargetBlankCount} link(s) open a new tab without rel hardening.`);
  }
  if (linksAndForms.insecureFormActionCount > 0) {
    notes.push(`${linksAndForms.insecureFormActionCount} form action(s) post over HTTP.`);
  }
  if (scriptSurface.mixedContentCount > 0) {
    notes.push(`${scriptSurface.mixedContentCount} mixed-content asset reference(s) were detected.`);
  }
  if (scriptSurface.scriptsWithoutSriCount > 0) {
    notes.push(`${scriptSurface.scriptsWithoutSriCount} external script(s) are missing SRI integrity attributes.`);
  }
  if (cors.issues.length > 0) {
    notes.push(...cors.issues);
  }
  if (cachePolicy.issues.length > 0) {
    notes.push(...cachePolicy.issues);
  }
  if (authSurface.issues.length > 0) {
    notes.push(...authSurface.issues);
  }

  return {
    transport,
    headers,
    cookies,
    linksAndForms,
    scriptSurface,
    cors,
    cachePolicy,
    authSurface,
    hsts: {
      value: hstsValue || "not-set",
      maxAge: hstsMaxAge,
      includesSubdomains: hstsIncludesSubdomains,
      hasPreloadFlag: hstsPreloadFlag,
      preloadReady: hstsPreloadReady
    },
    notes
  };
}

function isTimeoutError(error) {
  if (!error) return false;
  if (error.name === "TimeoutError") return true;
  return /timed out|timeout/i.test(error.message ?? "");
}

async function fetchTextViaHttp(url, timeoutMs) {
  await assertSafeNetworkTarget(url);
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": CRAWLER_USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ScanProcessingError(
        "FETCH_TIMEOUT",
        "The page fetch timed out from the scan server.",
        { retryable: true }
      );
    }

    throw new ScanProcessingError(
      "FETCH_NETWORK",
      "The page could not be fetched from the scan server.",
      { retryable: true }
    );
  }

  if (!response.ok) {
    throw new ScanProcessingError(
      `FETCH_HTTP_${response.status}`,
      `The page responded with ${response.status}.`,
      { retryable: response.status >= 500 }
    );
  }
  await assertSafeNetworkTarget(response.url);

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  const setCookieHeaders = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);

  return {
    finalUrl: response.url,
    statusCode: response.status,
    body: await response.text(),
    responseHeaders,
    setCookieHeaders,
    executionMode: "fast-http",
    modeFallback: false
  };
}

async function fetchTextViaBrowser(url, timeoutMs) {
  await assertSafeNetworkTarget(url);
  const playwright = getPlaywright();
  if (!playwright) {
    throw new ScanProcessingError(
      "BROWSER_RUNTIME_UNAVAILABLE",
      "Browser rendering is unavailable in this worker runtime.",
      { retryable: false }
    );
  }

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    await page.waitForTimeout(400);
    const body = await page.content();
    let responseHeaders = {};
    let setCookieHeaders = [];

    if (response) {
      try {
        responseHeaders = await response.allHeaders();
      } catch {
        responseHeaders = {};
      }

      try {
        if (typeof response.headersArray === "function") {
          const entries = await response.headersArray();
          setCookieHeaders = entries
            .filter((entry) => entry.name.toLowerCase() === "set-cookie")
            .map((entry) => entry.value);

          if (!Object.keys(responseHeaders).length) {
            entries.forEach((entry) => {
              responseHeaders[entry.name.toLowerCase()] = entry.value;
            });
          }
        }
      } catch {
        // ignore missing raw header support
      }
    }

    const finalUrl = page.url();
    await assertSafeNetworkTarget(finalUrl);

    return {
      finalUrl,
      statusCode: response?.status() ?? 200,
      body,
      responseHeaders: normalizeHeaderRecord(responseHeaders),
      setCookieHeaders,
      executionMode: "browser-rendered",
      modeFallback: false
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ScanProcessingError(
        "BROWSER_TIMEOUT",
        "Browser-rendered fetch timed out.",
        { retryable: true }
      );
    }

    throw new ScanProcessingError(
      "BROWSER_FETCH_FAILED",
      "Browser-rendered fetch failed.",
      { retryable: true }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

async function fetchTextForMode(url, requestedMode) {
  if (requestedMode === "browser-rendered") {
    try {
      return await fetchTextViaBrowser(url, DEFAULT_BROWSER_TIMEOUT_MS);
    } catch (error) {
      if (error instanceof ScanProcessingError && error.code === "BROWSER_RUNTIME_UNAVAILABLE") {
        const fallbackResult = await fetchTextViaHttp(url, DEFAULT_FAST_TIMEOUT_MS);
        return {
          ...fallbackResult,
          modeFallback: true,
          fallbackReason: error.message
        };
      }
      throw error;
    }
  }

  return fetchTextViaHttp(url, DEFAULT_FAST_TIMEOUT_MS);
}

async function fetchStylesheets($, baseUrl) {
  const stylesheetUrls = uniqueValues(
    $("link[rel='stylesheet']").map((_, el) => $(el).attr("href") ?? "").get(),
    5
  )
    .map((href) => normalizeCrawlUrl(href, baseUrl))
    .filter(Boolean);

  const results = await Promise.allSettled(
    stylesheetUrls.map(async (url) => {
      await assertSafeNetworkTarget(url);
      const response = await fetch(url, {
        headers: { "User-Agent": CRAWLER_USER_AGENT },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_STYLESHEET_TIMEOUT_MS)
      });
      return response.ok ? response.text() : "";
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

function collectDiscoveredLinks($, baseUrl, rootOrigin) {
  return uniqueValues(
    $("a[href]")
      .map((_, el) => normalizeCrawlUrl($(el).attr("href"), baseUrl))
      .get()
      .filter((url) => {
        if (!url) return false;
        const parsed = new URL(url);
        if (parsed.origin !== rootOrigin) return false;
        if (isUnsafeHostname(parsed.hostname)) return false;
        return true;
      }),
    60
  );
}

async function extractSinglePage(url, options) {
  const fetched = await fetchTextForMode(url, options.requestedMode);
  const $ = cheerio.load(fetched.body);
  const inlineStyles = $("style").map((_, el) => $(el).html() ?? "").get();
  const referencedStyles = await fetchStylesheets($, fetched.finalUrl);
  const styleSources = [fetched.body, ...inlineStyles, ...referencedStyles].join("\n");

  const headings = collectText($("h1, h2, h3"), 10);
  const navLabels = collectText($("nav a, header a"), 10);
  const buttonLabels = uniqueValues(
    [
      ...collectText($("button, [role='button']"), 12),
      ...$("input[type='submit'], input[type='button']")
        .map((_, el) => normalizeWhitespace($(el).attr("value") ?? ""))
        .get()
    ],
    12
  );

  const ctaLabels = extractCallToActions($, buttonLabels);
  const trustSignals = extractTrustSignals($);
  const accessibility = assessAccessibility($);
  const readability = assessReadability($);
  const headingFlow = assessHeadingFlow($);
  const formComplexity = assessFormComplexity($);
  const highlightTerms = collectHighlightTerms([...headings, ...navLabels, ...buttonLabels]);
  const securityTechnical = assessSecurityTechnical($, url, fetched);

  const notes = [];
  if (fetched.modeFallback && fetched.fallbackReason) {
    notes.push(fetched.fallbackReason);
  }

  const pageTitle = normalizeWhitespace($("title").first().text()) || "Untitled page";
  const metaDescription = normalizeWhitespace($("meta[name='description']").attr("content") ?? "");
  const counts = {
    headings: $("h1, h2, h3, h4, h5, h6").length,
    links: $("a[href]").length,
    buttons: $("button, [role='button'], input[type='submit'], input[type='button']").length,
    forms: $("form").length,
    images: $("img, svg, picture source").length,
    sections: $("section, article, main > div").length,
    navs: $("nav").length,
    inputs: $("input, textarea, select").length,
    ctas: ctaLabels.length,
    trustLinks: trustSignals.trustLinks.length
  };

  if (!metaDescription) notes.push("No meta description was found in the HTML.");
  if (!$("h1").length) notes.push("No H1 heading was found on the page.");
  if ($("input[type='password']").length) notes.push("A password field was detected, so this page likely sits behind a login flow.");
  if (!buttonLabels.length && counts.forms === 0) notes.push("Few direct action controls were detected in the fetched HTML.");
  if (trustSignals.trustLinks.length < 2) notes.push("Only a small number of trust-focused links were visible (privacy, terms, support, contact).");
  if (accessibility.altCoverage < 70) notes.push(`Only ${accessibility.altCoverage}% of images include alt text in the fetched HTML.`);
  if (accessibility.formLabelCoverage < 70) notes.push(`Form field labeling coverage is ${accessibility.formLabelCoverage}%, which may reduce form clarity.`);
  if (headingFlow.headingJumpCount > 0) notes.push(`Heading levels skip hierarchy ${headingFlow.headingJumpCount} time(s), which may reduce scanability.`);
  if (readability.longParagraphCount > 0) notes.push(`${readability.longParagraphCount} paragraph(s) look long for quick customer scanning.`);

  return {
    finalUrl: fetched.finalUrl,
    statusCode: fetched.statusCode,
    pageTitle,
    metaDescription,
    headings,
    navLabels,
    buttonLabels,
    ctaLabels,
    colors: collectColors(styleSources),
    fonts: collectFonts(styleSources),
    components: detectComponents($),
    notes: uniqueValues(notes, 8),
    trustSignals,
    accessibility,
    readability,
    headingFlow,
    formComplexity,
    securityTechnical,
    highlightTerms,
    counts,
    discoveredLinks: collectDiscoveredLinks($, fetched.finalUrl, options.rootOrigin),
    executionMode: fetched.executionMode,
    modeFallback: Boolean(fetched.modeFallback)
  };
}

function getSizeDetails(scanSize) {
  const base = sizeConfig[scanSize] ?? sizeConfig["Standard review"];
  const useMaximum = MAX_DEPTH_MODE === "maximum";

  const resolvedMaxDepth = applyCap(
    MAX_DEPTH_OVERRIDE ?? (useMaximum ? GLOBAL_MAX_DEPTH : base.maxDepth),
    MAX_DEPTH_CAP
  );
  const resolvedPageLimit = applyCap(
    PAGE_LIMIT_OVERRIDE ?? (useMaximum ? GLOBAL_MAX_PAGE_LIMIT : base.pageLimit),
    PAGE_LIMIT_CAP
  );
  const resolvedTimeBudgetMs = applyCap(
    TIME_BUDGET_OVERRIDE_MS ?? (useMaximum ? GLOBAL_MAX_TIME_BUDGET : base.timeBudgetMs),
    TIME_BUDGET_CAP_MS
  );

  return {
    ...base,
    pageLimit: resolvedPageLimit,
    maxDepth: resolvedMaxDepth,
    timeBudgetMs: resolvedTimeBudgetMs
  };
}

function getFocusDetails(focusArea) {
  return focusConfig[focusArea] ?? focusConfig["Overall feel"];
}

function resolveRequestedExecutionMode(loginMode) {
  if (loginMode === "This page has a login") {
    return "browser-rendered";
  }
  return "fast-http";
}

async function extractScanData(input) {
  const sizeDetails = getSizeDetails(input.scanSize);
  const rootUrl = normalizeCrawlUrl(input.url);
  if (!rootUrl) {
    throw new ScanProcessingError(
      "INVALID_TARGET_URL",
      "The provided URL is invalid or unsupported.",
      { retryable: false }
    );
  }

  const rootOrigin = new URL(rootUrl).origin;
  await assertSafeNetworkTarget(rootUrl);
  const requestedMode = resolveRequestedExecutionMode(input.loginMode);
  const robotsPolicy = await fetchRobotsPolicy(rootUrl);

  const queue = [{ url: rootUrl, depth: 0 }];
  const queuedUrls = new Set([rootUrl]);
  const visitedUrls = new Set();

  const pages = [];
  const blockedUrls = [];
  const pageErrors = [];
  let modeFallbackUsed = false;
  let maxReachedDepth = 0;
  const startedAt = Date.now();

  while (queue.length && pages.length < sizeDetails.pageLimit) {
    if (Date.now() - startedAt > sizeDetails.timeBudgetMs) {
      pageErrors.push({
        url: queue[0]?.url ?? rootUrl,
        code: "TIME_BUDGET_EXCEEDED",
        message: "Scan time budget reached before crawling all queued pages.",
        retryable: false
      });
      break;
    }

    const current = queue.shift();
    if (!current) break;
    queuedUrls.delete(current.url);
    if (visitedUrls.has(current.url)) continue;
    visitedUrls.add(current.url);
    maxReachedDepth = Math.max(maxReachedDepth, current.depth);

    if (!robotsPolicy.isAllowed(current.url)) {
      blockedUrls.push(current.url);
      continue;
    }

    try {
      const pageStart = Date.now();
      const page = await extractSinglePage(current.url, {
        requestedMode,
        rootOrigin
      });
      page.fetchMs = Date.now() - pageStart;
      modeFallbackUsed ||= page.modeFallback;
      page.depth = current.depth;
      pages.push(page);

      if (current.depth < sizeDetails.maxDepth && pages.length < sizeDetails.pageLimit) {
        for (const discoveredLink of page.discoveredLinks) {
          if (visitedUrls.has(discoveredLink) || queuedUrls.has(discoveredLink)) continue;
          queue.push({ url: discoveredLink, depth: current.depth + 1 });
          queuedUrls.add(discoveredLink);
        }
      }
    } catch (error) {
      if (error instanceof ScanProcessingError) {
        pageErrors.push({
          url: current.url,
          code: error.code,
          message: error.message,
          retryable: error.retryable
        });
      } else {
        pageErrors.push({
          url: current.url,
          code: "UNKNOWN_PAGE_FAILURE",
          message: "Unexpected page extraction failure.",
          retryable: true
        });
      }
    }
  }

  if (!pages.length) {
    if (blockedUrls.length) {
      throw new ScanProcessingError(
        "ROBOTS_BLOCKED",
        "All candidate pages were blocked by robots.txt policy.",
        { retryable: false }
      );
    }

    const firstError = pageErrors[0];
    throw new ScanProcessingError(
      firstError?.code ?? "NO_PAGES_SCANNED",
      firstError?.message ?? "No pages were successfully scanned.",
      { retryable: Boolean(firstError?.retryable) }
    );
  }

  return {
    pages,
    crawl: {
      requestedPageLimit: sizeDetails.pageLimit,
      maxDepth: sizeDetails.maxDepth,
      timeBudgetMs: sizeDetails.timeBudgetMs,
      durationMs: Date.now() - startedAt,
      pagesScanned: pages.length,
      pagesAttempted: visitedUrls.size,
      blockedByRobots: blockedUrls.length,
      blockedUrls: blockedUrls.slice(0, 20),
      errors: pageErrors.slice(0, 20),
      requestedExecutionMode: requestedMode,
      executionMode: modeFallbackUsed ? "fast-http" : requestedMode,
      modeFallbackUsed,
      robots: {
        source: robotsPolicy.source,
        available: robotsPolicy.available,
        notes: robotsPolicy.notes
      },
      maxReachedDepth
    }
  };
}

function scoreWithinRange(value) {
  return Math.max(35, Math.min(98, value));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregatePages(scanData) {
  const pages = scanData.pages;
  const totalCounts = {
    headings: 0,
    links: 0,
    buttons: 0,
    forms: 0,
    images: 0,
    sections: 0,
    navs: 0,
    inputs: 0,
    ctas: 0,
    trustLinks: 0
  };

  const colors = [];
  const fonts = [];
  const components = [];
  const ctaLabels = [];
  const trustLinks = [];
  const headings = [];
  const navLabels = [];
  const buttonLabels = [];
  const notes = [];
  const highlightTerms = [];
  const executionModesUsed = [];

  let contactSignalCount = 0;
  let testimonialSignalCount = 0;
  let faqSignalCount = 0;
  let policySignalCount = 0;
  let pagesWithoutClearCta = 0;
  let pagesWithLongCopy = 0;
  let pagesWithComplexForms = 0;
  let trustWeakPages = 0;
  let headingJumpCount = 0;
  let complexForms = 0;
  let paragraphCount = 0;
  let longParagraphCount = 0;
  let wordCount = 0;
  let sentenceCount = 0;

  const altCoverageValues = [];
  const formLabelCoverageValues = [];
  const missingHeaderCounts = Object.fromEntries(
    SECURITY_HEADER_RULES.map((rule) => [rule.key, 0])
  );
  const presentHeaderCounts = Object.fromEntries(
    SECURITY_HEADER_RULES.map((rule) => [rule.key, 0])
  );
  const weakHeaderIssueCounts = {};
  const cookieIssues = new Set();
  const pageSecurityHighlights = [];
  let httpsPageCount = 0;
  let redirectedToHttpsCount = 0;
  let downgradedToHttpCount = 0;
  let totalSetCookie = 0;
  let secureCookieCount = 0;
  let httpOnlyCookieCount = 0;
  let sameSiteCookieCount = 0;
  let unsafeTargetBlankCount = 0;
  let insecureLinkCount = 0;
  let insecureFormActionCount = 0;
  let mixedContentCount = 0;
  let externalScriptCount = 0;
  let scriptsWithoutSriCount = 0;
  let inlineScriptCount = 0;
  const externalScriptHosts = new Set();
  let corsRiskPageCount = 0;
  let cacheRiskPageCount = 0;
  let passwordFlowPageCount = 0;
  let passwordFlowMissingCsrfCount = 0;
  let hstsPreloadReadyCount = 0;

  for (const page of pages) {
    totalCounts.headings += page.counts.headings;
    totalCounts.links += page.counts.links;
    totalCounts.buttons += page.counts.buttons;
    totalCounts.forms += page.counts.forms;
    totalCounts.images += page.counts.images;
    totalCounts.sections += page.counts.sections;
    totalCounts.navs += page.counts.navs;
    totalCounts.inputs += page.counts.inputs;
    totalCounts.ctas += page.counts.ctas;
    totalCounts.trustLinks += page.counts.trustLinks;

    colors.push(...page.colors);
    fonts.push(...page.fonts);
    components.push(...page.components);
    ctaLabels.push(...page.ctaLabels);
    trustLinks.push(...page.trustSignals.trustLinks);
    headings.push(...page.headings);
    navLabels.push(...page.navLabels);
    buttonLabels.push(...page.buttonLabels);
    notes.push(...page.notes);
    highlightTerms.push(...page.highlightTerms);
    executionModesUsed.push(page.executionMode);

    contactSignalCount += page.trustSignals.hasContactDetails ? 1 : 0;
    testimonialSignalCount += page.trustSignals.hasTestimonials ? 1 : 0;
    faqSignalCount += page.trustSignals.hasFaq ? 1 : 0;
    policySignalCount += page.trustSignals.hasPolicyPages ? 1 : 0;
    if (page.ctaLabels.length === 0) pagesWithoutClearCta += 1;
    if (page.readability.longParagraphCount > 0) pagesWithLongCopy += 1;
    if (page.formComplexity.complexForms > 0) pagesWithComplexForms += 1;
    if (page.trustSignals.trustLinks.length < 2) trustWeakPages += 1;

    headingJumpCount += page.headingFlow.headingJumpCount;
    complexForms += page.formComplexity.complexForms;
    paragraphCount += page.readability.paragraphCount;
    longParagraphCount += page.readability.longParagraphCount;
    wordCount += page.readability.wordCount;
    sentenceCount += page.readability.sentenceCount;

    altCoverageValues.push(page.accessibility.altCoverage);
    formLabelCoverageValues.push(page.accessibility.formLabelCoverage);

    if (page.securityTechnical?.transport?.usesHttps) httpsPageCount += 1;
    if (page.securityTechnical?.transport?.redirectedToHttps) redirectedToHttpsCount += 1;
    if (page.securityTechnical?.transport?.downgradedToHttp) downgradedToHttpCount += 1;

    page.securityTechnical?.headers?.missing?.forEach((entry) => {
      missingHeaderCounts[entry.key] = (missingHeaderCounts[entry.key] ?? 0) + 1;
    });
    page.securityTechnical?.headers?.present?.forEach((entry) => {
      presentHeaderCounts[entry.key] = (presentHeaderCounts[entry.key] ?? 0) + 1;
    });
    page.securityTechnical?.headers?.weak?.forEach((entry) => {
      const key = `${entry.key}:${entry.issue}`;
      weakHeaderIssueCounts[key] = (weakHeaderIssueCounts[key] ?? 0) + 1;
    });

    totalSetCookie += page.securityTechnical?.cookies?.totalSetCookie ?? 0;
    secureCookieCount += page.securityTechnical?.cookies?.secureCount ?? 0;
    httpOnlyCookieCount += page.securityTechnical?.cookies?.httpOnlyCount ?? 0;
    sameSiteCookieCount += page.securityTechnical?.cookies?.sameSiteCount ?? 0;
    page.securityTechnical?.cookies?.issues?.forEach((issue) => cookieIssues.add(issue));

    unsafeTargetBlankCount += page.securityTechnical?.linksAndForms?.unsafeTargetBlankCount ?? 0;
    insecureLinkCount += page.securityTechnical?.linksAndForms?.insecureLinkCount ?? 0;
    insecureFormActionCount += page.securityTechnical?.linksAndForms?.insecureFormActionCount ?? 0;
    mixedContentCount += page.securityTechnical?.scriptSurface?.mixedContentCount ?? 0;
    externalScriptCount += page.securityTechnical?.scriptSurface?.externalScriptCount ?? 0;
    scriptsWithoutSriCount += page.securityTechnical?.scriptSurface?.scriptsWithoutSriCount ?? 0;
    inlineScriptCount += page.securityTechnical?.scriptSurface?.inlineScriptCount ?? 0;
    page.securityTechnical?.scriptSurface?.externalScriptHosts?.forEach((host) => externalScriptHosts.add(host));
    if ((page.securityTechnical?.cors?.issues?.length ?? 0) > 0) corsRiskPageCount += 1;
    if ((page.securityTechnical?.cachePolicy?.issues?.length ?? 0) > 0) cacheRiskPageCount += 1;
    if (page.securityTechnical?.authSurface?.hasPasswordFlow) {
      passwordFlowPageCount += 1;
      if ((page.securityTechnical?.authSurface?.csrfSignalCount ?? 0) === 0) {
        passwordFlowMissingCsrfCount += 1;
      }
    }
    if (page.securityTechnical?.hsts?.preloadReady) hstsPreloadReadyCount += 1;

    const missingHeaderLabels = (page.securityTechnical?.headers?.missing ?? []).map((entry) => entry.label);
    pageSecurityHighlights.push({
      url: page.finalUrl,
      usesHttps: Boolean(page.securityTechnical?.transport?.usesHttps),
      missingHeaders: missingHeaderLabels,
      weakHeaderCount: page.securityTechnical?.headers?.weak?.length ?? 0,
      unsafeTargetBlank: page.securityTechnical?.linksAndForms?.unsafeTargetBlankCount ?? 0,
      insecureLinks: page.securityTechnical?.linksAndForms?.insecureLinkCount ?? 0,
      insecureForms: page.securityTechnical?.linksAndForms?.insecureFormActionCount ?? 0,
      mixedContent: page.securityTechnical?.scriptSurface?.mixedContentCount ?? 0,
      scriptsWithoutSri: page.securityTechnical?.scriptSurface?.scriptsWithoutSriCount ?? 0,
      corsIssueCount: page.securityTechnical?.cors?.issues?.length ?? 0
    });
  }

  return {
    counts: totalCounts,
    pageCount: pages.length,
    colors: uniqueValues(colors, 12),
    fonts: uniqueValues(fonts, 8),
    components: uniqueValues(components, 12),
    ctaLabels: uniqueValues(ctaLabels, 12),
    trustLinks: uniqueValues(trustLinks, 12),
    headings: uniqueValues(headings, 14),
    navLabels: uniqueValues(navLabels, 12),
    buttonLabels: uniqueValues(buttonLabels, 12),
    notes: uniqueValues(notes, 12),
    highlightTerms: uniqueValues(highlightTerms, 12),
    executionModesUsed: uniqueValues(executionModesUsed, 4),
    trustSignals: {
      hasContactDetailsRate: Math.round((contactSignalCount / pages.length) * 100),
      hasTestimonialsRate: Math.round((testimonialSignalCount / pages.length) * 100),
      hasFaqRate: Math.round((faqSignalCount / pages.length) * 100),
      hasPolicyPagesRate: Math.round((policySignalCount / pages.length) * 100)
    },
    accessibility: {
      altCoverage: Math.round(average(altCoverageValues)),
      formLabelCoverage: Math.round(average(formLabelCoverageValues))
    },
    readability: {
      paragraphCount,
      longParagraphCount,
      wordCount,
      sentenceCount,
      avgParagraphWords: paragraphCount ? Math.round(wordCount / paragraphCount) : 0,
      avgWordsPerSentence: sentenceCount ? Math.round(wordCount / sentenceCount) : 0
    },
    structure: {
      headingJumpCount,
      complexForms
    },
    conversionFriction: {
      pagesWithoutClearCta,
      pagesWithLongCopy,
      pagesWithComplexForms,
      trustWeakPages
    },
    securityTechnical: {
      transport: {
        httpsPageCount,
        httpsCoverage: Math.round((httpsPageCount / pages.length) * 100),
        redirectedToHttpsCount,
        downgradedToHttpCount
      },
      headers: {
        missing: SECURITY_HEADER_RULES
          .map((rule) => ({
            key: rule.key,
            label: rule.label,
            impact: rule.impact,
            pages: missingHeaderCounts[rule.key] ?? 0
          }))
          .filter((entry) => entry.pages > 0)
          .sort((left, right) => right.pages - left.pages),
        presentCoverage: SECURITY_HEADER_RULES.map((rule) => ({
          key: rule.key,
          label: rule.label,
          pages: presentHeaderCounts[rule.key] ?? 0
        })),
        weak: Object.entries(weakHeaderIssueCounts)
          .map(([key, pages]) => {
            const [headerKey, issue] = key.split(":");
            return {
              key: headerKey,
              label: SECURITY_HEADER_RULES_BY_KEY[headerKey]?.label ?? headerKey,
              issue,
              pages
            };
          })
          .sort((left, right) => right.pages - left.pages)
      },
      cookies: {
        totalSetCookie,
        secureRate: totalSetCookie ? Math.round((secureCookieCount / totalSetCookie) * 100) : 100,
        httpOnlyRate: totalSetCookie ? Math.round((httpOnlyCookieCount / totalSetCookie) * 100) : 100,
        sameSiteRate: totalSetCookie ? Math.round((sameSiteCookieCount / totalSetCookie) * 100) : 100,
        issues: [...cookieIssues]
      },
      linksAndForms: {
        unsafeTargetBlankCount,
        insecureLinkCount,
        insecureFormActionCount
      },
      scriptSurface: {
        mixedContentCount,
        externalScriptCount,
        scriptsWithoutSriCount,
        inlineScriptCount,
        externalScriptHosts: [...externalScriptHosts].slice(0, 15)
      },
      cors: {
        riskyPageCount: corsRiskPageCount
      },
      cachePolicy: {
        riskyPageCount: cacheRiskPageCount
      },
      authSurface: {
        passwordFlowPageCount,
        passwordFlowMissingCsrfCount
      },
      hsts: {
        preloadReadyCount: hstsPreloadReadyCount
      },
      pageHighlights: pageSecurityHighlights.slice(0, 10)
    }
  };
}

function buildInteractions(aggregate) {
  const signals = [
    ...aggregate.ctaLabels.slice(0, 5).map((label) => `Customer action: ${label}`),
    ...aggregate.navLabels.slice(0, 3).map((label) => `Navigation label: ${label}`),
    ...aggregate.trustLinks.slice(0, 3).map((label) => `Trust cue: ${label}`)
  ];
  if (!signals.length) signals.push("Few obvious customer actions are visible in the scanned pages.");
  return signals.slice(0, 8);
}

function buildPrioritizedActions(aggregate) {
  const actions = [];

  if (aggregate.ctaLabels.length === 0) {
    actions.push({
      title: "Make the primary next step unmistakable",
      detail: "Several scanned pages lacked a clear action. Add a consistent primary button near the top of key pages.",
      impact: "high",
      effort: "medium",
      confidence: 0.84
    });
  }

  if (aggregate.trustLinks.length < 3) {
    actions.push({
      title: "Place trust signals where customers decide",
      detail: "Privacy, support, and policy links are hard to find. Surface them near pricing and sign-up actions.",
      impact: "high",
      effort: "low",
      confidence: 0.79
    });
  }

  if (aggregate.accessibility.altCoverage < 75 || aggregate.accessibility.formLabelCoverage < 75) {
    actions.push({
      title: "Make images and form fields easier to understand",
      detail: `Images and form fields are described ${Math.min(100, aggregate.accessibility.altCoverage)}% and ${Math.min(100, aggregate.accessibility.formLabelCoverage)}% of the time. Aim for consistent descriptions on every key page.`,
      impact: "medium",
      effort: "medium",
      confidence: 0.81
    });
  }

  if (aggregate.readability.longParagraphCount > 2 || aggregate.readability.avgWordsPerSentence > 24) {
    actions.push({
      title: "Break dense sections into scannable chunks",
      detail: "Long paragraphs make it harder to find key points. Use shorter sections, bullets, and bold cues to guide attention.",
      impact: "medium",
      effort: "low",
      confidence: 0.72
    });
  }

  if (aggregate.structure.headingJumpCount > 0) {
    actions.push({
      title: "Keep headings in a clear order",
      detail: "Some sections jump between heading sizes. A consistent structure helps customers follow the story.",
      impact: "medium",
      effort: "low",
      confidence: 0.76
    });
  }

  if (!actions.length) {
    actions.push({
      title: "Protect what is already working",
      detail: "The main signals look solid. Focus on small experiments on high-traffic pages to raise conversions.",
      impact: "low",
      effort: "low",
      confidence: 0.68
    });
  }

  const impactScore = { high: 3, medium: 2, low: 1 };
  actions.sort((a, b) => {
    const left = impactScore[a.impact] * a.confidence;
    const right = impactScore[b.impact] * b.confidence;
    return right - left;
  });

  return actions.slice(0, 5);
}

function createCssVarSegment(value, index) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  if (!normalized) return `token-${index + 1}`;
  return normalized;
}

function buildImplementationSnippets(aggregate) {
  const colors = aggregate.colors.slice(0, 6);
  const fonts = aggregate.fonts.slice(0, 3);
  const components = aggregate.components.slice(0, 6);

  const colorLines = colors.length
    ? colors.map((color, index) => `  --brand-color-${index + 1}: ${color};`)
    : [
      "  --brand-color-1: #6ca8ff;",
      "  --brand-color-2: #7cf5d4;"
    ];
  const fontLines = fonts.length
    ? fonts.map((font, index) => `  --brand-font-${index + 1}: ${font};`)
    : ["  --brand-font-1: 'Segoe UI', sans-serif;"];
  const utilityLines = components.length
    ? components.map((component, index) => {
      const segment = createCssVarSegment(component, index);
      return `.ui-${segment} { /* map styles for ${component} */ }`;
    })
    : [".ui-panel { border-radius: 24px; }"];

  const code = [
    ":root {",
    ...colorLines,
    ...fontLines,
    "}",
    "",
    ".brand-surface {",
    "  background: linear-gradient(180deg, rgba(18, 24, 52, 0.88), rgba(10, 14, 33, 0.76));",
    "  border: 1px solid rgba(255, 255, 255, 0.1);",
    "  box-shadow: 0 20px 80px rgba(5, 8, 22, 0.32);",
    "}",
    "",
    ...utilityLines
  ].join("\\n");

  return [
    {
      id: "ui-style-foundation-css",
      title: "Style foundation starter",
      description: "Starter CSS generated from extracted style tokens for engineering implementation.",
      language: "css",
      code
    }
  ];
}

const BUG_CODE_MAP = {
  FETCH_HTTP_404: {
    issue: "Broken page link",
    detail: "This page returned a 'not found' response (HTTP 404). Visitors and search engines following a link here will hit a dead end.",
    remediation: "Find the links pointing to this URL, then either restore the page, fix the link, or redirect it to the right destination.",
    severity: "high",
    confidence: "confirmed"
  },
  FETCH_HTTP_403: {
    issue: "Page blocked access",
    detail: "This page refused access to the scanner (HTTP 403 — Forbidden). Visitors without the right credentials would see the same block.",
    remediation: "If this page should be public, check your server access rules and authentication settings. If it's intentionally restricted, no action needed.",
    severity: "medium",
    confidence: "confirmed"
  },
  FETCH_HTTP_500: {
    issue: "Server error on this page",
    detail: "This page returned a server error (HTTP 500). This is a technical failure on your server that visitors would also experience.",
    remediation: "Check your server logs for errors around this URL and fix the underlying server-side issue.",
    severity: "high",
    confidence: "confirmed"
  },
  FETCH_HTTP_503: {
    issue: "Page temporarily unavailable",
    detail: "This page was unavailable at the time of the scan (HTTP 503 — Service Unavailable). It may be a temporary outage or deliberate maintenance.",
    remediation: "If this is persistent, check your server health and any maintenance windows. Add a helpful message for visitors if the page will be down for a while.",
    severity: "medium",
    confidence: "confirmed"
  },
  TIME_BUDGET_EXCEEDED: {
    issue: "Scan did not reach all pages",
    detail: "The scan reached its time limit before it could check all queued pages. Some pages may not have been analyzed.",
    remediation: "This is not a site issue — consider running a more targeted scan to cover these pages individually.",
    severity: "low",
    confidence: "possible"
  },
  UNKNOWN_PAGE_FAILURE: {
    issue: "Page could not be loaded",
    detail: "An unexpected error prevented this page from loading during the scan. Visitors may encounter the same problem.",
    remediation: "Open the URL in a browser and in a private window to confirm whether it loads correctly. Check server logs if it doesn't.",
    severity: "medium",
    confidence: "likely"
  }
};

function buildBugsReliability(scanData) {
  const bugs = [];

  for (const error of scanData.crawl.errors) {
    const code = error.code ?? "UNKNOWN_PAGE_FAILURE";
    // Normalize HTTP error codes like FETCH_HTTP_404 → lookup; fallback for unmapped HTTP codes
    const knownEntry = BUG_CODE_MAP[code];
    if (knownEntry) {
      bugs.push({ page: error.url, ...knownEntry });
    } else if (code.startsWith("FETCH_HTTP_")) {
      const httpStatus = code.replace("FETCH_HTTP_", "");
      bugs.push({
        page: error.url,
        issue: `Page returned an error (${httpStatus})`,
        detail: `This page responded with HTTP ${httpStatus}. Depending on the status, visitors may see an error or be unable to reach the page.`,
        remediation: "Open the page in a browser to confirm what visitors see, and investigate your server configuration or content for this URL.",
        severity: Number(httpStatus) >= 500 ? "high" : "medium",
        confidence: "confirmed"
      });
    } else {
      bugs.push({
        page: error.url,
        issue: "Page could not be loaded",
        detail: error.message ?? "An error prevented this page from being analyzed.",
        remediation: "Open the URL in a browser to confirm whether it loads correctly for visitors.",
        severity: "medium",
        confidence: "possible"
      });
    }
  }

  const bugCount = bugs.length;
  let summary;
  if (bugCount === 0) {
    summary = "No broken pages or crawl errors were found in the scanned pages.";
  } else if (bugCount === 1) {
    summary = "1 page issue was found during the scan.";
  } else {
    summary = `${bugCount} page issues were found during the scan.`;
  }

  return { summary, bugCount, bugs };
}

function buildSecurityRecommendations(aggregate, scanData) {
  const actions = [];
  const missingHeaders = aggregate.securityTechnical.headers.missing;
  const highImpactMissing = missingHeaders.filter((entry) => entry.impact === "high");

  if (aggregate.securityTechnical.transport.httpsCoverage < 100) {
    actions.push({
      title: "Protect visitors from unencrypted connections",
      detail: `${100 - aggregate.securityTechnical.transport.httpsCoverage}% of scanned pages loaded over HTTP instead of HTTPS. Visitors on those pages are exposed to eavesdropping and data interception. Switch all pages to HTTPS and set up a redirect from HTTP to HTTPS.`,
      impact: "high"
    });
  }

  if (highImpactMissing.length > 0) {
    actions.push({
      title: "Close the gaps that leave browsers unguarded",
      detail: `${highImpactMissing.length} critical browser protection${highImpactMissing.length === 1 ? "" : "s"} ${highImpactMissing.length === 1 ? "is" : "are"} missing: ${highImpactMissing.slice(0, 3).map((e) => e.label).join(", ")}. Without these, browsers make unsafe assumptions about your content — increasing the risk of script injection, clickjacking, and data leakage for every visitor.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount > 0) {
    actions.push({
      title: "Stop new-tab links from exposing visitor sessions",
      detail: `${aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount} link${aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount === 1 ? "" : "s"} open in a new tab without the safety attributes that prevent the destination page from accessing your site's context. Add rel="noopener noreferrer" to all target="_blank" links.`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.linksAndForms.insecureFormActionCount > 0) {
    actions.push({
      title: "Stop form data being sent in plain text",
      detail: `${aggregate.securityTechnical.linksAndForms.insecureFormActionCount} form${aggregate.securityTechnical.linksAndForms.insecureFormActionCount === 1 ? "" : "s"} submit data over HTTP, meaning anything visitors type — including personal details — can be intercepted in transit. Update all form action URLs to HTTPS.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.scriptSurface.mixedContentCount > 0) {
    actions.push({
      title: "Remove insecure content from secure pages",
      detail: `${aggregate.securityTechnical.scriptSurface.mixedContentCount} asset${aggregate.securityTechnical.scriptSurface.mixedContentCount === 1 ? "" : "s"} load over HTTP on pages that use HTTPS. This mixed content weakens the security of the whole page and can trigger browser warnings that erode visitor trust. Update all asset URLs to HTTPS.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount > 0) {
    actions.push({
      title: "Guard against tampered third-party scripts",
      detail: `${aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount} external script${aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount === 1 ? "" : "s"} load without integrity checks. If any of those third-party servers were compromised, malicious code could silently run on your site for every visitor. Add integrity and crossorigin attributes to external scripts.`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.cors.riskyPageCount > 0) {
    actions.push({
      title: "Restrict which other sites can read your data",
      detail: `${aggregate.securityTechnical.cors.riskyPageCount} page${aggregate.securityTechnical.cors.riskyPageCount === 1 ? "" : "s"} have overly open cross-origin access rules. This could allow other websites to silently request and read your content or API responses on behalf of visitors. Scope your Access-Control-Allow-Origin header to trusted domains only.`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount > 0) {
    actions.push({
      title: "Defend sign-in pages from cross-site request attacks",
      detail: `${aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount} sign-in page${aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount === 1 ? "" : "s"} had no visible protection against cross-site request forgery. Without CSRF tokens, a malicious site could trick a logged-in visitor into performing unwanted actions on their account. Add CSRF token fields to all authentication forms.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.cookies.totalSetCookie > 0) {
    if (
      aggregate.securityTechnical.cookies.secureRate < 100 ||
      aggregate.securityTechnical.cookies.httpOnlyRate < 100 ||
      aggregate.securityTechnical.cookies.sameSiteRate < 100
    ) {
      actions.push({
        title: "Reduce the risk of session theft via cookies",
        detail: `Cookies are set without full security flags: ${aggregate.securityTechnical.cookies.secureRate}% are HTTPS-only, ${aggregate.securityTechnical.cookies.httpOnlyRate}% are hidden from JavaScript, ${aggregate.securityTechnical.cookies.sameSiteRate}% are protected from cross-site requests. Cookies without these flags can be stolen or misused, exposing visitor sessions. Set Secure, HttpOnly, and SameSite=Strict (or Lax) on all cookies that don't need cross-site access.`,
        impact: "medium"
      });
    }
  }

  if (scanData.crawl.errors.length > 0) {
    actions.push({
      title: "Investigate pages the scan couldn't reach",
      detail: `${scanData.crawl.errors.length} page${scanData.crawl.errors.length === 1 ? "" : "s"} could not be loaded during the scan. These pages were not analyzed for security issues and may have problems visitors would also encounter. See the Bugs & Reliability section for details.`,
      impact: "low"
    });
  }

  if (!actions.length) {
    actions.push({
      title: "Maintain current protection level",
      detail: "No major security gaps were detected in the scanned pages. Keep your security headers, cookie flags, and HTTPS setup up to date as your site evolves.",
      impact: "low"
    });
  }

  const impactOrder = { high: 3, medium: 2, low: 1 };
  return actions.sort((left, right) => impactOrder[right.impact] - impactOrder[left.impact]).slice(0, 6);
}

function computeSecurityPostureScore(aggregate) {
  const highMissingCount = aggregate.securityTechnical.headers.missing.filter((entry) => entry.impact === "high").length;
  const mediumMissingCount = aggregate.securityTechnical.headers.missing.filter((entry) => entry.impact === "medium").length;

  const penalty =
    (100 - aggregate.securityTechnical.transport.httpsCoverage) * 0.2 +
    highMissingCount * 8 +
    mediumMissingCount * 5 +
    aggregate.securityTechnical.headers.weak.length * 4 +
    aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount * 1.5 +
    aggregate.securityTechnical.linksAndForms.insecureFormActionCount * 3 +
    aggregate.securityTechnical.linksAndForms.insecureLinkCount * 1 +
    aggregate.securityTechnical.scriptSurface.mixedContentCount * 1.5 +
    aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount * 1 +
    aggregate.securityTechnical.cors.riskyPageCount * 1.5 +
    aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount * 2;

  return scoreWithinRange(Math.round(98 - penalty));
}

function buildFindings(input, aggregate, siteName, scanData) {
  const clarityDetail = aggregate.counts.headings
    ? `${siteName} presents clear section structure across ${aggregate.pageCount} page${aggregate.pageCount === 1 ? "" : "s"}, helping customers scan quickly.`
    : `${siteName} lacks obvious section structure on key pages, which can make it harder to understand at a glance.`;

  const trustDetail = aggregate.trustLinks.length || aggregate.trustSignals.hasContactDetailsRate > 0
    ? `Trust signals appear on some pages (${aggregate.trustLinks.slice(0, 3).join(", ") || "support links"}), but they are not consistently visible.`
    : "Trust signals like privacy, support, or contact details are difficult to find on the scanned pages.";

  const conversionDetail = aggregate.ctaLabels.length
    ? `Primary actions are visible (${aggregate.ctaLabels.slice(0, 4).join(", ")}), giving customers a next step on most pages.`
    : "Clear primary actions are missing on key pages, which can slow customer decisions.";

  const crawlDetail = `Reviewed ${scanData.crawl.pagesScanned} page${scanData.crawl.pagesScanned === 1 ? "" : "s"} (of ${scanData.crawl.requestedPageLimit}) to depth ${scanData.crawl.maxReachedDepth}.`;

  return [
    {
      title: "First impression clarity",
      detail: clarityDetail,
      severity: aggregate.counts.headings > 0 && aggregate.readability.longParagraphCount <= 3 ? "low" : "medium"
    },
    {
      title: "Trust and reassurance",
      detail: trustDetail,
      severity: aggregate.trustLinks.length >= 3 || aggregate.trustSignals.hasContactDetailsRate > 30 ? "low" : "high"
    },
    {
      title: "Next-step clarity",
      detail: conversionDetail,
      severity: aggregate.ctaLabels.length > 0 ? "low" : "high"
    },
    {
      title: "Crawl coverage",
      detail: crawlDetail,
      severity: scanData.crawl.pagesScanned >= Math.max(1, Math.floor(scanData.crawl.requestedPageLimit * 0.6)) ? "low" : "medium"
    },
    {
      title: "Accessibility comfort",
      detail: `Images and form fields are described ${aggregate.accessibility.altCoverage}% and ${aggregate.accessibility.formLabelCoverage}% of the time.`,
      severity: aggregate.accessibility.altCoverage >= 75 && aggregate.accessibility.formLabelCoverage >= 75 ? "low" : "medium"
    }
  ];
}

function buildExecutiveSummary(siteName, aggregate, scores, prioritizedActions) {
  const clarityScore = scores.find((score) => score.label === "Message clarity")?.value ?? 0;
  const trustScore = scores.find((score) => score.label === "Trust confidence")?.value ?? 0;
  const actionScore = scores.find((score) => score.label === "Action readiness")?.value ?? 0;
  const accessibilityScore = scores.find((score) => score.label === "Accessibility comfort")?.value ?? 0;

  const highlights = [
    `Clarity score ${clarityScore}/100 with ${aggregate.counts.headings} headings across ${aggregate.pageCount} page${aggregate.pageCount === 1 ? "" : "s"}.`,
    `Trust visibility ${trustScore}/100 with ${aggregate.trustLinks.length} trust cues and ${aggregate.trustSignals.hasContactDetailsRate}% contact coverage.`,
    `Action readiness ${actionScore}/100 with ${aggregate.ctaLabels.length} action labels and ${aggregate.counts.forms} forms.`
  ];
  const risks = [];
  if (aggregate.ctaLabels.length === 0) risks.push("Primary next steps are not clear on key pages.");
  if (aggregate.trustLinks.length < 2) risks.push("Trust details are not consistently visible near decisions.");
  if (aggregate.accessibility.altCoverage < 75 || aggregate.accessibility.formLabelCoverage < 75) {
    risks.push("Images or form fields are missing descriptions in several areas.");
  }
  if (!risks.length) risks.push("No major customer-facing risks were detected in this pass.");

  const opportunities = prioritizedActions.slice(0, 3).map((action) => action.title);

  return {
    headline: `${siteName} has a clear foundation with focused opportunities to lift trust and conversion confidence.`,
    highlights,
    risks,
    opportunities
  };
}

function buildOpportunityMap(prioritizedActions) {
  const quickWins = prioritizedActions
    .filter((action) => action.effort === "low")
    .map((action) => action.title);
  const mediumTerm = prioritizedActions
    .filter((action) => action.effort === "medium")
    .map((action) => action.title);
  const bigBets = prioritizedActions
    .filter((action) => action.effort === "high")
    .map((action) => action.title);

  return {
    quickWins: quickWins.length ? quickWins : prioritizedActions.slice(0, 2).map((action) => action.title),
    mediumTerm: mediumTerm.length ? mediumTerm : prioritizedActions.slice(2, 4).map((action) => action.title),
    bigBets: bigBets.length ? bigBets : prioritizedActions.slice(4, 5).map((action) => action.title)
  };
}

function deriveSiteName(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname
      .split(".")
      .slice(0, 2)
      .join(" ")
      .replace(/(^\w|[-_ ]\w)/g, (match) => match.toUpperCase())
      .trim();
  } catch {
    return "Website Review";
  }
}

function buildNarrativePrompt(report) {
  const topFindings = (report.findings ?? [])
    .slice(0, 5)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`)
    .join("\n");
  const topActions = (report.prioritizedActions ?? [])
    .slice(0, 3)
    .map((a) => `- ${a.title} (impact: ${a.impact}, effort: ${a.effort}): ${a.detail}`)
    .join("\n");
  const scores = (report.scores ?? [])
    .map((s) => `${s.label}: ${s.value}/100 (${s.trend})`)
    .join(", ");
  const securityGaps = (report.securityTechnical?.headers?.missing ?? [])
    .slice(0, 3)
    .map((h) => h.label)
    .join(", ");

  return `You are reviewing a website called "${report.siteName}".
Scan covered ${report.source?.crawl?.pagesScanned ?? 1} page(s).

SCORES: ${scores}

TOP ISSUES:
${topFindings || "No major issues flagged."}

TOP ACTIONS:
${topActions || "No specific actions recommended."}

SECURITY GAPS: ${securityGaps || "None detected"}

Respond with a JSON object (no markdown) with exactly these keys:
{
  "executiveSummary": "2-3 sentence plain-language overview of the site's overall quality, written for a non-technical business owner",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "topActions": ["action 1", "action 2", "action 3"],
  "encouragements": ["positive highlight 1"]
}
Be specific to this site. Avoid jargon. Use plain English. Be honest but encouraging.`;
}

async function enrichWithAINarrative(report) {
  if (process.env.AI_NARRATIVE_ENABLED !== "true") return null;
  if (!process.env.GROQ_API_KEY) return null;

  const GroqSdk = getGroqSdk();
  if (!GroqSdk) {
    console.warn("[AI] groq-sdk not installed — skipping AI narrative");
    return null;
  }

  if (!_groqRateLimiter.isAllowed(GROQ_RATE_LIMIT_RPM)) {
    console.warn("[AI] Groq rate limit reached — skipping AI narrative for this scan");
    return null;
  }

  const prompt = buildNarrativePrompt(report);
  try {
    const Groq = GroqSdk.default ?? GroqSdk;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a plain-language web quality advisor. Convert technical scan data into clear, helpful insights for a non-technical website owner. Be specific, honest, and encouraging. Never use jargon. Respond only with valid JSON — no markdown, no code fences."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: readOptionalPositiveInteger(process.env.GROQ_MAX_TOKENS) ?? 800,
      response_format: { type: "json_object" }
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary : "",
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.slice(0, 5) : [],
      topActions: Array.isArray(parsed.topActions) ? parsed.topActions.slice(0, 3) : [],
      encouragements: Array.isArray(parsed.encouragements) ? parsed.encouragements.slice(0, 2) : [],
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    console.warn("[AI] Groq enrichment failed (non-fatal):", err.message);
    return null;
  }
}

function buildReport(input, scanData) {
  const aggregate = aggregatePages(scanData);
  const siteName = deriveSiteName(input.url);
  const sizeDetails = getSizeDetails(input.scanSize);
  const focusDetails = getFocusDetails(input.focusArea);
  const prioritizedActions = buildPrioritizedActions(aggregate);
  const securityRecommendations = buildSecurityRecommendations(aggregate, scanData);
  const securityPostureScore = computeSecurityPostureScore(aggregate);
  const bugsReliability = buildBugsReliability(scanData);
  const pagesScanned = scanData.crawl.pagesScanned;
  const pagesAttempted = scanData.crawl.pagesAttempted;
  const blockedByRobots = scanData.crawl.blockedByRobots;
  const coverageScore = {
    pagesScanned,
    pagesAttempted,
    blockedByRobots,
    label: pagesScanned >= pagesAttempted && blockedByRobots === 0
      ? "Full coverage"
      : blockedByRobots > 0
        ? "Partial — some pages blocked by robots.txt"
        : "Partial — time or page limit reached"
  };

  const clarityScore = scoreWithinRange(
    42 +
    Math.round((aggregate.counts.headings / aggregate.pageCount) * 5) +
    Math.min(aggregate.readability.paragraphCount, 20) -
    aggregate.structure.headingJumpCount * 3 -
    Math.floor(aggregate.readability.longParagraphCount * 1.5)
  );
  const trustScore = scoreWithinRange(
    40 +
    aggregate.trustLinks.length * 6 +
    Math.round(aggregate.trustSignals.hasContactDetailsRate * 0.2) +
    Math.round(aggregate.trustSignals.hasTestimonialsRate * 0.15) +
    Math.round(aggregate.trustSignals.hasFaqRate * 0.12)
  );
  const actionScore = scoreWithinRange(
    38 +
    aggregate.ctaLabels.length * 8 +
    Math.floor(aggregate.counts.buttons * 0.4) +
    Math.floor(aggregate.counts.forms * 1.5) -
    aggregate.structure.complexForms * 4
  );
  const accessibilityScore = scoreWithinRange(
    35 +
    Math.round(aggregate.accessibility.altCoverage * 0.3) +
    Math.round(aggregate.accessibility.formLabelCoverage * 0.35)
  );

  const primaryPage = scanData.pages[0];
  const crawlNotes = [
    ...scanData.crawl.robots.notes,
    ...(scanData.crawl.errors.length
      ? [`${scanData.crawl.errors.length} page-level error(s) occurred during crawling.`]
      : []),
    ...(scanData.crawl.blockedByRobots > 0
      ? [`${scanData.crawl.blockedByRobots} URL(s) were skipped due to robots.txt.`]
      : [])
  ];

  const scores = [
    {
      label: "Message clarity",
      value: clarityScore,
      trend: `${aggregate.counts.headings} headings across ${aggregate.pageCount} pages`
    },
    {
      label: "Trust confidence",
      value: trustScore,
      trend: `${aggregate.trustLinks.length} trust cues, contact coverage ${aggregate.trustSignals.hasContactDetailsRate}%`
    },
    {
      label: "Action readiness",
      value: actionScore,
      trend: `${aggregate.ctaLabels.length} CTA labels, ${aggregate.counts.forms} forms`
    },
    {
      label: "Accessibility comfort",
      value: accessibilityScore,
      trend: `Image labels ${aggregate.accessibility.altCoverage}%, form labels ${aggregate.accessibility.formLabelCoverage}%`
    },
    {
      label: "Security posture",
      value: securityPostureScore,
      trend: `${aggregate.securityTechnical.headers.missing.length} protection gaps flagged`
    }
  ];

  return {
    reportVersion: "2026-03-executive-v1",
    siteName,
    scannedAt: new Date().toISOString(),
    scope: sizeDetails.scope,
    summary: `This review covered ${scanData.crawl.pagesScanned} page${scanData.crawl.pagesScanned === 1 ? "" : "s"} from ${new URL(input.url).origin} with a depth budget of ${scanData.crawl.maxDepth}. It focuses on customer clarity, trust, and conversion confidence, supported by security checks.`,
    scores,
    tokenGroups: [
      {
        label: "Customer actions detected",
        values: aggregate.ctaLabels.length
          ? aggregate.ctaLabels
          : ["No strong CTA label found in the scanned pages"]
      },
      {
        label: "Trust signals detected",
        values: [
          ...aggregate.trustLinks.slice(0, 6),
          `Contact details coverage: ${aggregate.trustSignals.hasContactDetailsRate}%`,
          `Testimonials coverage: ${aggregate.trustSignals.hasTestimonialsRate}%`
        ]
      },
      {
        label: "Top recommendations",
        values: prioritizedActions.map((action) => action.title)
      },
      {
        label: "Review setup",
        values: [
          sizeDetails.detail,
          input.loginMode,
          focusDetails.checks[0],
          `Up to ${sizeDetails.pageLimit} page${sizeDetails.pageLimit === 1 ? "" : "s"}`
        ]
      }
    ],
    prioritizedActions,
    findings: buildFindings(input, aggregate, siteName, scanData),
    components: aggregate.components.length
      ? aggregate.components
      : [...focusDetails.components, "Customer trust cues", "Primary action blocks"],
    interactions: buildInteractions(aggregate),
    executiveSummary: buildExecutiveSummary(siteName, aggregate, scores, prioritizedActions),
    opportunityMap: buildOpportunityMap(prioritizedActions),
    uiStyle: {
      summary: `UI analysis covers visual tokens, typography, content clarity, and interaction intent across ${aggregate.pageCount} scanned pages.`,
      styleTokens: {
        colors: aggregate.colors,
        fonts: aggregate.fonts,
        components: aggregate.components,
        highlightWords: aggregate.highlightTerms
      },
      implementationSnippets: buildImplementationSnippets(aggregate),
      contentClarity: {
        headingCount: aggregate.counts.headings,
        headingExamples: aggregate.headings.slice(0, 10),
        avgParagraphWords: aggregate.readability.avgParagraphWords,
        longParagraphCount: aggregate.readability.longParagraphCount
      },
      interactionSignals: {
        ctaLabels: aggregate.ctaLabels,
        navLabels: aggregate.navLabels,
        buttonLabels: aggregate.buttonLabels
      },
      prioritizedActions
    },
    securityTechnical: {
      summary: `Security and technical review covers transport security, response headers, cookie flags, link/form safety, script supply-chain exposure, CORS/cache policy, and auth-surface hardening signals.`,
      postureScore: securityPostureScore,
      transport: {
        httpsCoverage: aggregate.securityTechnical.transport.httpsCoverage,
        redirectedToHttpsCount: aggregate.securityTechnical.transport.redirectedToHttpsCount,
        downgradedToHttpCount: aggregate.securityTechnical.transport.downgradedToHttpCount,
        requestedExecutionMode: scanData.crawl.requestedExecutionMode,
        executionMode: scanData.crawl.executionMode,
        modeFallbackUsed: scanData.crawl.modeFallbackUsed
      },
      headers: {
        missing: aggregate.securityTechnical.headers.missing,
        weak: aggregate.securityTechnical.headers.weak,
        presentCoverage: aggregate.securityTechnical.headers.presentCoverage
      },
      cookies: aggregate.securityTechnical.cookies,
      linksAndForms: aggregate.securityTechnical.linksAndForms,
      scriptSurface: aggregate.securityTechnical.scriptSurface,
      cors: aggregate.securityTechnical.cors,
      cachePolicy: aggregate.securityTechnical.cachePolicy,
      authSurface: aggregate.securityTechnical.authSurface,
      hsts: aggregate.securityTechnical.hsts,
      crawlDiagnostics: {
        blockedByRobots: scanData.crawl.blockedByRobots,
        pageErrors: scanData.crawl.errors.length,
        notes: uniqueValues(crawlNotes, 10)
      },
      pageHighlights: aggregate.securityTechnical.pageHighlights,
      recommendations: securityRecommendations
    },
    bugsReliability,
    coverageScore,
    performanceSummary: (() => {
      const pagesWithTiming = scanData.pages.filter((p) => typeof p.fetchMs === "number");
      if (!pagesWithTiming.length) return undefined;
      const avg = Math.round(pagesWithTiming.reduce((s, p) => s + p.fetchMs, 0) / pagesWithTiming.length);
      const slowest = pagesWithTiming.reduce((s, p) => (p.fetchMs > s.fetchMs ? p : s));
      return {
        avgFetchMs: avg,
        slowestPageMs: slowest.fetchMs,
        slowestPageUrl: slowest.finalUrl,
        totalResourcesEstimate: pagesWithTiming.reduce(
          (s, p) => s + (p.scriptCount ?? 0) + (p.imageCount ?? 0),
          0
        )
      };
    })(),
    source: {
      finalUrl: primaryPage.finalUrl,
      statusCode: primaryPage.statusCode,
      pageTitle: primaryPage.pageTitle,
      metaDescription: primaryPage.metaDescription,
      headingCount: aggregate.counts.headings,
      linkCount: aggregate.counts.links,
      buttonCount: aggregate.counts.buttons,
      formCount: aggregate.counts.forms,
      imageCount: aggregate.counts.images,
      colors: aggregate.colors,
      fonts: aggregate.fonts,
      notes: uniqueValues([...aggregate.notes, ...crawlNotes], 14),
      crawl: {
        pagesScanned: scanData.crawl.pagesScanned,
        pagesAttempted: scanData.crawl.pagesAttempted,
        blockedByRobots: scanData.crawl.blockedByRobots,
        maxDepth: scanData.crawl.maxDepth,
        maxReachedDepth: scanData.crawl.maxReachedDepth,
        durationMs: scanData.crawl.durationMs,
        requestedExecutionMode: scanData.crawl.requestedExecutionMode,
        executionMode: scanData.crawl.executionMode,
        modeFallbackUsed: scanData.crawl.modeFallbackUsed
      },
      pages: scanData.pages.slice(0, 10).map((page) => ({
        url: page.finalUrl,
        pageTitle: page.pageTitle,
        statusCode: page.statusCode,
        ctaCount: page.ctaLabels.length,
        trustSignalCount: page.trustSignals.trustLinks.length
      })),
      customerSignals: {
        ctaLabels: aggregate.ctaLabels,
        trustSignals: aggregate.trustLinks,
        highlightWords: aggregate.highlightTerms,
        trustCoverage: {
          hasContactDetailsRate: aggregate.trustSignals.hasContactDetailsRate,
          hasTestimonialsRate: aggregate.trustSignals.hasTestimonialsRate,
          hasFaqRate: aggregate.trustSignals.hasFaqRate,
          hasPolicyPagesRate: aggregate.trustSignals.hasPolicyPagesRate
        },
        readability: {
          paragraphCount: aggregate.readability.paragraphCount,
          avgParagraphWords: aggregate.readability.avgParagraphWords,
          longParagraphCount: aggregate.readability.longParagraphCount,
          avgWordsPerSentence: aggregate.readability.avgWordsPerSentence
        },
        accessibility: {
          altCoverage: aggregate.accessibility.altCoverage,
          formLabelCoverage: aggregate.accessibility.formLabelCoverage
        },
        structure: {
          headingJumpCount: aggregate.structure.headingJumpCount
        },
        forms: {
          complexForms: aggregate.structure.complexForms
        },
        conversionFriction: {
          pagesWithoutClearCta: aggregate.conversionFriction.pagesWithoutClearCta,
          pagesWithLongCopy: aggregate.conversionFriction.pagesWithLongCopy,
          pagesWithComplexForms: aggregate.conversionFriction.pagesWithComplexForms,
          trustWeakPages: aggregate.conversionFriction.trustWeakPages
        }
      }
    }
  };
}

module.exports = {
  extractScanData,
  buildReport,
  enrichWithAINarrative,
  ScanProcessingError,
  __testables: {
    evaluateSecurityHeaders,
    analyzeSetCookieHeaders,
    assessLinkAndFormHardening,
    assessScriptSurface,
    assessCorsPolicy,
    assessCachePolicy,
    assessAuthSurface,
    getSizeDetails,
    buildImplementationSnippets,
    computeSecurityPostureScore
  }
};
