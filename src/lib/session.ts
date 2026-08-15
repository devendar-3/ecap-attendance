const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Turns a human roll-number example/pattern into a validator.
 * `9` = digit, `A` = letter, `*` = any character. Anything else is literal.
 * A blank pattern accepts everything.
 */
export function patternToRegex(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;
  const body = trimmed
    .split("")
    .map((ch) => {
      if (ch === "9") return "\\d";
      if (ch === "A" || ch === "a") return "[A-Za-z]";
      if (ch === "*") return ".";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  try {
    return new RegExp(`^${body}$`);
  } catch {
    return null;
  }
}

export function matchesPattern(value: string, pattern: string | null | undefined): boolean {
  if (!pattern) return true;
  const re = patternToRegex(pattern);
  if (!re) return true;
  return re.test(value.trim());
}

export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] as Record<string, string | number>);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
