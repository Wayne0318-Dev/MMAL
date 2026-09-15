import type { MoldIdentity } from "@/lib/types";

const MOLD_ID_ALIASES: Record<string, string> = {
  S26008: "S250137",
  SS230295: "S230295",
};

function stripHalfMarker(token: string): { primary: string; variant: "前模" | "后模" | null } {
  let variant: "前模" | "后模" | null = null;
  let primary = token.trim();
  if (/前模/.test(primary)) {
    variant = "前模";
    primary = primary.replace(/前模\s*/g, "");
  } else if (/后模/.test(primary)) {
    variant = "后模";
    primary = primary.replace(/后模\s*/g, "");
  } else if (/^前/.test(primary)) {
    variant = "前模";
    primary = primary.replace(/^前/, "");
  } else if (/^后/.test(primary)) {
    variant = "后模";
    primary = primary.replace(/^后/, "");
  } else if (/[A-Za-z0-9]后$/.test(primary)) {
    variant = "后模";
    primary = primary.replace(/后$/, "");
  } else if (/[A-Za-z0-9]前$/.test(primary)) {
    variant = "前模";
    primary = primary.replace(/前$/, "");
  }
  return { primary: primary.trim(), variant };
}

function canonicalizeToken(token: string): {
  canonical: string;
  variant: "前模" | "后模" | null;
  correctedFrom: string | null;
} {
  const { primary: stripped, variant } = stripHalfMarker(token.trim());
  let primary = stripped;
  const ab = primary.match(/^([A-Za-z]+\d+)(AB)$/i);
  if (ab) primary = ab[1];

  const mS = primary.match(/^[sS](\d+)$/);
  const mSs = primary.match(/^SS(\d+)$/i);
  const mNum = primary.match(/^(\d+)([A-Za-z])?$/);
  let canonical: string;
  if (mS) canonical = `S${mS[1]}`;
  else if (mSs) canonical = `S${mSs[1]}`;
  else if (mNum) {
    canonical = `S${mNum[1]}`;
    if (mNum[2]) canonical += mNum[2].toUpperCase();
  } else canonical = primary.toUpperCase().replace(/\s+/g, "");

  let correctedFrom: string | null = null;
  if (MOLD_ID_ALIASES[canonical]) {
    correctedFrom = canonical;
    canonical = MOLD_ID_ALIASES[canonical];
  }
  return { canonical, variant, correctedFrom };
}

function expandCellTokens(raw: string): string[] {
  const parts = raw.split(/[/／]/).map((p) => p.trim()).filter(Boolean);
  const expanded: string[] = [];
  let prev: string | null = null;
  for (const part of parts) {
    if (part.toUpperCase() === "M2" && prev && /M1$/i.test(prev)) {
      expanded.push(prev.replace(/M1$/i, "M2"));
    } else {
      expanded.push(part);
    }
    prev = expanded[expanded.length - 1];
  }
  return expanded;
}

export function parseMoldCell(
  raw: string | null,
  product: string | null
): MoldIdentity {
  if (!raw) {
    if (product && product.includes("Meridian")) {
      return {
        raw: null,
        canonical: "ZDX3464",
        variant: null,
        ids: ["ZDX3464"],
        display: "ZDX3464",
        correctedFrom: "(空)",
        correction: "Q7：Meridian支架补号 ZDX3464",
      };
    }
    return {
      raw: null,
      canonical: null,
      variant: null,
      ids: [],
      display: "缺号",
      correctedFrom: null,
      correction: null,
    };
  }

  const tokens = expandCellTokens(raw);
  const ids: string[] = [];
  const variants: Array<"前模" | "后模"> = [];
  const corrections: string[] = [];
  for (const token of tokens) {
    const { canonical, variant, correctedFrom } = canonicalizeToken(token);
    if (!ids.includes(canonical)) ids.push(canonical);
    if (variant && !variants.includes(variant)) variants.push(variant);
    if (correctedFrom) corrections.push(`${correctedFrom}→${canonical}`);
  }

  const primary = ids[0] ?? null;
  const variant = variants.length === 1 ? variants[0] : null;
  let display = ids.join(" / ");
  if (variant && ids.length === 1) display = `${primary}-${variant}`;

  return {
    raw,
    canonical: primary,
    variant,
    ids,
    display,
    correctedFrom: corrections[0]?.split("→")[0] ?? null,
    correction: corrections.length ? corrections.join("；") : null,
  };
}
