const cheerio = require("cheerio");

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

function extractCallToActions($, buttonLabels) {
  const linkLabels = collectText($("a"), 20).filter((label) => CTA_PATTERN.test(label));
  const ctaLabels = uniqueValues([...buttonLabels.filter((label) => CTA_PATTERN.test(label)), ...linkLabels], 8);
  return ctaLabels;
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
    8
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

  return uniqueValues(matches, 8);
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
  const ctaLabels = extractCallToActions($, buttonLabels);
  const trustSignals = extractTrustSignals($);
  const accessibility = assessAccessibility($);
  const readability = assessReadability($);
  const headingFlow = assessHeadingFlow($);
  const formComplexity = assessFormComplexity($);
  const highlightTerms = collectHighlightTerms([...headings, ...navLabels, ...buttonLabels]);

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
    finalUrl, statusCode, pageTitle, metaDescription,
    headings, navLabels, buttonLabels, ctaLabels,
    colors: collectColors(styleSources),
    fonts: collectFonts(styleSources),
    components: detectComponents($),
    notes: uniqueValues(notes, 6),
    trustSignals,
    accessibility,
    readability,
    headingFlow,
    formComplexity,
    highlightTerms,
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
    ...extracted.ctaLabels.slice(0, 4).map((label) => `Customer action: ${label}`),
    ...extracted.navLabels.slice(0, 2).map((label) => `Navigation label: ${label}`),
    ...extracted.trustSignals.trustLinks.slice(0, 2).map((label) => `Trust cue: ${label}`)
  ];
  if (!signals.length) signals.push("Few obvious customer actions are visible in the fetched HTML.");
  return signals.slice(0, 6);
}

function buildFindings(input, extracted, siteName) {
  const clarityDetail = extracted.counts.headings
    ? `${siteName} shows ${extracted.counts.headings} headings and ${extracted.readability.paragraphCount} readable paragraph block${extracted.readability.paragraphCount === 1 ? "" : "s"}, which gives customers a scannable structure.`
    : `${siteName} has weak visible heading structure in the fetched HTML, so customers may struggle to understand the page quickly.`;

  const trustDetail = extracted.trustSignals.trustLinks.length || extracted.trustSignals.hasContactDetails
    ? `We found trust cues such as ${extracted.trustSignals.trustLinks.slice(0, 2).join(", ") || "contact details"}, which help reduce purchase hesitation for new visitors.`
    : "Very few trust cues (privacy, terms, support, contact) were visible, which can reduce confidence for first-time customers.";

  const conversionDetail = extracted.ctaLabels.length
    ? `Primary customer actions are visible (${extracted.ctaLabels.slice(0, 3).join(", ")}), with ${extracted.counts.forms} form${extracted.counts.forms === 1 ? "" : "s"} supporting next steps.`
    : `Clear call-to-action labels were limited, so customers may not see an obvious next step after landing on this page.`;

  const accessibilityDetail =
    extracted.accessibility.altCoverage >= 70 && extracted.accessibility.formLabelCoverage >= 70
      ? `Accessibility basics are in place: ${extracted.accessibility.altCoverage}% image alt coverage and ${extracted.accessibility.formLabelCoverage}% form label coverage in the fetched HTML.`
      : `Accessibility comfort has gaps: ${extracted.accessibility.altCoverage}% image alt coverage and ${extracted.accessibility.formLabelCoverage}% form label coverage may affect clarity for some users.`;

  return [
    {
      title: "First impression clarity",
      detail: clarityDetail,
      severity: extracted.counts.headings > 0 && extracted.readability.longParagraphCount <= 2 ? "low" : "medium"
    },
    {
      title: "Trust and reassurance",
      detail: trustDetail,
      severity: extracted.trustSignals.trustLinks.length >= 2 || extracted.trustSignals.hasContactDetails ? "low" : "high"
    },
    {
      title: "Next-step clarity",
      detail: conversionDetail,
      severity: extracted.ctaLabels.length > 0 ? "low" : "high"
    },
    {
      title: "Accessibility comfort",
      detail: accessibilityDetail,
      severity: extracted.accessibility.altCoverage >= 70 && extracted.accessibility.formLabelCoverage >= 70 ? "low" : "medium"
    }
  ];
}

