export function publicSupportUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (/^mailto:[^@\s?]+@[^@\s?]+\.[^@\s?]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export const SUPPORT_URL =
  publicSupportUrl(import.meta.env["VITE_SUPPORT_URL"]) ??
  "https://github.com/kenlaufy/cardwiseprototype/issues/new";
