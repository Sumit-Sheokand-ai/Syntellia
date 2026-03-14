const cheerio = require("cheerio");
const dns = require("node:dns/promises");
const net = require("node:net");

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
  { key: "content-security-policy", label: "Content-Security-Policy", impact: "high" },
  { key: "strict-transport-security", label: "Strict-Transport-Security", impact: "high" },
  { key: "x-frame-options", label: "X-Frame-Options", impact: "high" },
  { key: "x-content-type-options", label: "X-Content-Type-Options", impact: "medium" },
  { key: "referrer-policy", label: "Referrer-Policy", impact: "medium" },
  { key: "permissions-policy", label: "Permissions-Policy", impact: "medium" },
  { key: "cross-origin-opener-policy", label: "Cross-Origin-Opener-Policy", impact: "medium" },
  { key: "cross-origin-resource-policy", label: "Cross-Origin-Resource-Policy", impact: "low" }
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
  return sizeConfig[scanSize] ?? sizeConfig["Standard review"];
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
      const page = await extractSinglePage(current.url, {
        requestedMode,
        rootOrigin
      });
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
      title: "Clarify one primary call-to-action on key pages",
      detail: "Several scanned pages lacked clear action labels. Add a consistent primary CTA above the fold.",
      impact: "high",
      effort: "medium",
      confidence: 0.84
    });
  }

  if (aggregate.trustLinks.length < 3) {
    actions.push({
      title: "Improve trust visibility near conversion points",
      detail: "Trust links (privacy, terms, support/contact) are sparse. Surface reassurance closer to decision points.",
      impact: "high",
      effort: "low",
      confidence: 0.79
    });
  }

  if (aggregate.accessibility.altCoverage < 75 || aggregate.accessibility.formLabelCoverage < 75) {
    actions.push({
      title: "Raise accessibility baseline for images and forms",
      detail: `Average alt coverage is ${aggregate.accessibility.altCoverage}% and form label coverage is ${aggregate.accessibility.formLabelCoverage}%.`,
      impact: "medium",
      effort: "medium",
      confidence: 0.81
    });
  }

  if (aggregate.readability.longParagraphCount > 2 || aggregate.readability.avgWordsPerSentence > 24) {
    actions.push({
      title: "Reduce copy density for faster scanning",
      detail: "Long paragraphs and dense sentence structure can hide value. Break content into shorter, scannable blocks.",
      impact: "medium",
      effort: "low",
      confidence: 0.72
    });
  }

  if (aggregate.structure.headingJumpCount > 0) {
    actions.push({
      title: "Fix heading hierarchy jumps",
      detail: "Heading level skips were detected. Consistent hierarchy improves comprehension and accessibility.",
      impact: "medium",
      effort: "low",
      confidence: 0.76
    });
  }

  if (!actions.length) {
    actions.push({
      title: "Preserve current clarity and trust baseline",
      detail: "Current signals look healthy. Prioritize incremental conversion experiments on high-traffic pages.",
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

function buildSecurityRecommendations(aggregate, scanData) {
  const actions = [];
  const missingHeaders = aggregate.securityTechnical.headers.missing;
  const highImpactMissing = missingHeaders.filter((entry) => entry.impact === "high");

  if (aggregate.securityTechnical.transport.httpsCoverage < 100) {
    actions.push({
      title: "Enforce HTTPS across all scanned pages",
      detail: `Only ${aggregate.securityTechnical.transport.httpsCoverage}% of scanned pages resolved over HTTPS.`,
      impact: "high"
    });
  }

  if (highImpactMissing.length > 0) {
    actions.push({
      title: "Add missing high-impact security headers",
      detail: highImpactMissing
        .slice(0, 3)
        .map((entry) => `${entry.label} (missing on ${entry.pages} page${entry.pages === 1 ? "" : "s"})`)
        .join(", "),
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount > 0) {
    actions.push({
      title: "Harden external links opened in new tabs",
      detail: `${aggregate.securityTechnical.linksAndForms.unsafeTargetBlankCount} link(s) use target=_blank without rel=noopener/noreferrer.`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.linksAndForms.insecureFormActionCount > 0) {
    actions.push({
      title: "Remove HTTP form submission paths",
      detail: `${aggregate.securityTechnical.linksAndForms.insecureFormActionCount} form action(s) submit over HTTP.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.scriptSurface.mixedContentCount > 0) {
    actions.push({
      title: "Eliminate mixed content references",
      detail: `${aggregate.securityTechnical.scriptSurface.mixedContentCount} mixed-content asset reference(s) were found.`,
      impact: "high"
    });
  }

  if (aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount > 0) {
    actions.push({
      title: "Add SRI to external script dependencies",
      detail: `${aggregate.securityTechnical.scriptSurface.scriptsWithoutSriCount} external script(s) are missing integrity hashes.`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.cors.riskyPageCount > 0) {
    actions.push({
      title: "Tighten permissive CORS responses",
      detail: `CORS policy issues were detected on ${aggregate.securityTechnical.cors.riskyPageCount} scanned page(s).`,
      impact: "medium"
    });
  }

  if (aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount > 0) {
    actions.push({
      title: "Verify anti-CSRF protections on auth flows",
      detail: `${aggregate.securityTechnical.authSurface.passwordFlowMissingCsrfCount} password-flow page(s) lacked obvious CSRF/token fields.`,
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
        title: "Harden cookie flags for session safety",
        detail: `Secure ${aggregate.securityTechnical.cookies.secureRate}%, HttpOnly ${aggregate.securityTechnical.cookies.httpOnlyRate}%, SameSite ${aggregate.securityTechnical.cookies.sameSiteRate}%.`,
        impact: "medium"
      });
    }
  }

  if (scanData.crawl.errors.length > 0) {
    actions.push({
      title: "Investigate crawl/runtime errors",
      detail: `${scanData.crawl.errors.length} page-level error(s) occurred during the scan.`,
      impact: "low"
    });
  }

  if (!actions.length) {
    actions.push({
      title: "Maintain current security posture",
      detail: "No major hardening gaps were detected in scanned pages.",
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
    ? `${siteName} pages expose ${aggregate.counts.headings} headings across ${aggregate.pageCount} scanned page${aggregate.pageCount === 1 ? "" : "s"}, supporting scannable structure.`
    : `${siteName} shows weak visible heading structure across the scanned pages, so customers may struggle to understand page intent quickly.`;

  const trustDetail = aggregate.trustLinks.length || aggregate.trustSignals.hasContactDetailsRate > 0
    ? `Trust cues are visible in parts of the crawl (${aggregate.trustLinks.slice(0, 3).join(", ") || "contact details"}), but consistency can improve across all entry pages.`
    : "Very few trust cues (privacy, terms, support, contact) were visible across the scanned pages.";

  const conversionDetail = aggregate.ctaLabels.length
    ? `Primary actions are visible (${aggregate.ctaLabels.slice(0, 4).join(", ")}), with ${aggregate.counts.forms} forms supporting next steps.`
    : "Clear call-to-action labels were limited across scanned pages, so users may lack a strong next step.";

  const crawlDetail = `Scanned ${scanData.crawl.pagesScanned}/${scanData.crawl.requestedPageLimit} pages up to depth ${scanData.crawl.maxReachedDepth} using ${scanData.crawl.executionMode}${scanData.crawl.modeFallbackUsed ? " (fallback applied)" : ""}.`;

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
      detail: `Average alt coverage is ${aggregate.accessibility.altCoverage}% and form label coverage is ${aggregate.accessibility.formLabelCoverage}%.`,
      severity: aggregate.accessibility.altCoverage >= 75 && aggregate.accessibility.formLabelCoverage >= 75 ? "low" : "medium"
    }
  ];
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

function buildReport(input, scanData) {
  const aggregate = aggregatePages(scanData);
  const siteName = deriveSiteName(input.url);
  const sizeDetails = getSizeDetails(input.scanSize);
  const focusDetails = getFocusDetails(input.focusArea);
  const prioritizedActions = buildPrioritizedActions(aggregate);
  const securityRecommendations = buildSecurityRecommendations(aggregate, scanData);
  const securityPostureScore = computeSecurityPostureScore(aggregate);

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

  return {
    siteName,
    scannedAt: new Date().toISOString(),
    scope: sizeDetails.scope,
    summary: `This review scanned ${scanData.crawl.pagesScanned} page${scanData.crawl.pagesScanned === 1 ? "" : "s"} from ${new URL(input.url).origin} with a depth budget of ${scanData.crawl.maxDepth}. The report is split into UI/Styling intelligence and Security/Technical hardening evidence.`,
    scores: [
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
        trend: `Alt text ${aggregate.accessibility.altCoverage}%, form labels ${aggregate.accessibility.formLabelCoverage}%`
      },
      {
        label: "Security posture",
        value: securityPostureScore,
        trend: `${aggregate.securityTechnical.headers.missing.length} missing header category${aggregate.securityTechnical.headers.missing.length === 1 ? "" : "ies"}`
      }
    ],
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
    uiStyle: {
      summary: `UI analysis covers visual tokens, typography, content clarity, and interaction intent across ${aggregate.pageCount} scanned pages.`,
      styleTokens: {
        colors: aggregate.colors,
        fonts: aggregate.fonts,
        components: aggregate.components,
        highlightWords: aggregate.highlightTerms
      },
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
        readability: {
          paragraphCount: aggregate.readability.paragraphCount,
          avgParagraphWords: aggregate.readability.avgParagraphWords
        },
        accessibility: {
          altCoverage: aggregate.accessibility.altCoverage,
          formLabelCoverage: aggregate.accessibility.formLabelCoverage
        }
      }
    }
  };
}

module.exports = {
  extractScanData,
  buildReport,
  ScanProcessingError,
  __testables: {
    evaluateSecurityHeaders,
    analyzeSetCookieHeaders,
    assessLinkAndFormHardening,
    assessScriptSurface,
    assessCorsPolicy,
    assessCachePolicy,
    assessAuthSurface,
    computeSecurityPostureScore
  }
};