function buildRecommendations(extracted) {
  const recommendations = [];

  if (!extracted.counts.headings) {
    recommendations.push("Add a clear H1 headline that states what the page offers in one sentence.");
  }

  if (extracted.ctaLabels.length === 0) {
    recommendations.push("Add one strong primary call-to-action above the fold (for example: Book demo, Start free trial).");
  } else if (extracted.formComplexity.complexForms > 0) {
    recommendations.push("Simplify longer forms by reducing optional fields or splitting steps.");
  }

  if (extracted.trustSignals.trustLinks.length < 2 && !extracted.trustSignals.hasContactDetails) {
    recommendations.push("Surface trust links (privacy, terms, support, contact) closer to key conversion areas.");
  }

  if (extracted.accessibility.altCoverage < 70) {
    recommendations.push("Improve image alt text coverage so visual content remains understandable for all users.");
  }

  if (extracted.accessibility.formLabelCoverage < 70) {
    recommendations.push("Add visible labels or ARIA labels for form fields to improve completion confidence.");
  }

  if (extracted.readability.longParagraphCount > 1) {
    recommendations.push("Break long paragraphs into shorter blocks so visitors can scan key points faster.");
  }

  if (!recommendations.length) {
    recommendations.push("Current page fundamentals look solid. Focus next on clearer value proof near the main CTA.");
  }

  return recommendations.slice(0, 4);
}

function buildReport(input, extracted) {
  const siteName = deriveSiteName(input.url);
  const sizeDetails = getSizeDetails(input.scanSize);
  const focusDetails = getFocusDetails(input.focusArea);
  const recommendations = buildRecommendations(extracted);
  const clarityScore = scoreWithinRange(
    42 +
    extracted.counts.headings * 6 +
    Math.min(extracted.readability.paragraphCount, 10) * 2 +
    (extracted.metaDescription ? 8 : 0) -
    extracted.headingFlow.headingJumpCount * 5 -
    extracted.readability.longParagraphCount * 2
  );
  const trustScore = scoreWithinRange(
    40 +
    extracted.trustSignals.trustLinks.length * 8 +
    (extracted.trustSignals.hasContactDetails ? 9 : 0) +
    (extracted.trustSignals.hasTestimonials ? 7 : 0) +
    (extracted.trustSignals.hasFaq ? 5 : 0)
  );
  const actionScore = scoreWithinRange(
    38 +
    extracted.ctaLabels.length * 9 +
    extracted.counts.buttons * 3 +
    extracted.counts.forms * 5 -
    extracted.formComplexity.complexForms * 6
  );
  const accessibilityScore = scoreWithinRange(
    35 +
    Math.round(extracted.accessibility.altCoverage * 0.3) +
    Math.round(extracted.accessibility.formLabelCoverage * 0.35) +
    (extracted.accessibility.hasViewportMeta ? 8 : 0)
  );

  return {
    siteName,
    scannedAt: new Date().toISOString(),
    scope: sizeDetails.scope,
    summary: `This review reflects live page signals from ${extracted.finalUrl}. From a customer point of view, we checked clarity, trust, next-step actions, and accessibility comfort based on ${extracted.counts.links} links, ${extracted.counts.buttons} buttons, ${extracted.counts.forms} forms, and ${extracted.counts.headings} headings.`,
    scores: [
      {
        label: "Message clarity",
        value: clarityScore,
        trend: `${extracted.counts.headings} headings, ${extracted.readability.paragraphCount} paragraph blocks`
      },
      {
        label: "Trust confidence",
        value: trustScore,
        trend: `${extracted.trustSignals.trustLinks.length} trust links, FAQ: ${extracted.trustSignals.hasFaq ? "yes" : "no"}`
      },
      {
        label: "Action readiness",
        value: actionScore,
        trend: `${extracted.ctaLabels.length} CTA labels, ${extracted.counts.forms} forms`
      },
      {
        label: "Accessibility comfort",
        value: accessibilityScore,
        trend: `Alt text ${extracted.accessibility.altCoverage}%, form labels ${extracted.accessibility.formLabelCoverage}%`
      }
    ],
    tokenGroups: [
      {
        label: "Customer actions detected",
        values: extracted.ctaLabels.length
          ? extracted.ctaLabels
          : ["No strong CTA label found in the fetched HTML"]
      },
      {
        label: "Trust signals detected",
        values: [
          ...extracted.trustSignals.trustLinks.slice(0, 5),
          `Contact details visible: ${extracted.trustSignals.hasContactDetails ? "Yes" : "No"}`,
          `Testimonials visible: ${extracted.trustSignals.hasTestimonials ? "Yes" : "No"}`
        ]
      },
      {
        label: "Top recommendations",
        values: recommendations
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
    findings: buildFindings(input, extracted, siteName),
    components: extracted.components.length
      ? extracted.components
      : [...focusDetails.components, "Customer trust cues", "Primary action blocks"],
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
      notes: extracted.notes,
      customerSignals: {
        ctaLabels: extracted.ctaLabels,
        trustSignals: extracted.trustSignals.trustLinks,
        highlightWords: extracted.highlightTerms,
        readability: {
          paragraphCount: extracted.readability.paragraphCount,
          avgParagraphWords: extracted.readability.avgParagraphWords
        },
        accessibility: {
          altCoverage: extracted.accessibility.altCoverage,
          formLabelCoverage: extracted.accessibility.formLabelCoverage
        }
      }
    }
  };
}

module.exports = { extractPageData, buildReport };
