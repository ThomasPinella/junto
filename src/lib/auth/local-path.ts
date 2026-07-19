// Validates a caller-supplied "next" destination as a local application
// path. Anything else — absolute URLs, protocol-relative "//host" forms,
// backslash variants some browsers normalize to slashes, control characters
// or whitespace that could smuggle header/URL confusion — is rejected so a
// crafted destination can never redirect outside the application.
export function safeLocalPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value.length === 0 || value.length > 2048) {
    return null;
  }
  if (!value.startsWith("/")) {
    return null;
  }
  if (value.startsWith("//")) {
    return null;
  }
  if (value.includes("\\")) {
    return null;
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) {
      return null;
    }
  }
  return value;
}
