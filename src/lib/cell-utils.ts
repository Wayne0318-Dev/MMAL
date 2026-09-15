export function cellStr(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return formatClock(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      const text = (obj.richText as { text?: string }[])
        .map((t) => t.text ?? "")
        .join("");
      return clean(text);
    }
    if (typeof obj.text === "string") return clean(obj.text);
    if ("result" in obj) return cellStr(obj.result);
  }
  if (typeof value === "string") return clean(value);
  return clean(String(value));
}

export function formatClock(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function clean(s: string) {
  const t = s
    .replace(/\u00a0/g, " ")
    .replace(/　/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return t || null;
}

export function parseDateLabel(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function parseSheetNameDate(
  sheetName: string,
  yearHint: number | null
): string | null {
  const iso = sheetName.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const md = sheetName.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (md && yearHint) {
    return `${yearHint}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  }
  return null;
}

export function yearFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
