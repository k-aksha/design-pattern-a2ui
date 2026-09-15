import type { DesignToken } from "./types.js";

export function extractCssTokens(source: string, css: string): DesignToken[] {
  const tokens: DesignToken[] = [];
  const re = /--([A-Za-z0-9-_]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    const name = match[1]!;
    tokens.push({
      name: cssVarToCamel(name),
      path: name.split("-").filter(Boolean),
      value: match[2]!.trim(),
      type: inferTokenType(match[2]!.trim()),
      source,
    });
  }
  return tokens;
}

export function extractJsonTokens(source: string, json: unknown, path: string[] = []): DesignToken[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  const record = json as Record<string, unknown>;

  if ("value" in record && (typeof record.value === "string" || typeof record.value === "number")) {
    const name = path.length ? path.join(".") : "token";
    return [
      {
        name: pathToCamel(path),
        path,
        value: record.value,
        type: typeof record.type === "string" ? record.type : inferTokenType(String(record.value)),
        source,
      },
    ];
  }

  const tokens: DesignToken[] = [];
  const skip = new Set(["$schema", "$metadata", "description"]);
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key) || key.startsWith("$")) continue;
    tokens.push(...extractJsonTokens(source, value, [...path, key]));
  }

  if (tokens.length === 0 && path.length === 0) {
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" || typeof value === "number") {
        tokens.push({
          name: key.replace(/[^A-Za-z0-9]+(.)/g, (_, c: string) => c.toUpperCase()),
          path: [key],
          value,
          type: inferTokenType(String(value)),
          source,
        });
      }
    }
  }

  return tokens;
}

export function inferTokenType(value: string): string {
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return "color";
  if (/rgba?\(|hsla?\(|oklch\(/i.test(value)) return "color";
  if (/px|rem|em|%|vh|vw/.test(value)) return "dimension";
  if (/^\d+(\.\d+)?$/.test(value)) return "number";
  return "string";
}

function cssVarToCamel(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join("");
}

function pathToCamel(path: string[]): string {
  return path
    .flatMap((segment) => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part.toLowerCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join("");
}
