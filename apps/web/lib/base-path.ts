function normalizeBasePath(basePath: string | undefined) {
  if (!basePath) return "";

  const trimmed = basePath.trim();
  if (!trimmed || trimmed === "/") return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function getBasePath() {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
}

export function withBasePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBasePath()}${normalizedPath}`;
}

export function toAbsoluteAppUrl(
  path: string,
  queryParams?: Record<string, string | undefined | null>
) {
  if (typeof window === "undefined") {
    throw new Error("toAbsoluteAppUrl must be called in the browser.");
  }

  const url = new URL(withBasePath(path), window.location.origin);

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}
