const cheerio = require("cheerio");

const COLOR_PATTERN = /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}{]+)/gi;
const GENERIC_FONT_TOKENS = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "cursive",
  "fantasy", "ui-sans-serif", "ui-serif", "ui-monospace"
]);

const sizeConfig = {
  "Quick check": { pageLimit: 1, scope: "Single page review", detail: "A fast look at one page." },
  "Standard review": { pageLimit: 5, scope: "Up to 5 important pages", detail: "A balanced review of the main journey." },
  "Full walkthrough": { pageLimit: 10, scope: "Up to 10 key pages", detail: "A broader review for a fuller picture." }
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

// --- Utilities ---

function uniqueValues(values, limit) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, limit);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
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
  return uniqueValues(input.match(COLOR_PATTERN) ?? [], 8);
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
  return uniqueValues(fonts, 6);
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

async function fetchText(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "SyntelliaBot/0.1 (+https://syntellia.app)" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error(
      "The page could not be fetched from the scan server. The site may block automated requests, require a browser session, or outbound network access may be unavailable."
    );
  }
  if (!response.ok) throw new Error(`The page responded with ${response.status}.`);
  return { finalUrl: response.url, statusCode: response.status, body: await response.text() };
}

async function fetchStylesheets($, baseUrl) {
  const stylesheetUrls = uniqueValues(
    $("link[rel='stylesheet']").map((_, el) => $(el).attr("href") ?? "").get(),
    4
  ).map((href) => new URL(href, baseUrl).toString());

  const results = await Promise.allSettled(
    stylesheetUrls.map(async (url) => {
      const r = await fetch(url, {
        headers: { "User-Agent": "SyntelliaBot/0.1 (+https://syntellia.app)" },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });
      return r.ok ? r.text() : "";
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

async function extractPageData(url) {
  const { body, finalUrl, statusCode } = await fetchText(url);
  const $ = cheerio.load(body);
  const inlineStyles = $("style").map((_, el) => $(el).html() ?? "").get();
  const referencedStyles = await fetchStylesheets($, finalUrl);
  const styleSources = [body, ...inlineStyles, ...referencedStyles].join("\n");

  const headings = collectText($("h1, h2, h3"), 8);
  const navLabels = collectText($("nav a, header a"), 6);
  const buttonLabels = uniqueValues(
    [
      ...collectText($("button, [role='button']"), 8),
      ...$("input[type='submit'], input[type='button']")
        .map((_, el) => normalizeWhitespace($(el).attr("value") ?? ""))
        .get()
    ],
    8
  );

  const notes = [];
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
    inputs: $("input, textarea, select").length
  };

  if (!metaDescription) notes.push("No meta description was found in the HTML.");
  if (!$("h1").length) notes.push("No H1 heading was found on the page.");
  if ($("input[type='password']").length) notes.push("A password field was detected, so this page likely sits behind a login flow.");
  if (!buttonLabels.length && counts.forms === 0) notes.push("Few direct action controls were detected in the fetched HTML.");

  return {
    finalUrl, statusCode, pageTitle, metaDescription,
    headings, navLabels, buttonLabels,
    colors: collectColors(styleSources),
    fonts: collectFonts(styleSources),
    components: detectComponents($),
    notes: uniqueValues(notes, 6),
    counts
  };
}

// --- Report building ---

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

function getSizeDetails(scanSize) {
  return sizeConfig[scanSize] ?? sizeConfig["Standard review"];
}

function getFocusDetails(focusArea) {
  return focusConfig[focusArea] ?? focusConfig["Overall feel"];
}

function scoreWithinRange(value) {
  return Math.max(35, Math.min(98, value));
}

function buildInteractions(extracted) {
  const signals = [
    ...extracted.buttonLabels.slice(0, 4).map((l) => `Action: ${l}`),
    ...extracted.navLabels.slice(0, 3).map((l) => `Navigation: ${l}`)
  ];
  if (!signals.length) signals.push("Minimal visible action labels detected");
  return signals.slice(0, 6);
}

function buildFindings(input, extracted, siteName) {
  const structureFinding =
    extracted.counts.headings > 0
      ? `${siteName} exposes ${extracted.counts.headings} heading${extracted.counts.headings === 1 ? "" : "s"} and ${extracted.counts.sections} section-level block${extracted.counts.sections === 1 ? "" : "s"}, which gives the report real page structure to work from.`
      : `${siteName} does not expose clear heading structure in the fetched HTML, so content hierarchy may be harder to read quickly.`;

  const actionFinding =
    extracted.counts.buttons + extracted.counts.forms > 0
      ? `The fetched page includes ${extracted.counts.buttons} button${extracted.counts.buttons === 1 ? "" : "s"} and ${extracted.counts.forms} form${extracted.counts.forms === 1 ? "" : "s"}, which helps anchor the ${input.focusArea.toLowerCase()} review in real action points.`
      : `The fetched page exposes very few obvious action controls, so the ${input.focusArea.toLowerCase()} review will lean more on structure and messaging than conversion paths.`;

  const styleFinding =
    extracted.colors.length || extracted.fonts.length
      ? `Visible style signals include ${extracted.colors.length} color token${extracted.colors.length === 1 ? "" : "s"} and ${extracted.fonts.length} font family reference${extracted.fonts.length === 1 ? "" : "ies"} pulled from accessible HTML and CSS.`
      : "Only limited style tokens were readable from the page source, so style extraction is still partial for pages that rely heavily on runtime styling or locked-down assets.";

  return [
    { title: "Messaging and structure", detail: structureFinding, severity: extracted.counts.headings > 0 ? "low" : "high" },
    { title: "Navigation and action cues", detail: actionFinding, severity: extracted.counts.buttons + extracted.counts.forms > 0 ? "low" : "medium" },
    { title: "Visible style signals", detail: styleFinding, severity: extracted.colors.length || extracted.fonts.length ? "low" : "medium" }
  ];
}

function buildReport(input, extracted) {
  const siteName = deriveSiteName(input.url);
  const sizeDetails = getSizeDetails(input.scanSize);
  const focusDetails = getFocusDetails(input.focusArea);
  const structureScore = scoreWithinRange(52 + extracted.counts.headings * 6 + extracted.counts.sections * 3 + extracted.counts.navs * 4);
  const actionScore = scoreWithinRange(48 + extracted.counts.buttons * 7 + extracted.counts.forms * 8 + Math.min(extracted.counts.links, 20));
  const styleScore = scoreWithinRange(44 + extracted.colors.length * 6 + extracted.fonts.length * 8 + extracted.components.length * 4);

  return {
    siteName,
    scannedAt: new Date().toISOString(),
    scope: sizeDetails.scope,
    summary: `${siteName} was fetched successfully and the report now reflects real page signals from ${extracted.finalUrl}. We found ${extracted.counts.links} links, ${extracted.counts.buttons} buttons, ${extracted.counts.forms} forms, and ${extracted.counts.headings} headings, then shaped the review around ${input.focusArea.toLowerCase()}.`,
    scores: [
      { label: "Page structure", value: structureScore, trend: `${extracted.counts.headings} headings and ${extracted.counts.sections} sections detected` },
      { label: "Style coverage", value: styleScore, trend: `${extracted.colors.length} colors and ${extracted.fonts.length} font references detected` },
      { label: "Action clarity", value: actionScore, trend: `${extracted.counts.buttons} buttons and ${extracted.counts.forms} forms detected` }
    ],
    tokenGroups: [
      {
        label: "Detected style tokens",
        values: extracted.colors.length || extracted.fonts.length
          ? [...extracted.colors.slice(0, 5), ...extracted.fonts.slice(0, 3)]
          : ["No readable colors", "No readable fonts"]
      },
      {
        label: "Detected page structure",
        values: [
          `${extracted.counts.headings} headings`, `${extracted.counts.links} links`,
          `${extracted.counts.buttons} buttons`, `${extracted.counts.forms} forms`,
          `${extracted.counts.images} visual assets`
        ]
      },
      {
        label: "Review setup",
        values: [sizeDetails.detail, input.loginMode, focusDetails.checks[0], `Up to ${sizeDetails.pageLimit} page${sizeDetails.pageLimit === 1 ? "" : "s"}`]
      }
    ],
    findings: buildFindings(input, extracted, siteName),
    components: extracted.components.length ? extracted.components : focusDetails.components,
    interactions: buildInteractions(extracted),
    source: {
      finalUrl: extracted.finalUrl,
      statusCode: extracted.statusCode,
      pageTitle: extracted.pageTitle,
      metaDescription: extracted.metaDescription,
      headingCount: extracted.counts.headings,
      linkCount: extracted.counts.links,
      buttonCount: extracted.counts.buttons,
      formCount: extracted.counts.forms,
      imageCount: extracted.counts.images,
      colors: extracted.colors,
      fonts: extracted.fonts,
      notes: extracted.notes
    }
  };
}

module.exports = { extractPageData, buildReport };
