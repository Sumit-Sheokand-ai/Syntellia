export function shouldReduceMotion(mediaPreference: string | null | undefined): boolean {
  return (mediaPreference ?? "").toLowerCase() === "reduce";
}

export function formatDateTimeForLocale(value: string, locale?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return locale ? date.toLocaleString(locale) : date.toLocaleString();
  } catch {
    return date.toLocaleString();
  }
}
