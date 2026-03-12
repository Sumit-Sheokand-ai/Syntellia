import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

const COLOR_PATTERN = /#(?:[0-9a-f]{3,8})\b|rgba?\([^\)]+\)|hsla?\([^\)]+\)/gi;
const FONT_FAMILY_PATTERN = /font-family\s*:\s*([^;}{]+)/gi;
const GENERIC_FONT_TOKENS = new Set(["sans-serif", "serif", "monospace", "system-ui", "cursive", "fantasy", "ui-sans-serif", "ui-serif", "ui-monospace"]);

export type ExtractedPageData = {
  finalUrl: string;
  statusCode: number;
  pageTitle: string;
  metaDescription: string;
  headings: string[];
  navLabels: string[];
  buttonLabels: string[];
  colors: string[];
  fonts: string[];
  components: string[];
  notes: string[];
  counts: {
    headings: number;
    links: number;
    buttons: number;
    forms: number;
    images: number;
    sections: number;
    navs: number;
    inputs: number;
  };
};

function uniqueValues(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function collectText($elements: cheerio.Cheerio<AnyNode>, limit: number) {
  return uniqueValues(
    $elements
      .map((_, element) => normalizeWhitespace(cheerio.load(element).text()))
      .get()
      .filter((value) => value.length > 1 && value.length <= 80),
    limit
  );
}

function collectColors(input: string) {
  return uniqueValues(input.match(COLOR_PATTERN) ?? [], 8);
}

function collectFonts(input: string) {
  const fonts: string[] = [];

  for (const match of input.matchAll(FONT_FAMILY_PATTERN)) {
    const candidates = match[1]
      .split(",")
      .map((token) => token.replace(/["']/g, "").trim())
      .filter((token) => token && !GENERIC_FONT_TOKENS.has(token.toLowerCase()));

    fonts.push(...candidates);
  }

  return uniqueValues(fonts, 6);
}

function detectComponents($: cheerio.CheerioAPI) {
  const components: string[] = [];

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

async function fetchText(url: string) {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "SyntelliaBot/0.1 (+https://syntellia.local)"
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error("The page could not be fetched from the scan server. The site may block automated requests, require a browser session, or outbound network access may be unavailable.");
  }

  if (!response.ok) {
    throw new Error(`The page responded with ${response.status}.`);
  }

  return {
    finalUrl: response.url,
    statusCode: response.status,
    body: await response.text()
  };
}

async function fetchStylesheets($: cheerio.CheerioAPI, baseUrl: string) {
  const stylesheetUrls = uniqueValues(
    $("link[rel='stylesheet']")
      .map((_, element) => $(element).attr("href") ?? "")
      .get(),
    4
  ).map((href) => new URL(href, baseUrl).toString());

  const stylesheetResults = await Promise.allSettled(
    stylesheetUrls.map(async (url) => {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "SyntelliaBot/0.1 (+https://syntellia.local)"
        },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        return "";
      }

      return response.text();
    })
  );

  return stylesheetResults.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function extractPageData(url: string): Promise<ExtractedPageData> {
  const { body, finalUrl, statusCode } = await fetchText(url);
  const $ = cheerio.load(body);
  const inlineStyles = $("style")
    .map((_, element) => $(element).html() ?? "")
    .get();
  const referencedStyles = await fetchStylesheets($, finalUrl);
  const styleSources = [body, ...inlineStyles, ...referencedStyles].join("\n");

  const headings = collectText($("h1, h2, h3"), 8);
  const navLabels = collectText($("nav a, header a"), 6);
  const buttonLabels = uniqueValues(
    [
      ...collectText($("button, [role='button']"), 8),
      ...$("input[type='submit'], input[type='button']")
        .map((_, element) => normalizeWhitespace($(element).attr("value") ?? ""))
        .get()
    ],
    8
  );

  const notes: string[] = [];
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

  if (!metaDescription) {
    notes.push("No meta description was found in the HTML.");
  }

  if (!$("h1").length) {
    notes.push("No H1 heading was found on the page.");
  }

  if ($("input[type='password']").length) {
    notes.push("A password field was detected, so this page likely sits behind a login flow.");
  }

  if (!buttonLabels.length && counts.forms === 0) {
    notes.push("Few direct action controls were detected in the fetched HTML.");
  }

  return {
    finalUrl,
    statusCode,
    pageTitle,
    metaDescription,
    headings,
    navLabels,
    buttonLabels,
    colors: collectColors(styleSources),
    fonts: collectFonts(styleSources),
    components: detectComponents($),
    notes: uniqueValues(notes, 6),
    counts
  };
}