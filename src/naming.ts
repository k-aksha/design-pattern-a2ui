import type { DiscoveredComponent } from "./types.js";

export function toPascalCase(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Component";
  return parts.map((part) => part[0]!.toUpperCase() + part.slice(1)).join("");
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal[0]!.toLowerCase() + pascal.slice(1);
}

export function inferKind(
  name: string,
  enumValues?: string[],
): DiscoveredComponent["props"][number]["kind"] {
  if (enumValues?.length) return "enum";
  if (/^(children|child|content|slots?)$/i.test(name)) return "children";
  if (/^(on[A-Z]|action)/.test(name)) return "action";
  if (/^(is|has|disabled|checked|open|required|hidden|loading)/i.test(name)) return "boolean";
  if (/count|index|min|max|step|weight|gap|columns/i.test(name) && !/size/i.test(name)) {
    return "number";
  }
  return "string";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
