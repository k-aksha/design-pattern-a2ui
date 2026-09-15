import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { readManifestDocument } from "./manifest/agent.js";
import type { ManifestComponent } from "./manifest/types.js";
import type { DesignSystemInventory, DiscoveredComponent, DesignToken } from "./types.js";
import { inferKind, toPascalCase } from "./naming.js";
import { parseComponentFile } from "./parse-components.js";
import { extractCssTokens, extractJsonTokens } from "./parse-tokens.js";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  "a2ui",
  ".next",
  "storybook-static",
]);

const COMPONENT_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".vue"]);
const TOKEN_JSON_HINT = /token|theme|palette|colors|typography/i;

export type ScanDesignSystemOptions = {
  manifestPath?: string;
  fillMissing?: boolean;
};

export function scanDesignSystem(
  root: string,
  options: ScanDesignSystemOptions = {},
): DesignSystemInventory {
  const abs = resolve(root);
  if (!existsSync(abs)) {
    throw new Error(`Design system path not found: ${abs}`);
  }

  const manifest = readManifestDocument(abs, options.manifestPath);
  const files = walkFiles(abs);
  const components: DiscoveredComponent[] = [];
  const tokens: DesignToken[] = [];
  const seenNames = new Set<string>();
  const manifestPrimary = Boolean(manifest?.components?.length);

  if (manifestPrimary) {
    for (const entry of manifest!.components!) {
      if (entry.includeInCatalog === false) continue;
      const component = manifestEntryToDiscovered(entry, abs);
      components.push(component);
      seenNames.add(component.name);
    }
  }

  if (!manifestPrimary || options.fillMissing) {
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const rel = relative(abs, file);

      if (ext === ".css") {
        tokens.push(...extractCssTokens(file, readFileSync(file, "utf8")));
        continue;
      }

      if (ext === ".json" && TOKEN_JSON_HINT.test(rel) && !rel.endsWith("package.json")) {
        try {
          tokens.push(...extractJsonTokens(file, JSON.parse(readFileSync(file, "utf8"))));
        } catch {
          // Ignore non-token JSON.
        }
        continue;
      }

      if (!COMPONENT_EXTS.has(ext)) continue;
      if (/\.d\.ts$/.test(file) || /\.test\.|\.spec\.|\.stories\./i.test(file)) continue;

      for (const component of parseComponentFile(file, readFileSync(file, "utf8"))) {
        if (seenNames.has(component.name)) continue;
        seenNames.add(component.name);
        components.push({
          ...component,
          sourcePath: relative(abs, component.sourcePath) || component.sourcePath,
        });
      }
    }
  } else {
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const rel = relative(abs, file);

      if (ext === ".css") {
        tokens.push(...extractCssTokens(file, readFileSync(file, "utf8")));
        continue;
      }

      if (ext === ".json" && TOKEN_JSON_HINT.test(rel) && !rel.endsWith("package.json")) {
        try {
          tokens.push(...extractJsonTokens(file, JSON.parse(readFileSync(file, "utf8"))));
        } catch {
          // Ignore non-token JSON.
        }
      }
    }
  }

  return {
    name: manifest?.name ?? inferName(abs),
    catalogId: manifest?.catalogId,
    root: abs,
    components,
    tokens,
  };
}

function manifestEntryToDiscovered(entry: ManifestComponent, root: string): DiscoveredComponent {
  const name = toPascalCase(entry.name);
  return {
    name,
    exportName: entry.exportName ?? name,
    sourcePath: entry.source ?? "manifest",
    description: entry.description,
    props: (entry.props ?? []).map((prop) => ({
      name: prop.name,
      kind: prop.kind ?? inferKind(prop.name, prop.enumValues),
      required: Boolean(prop.required),
      description: prop.description,
      enumValues: prop.enumValues,
      defaultValue: prop.defaultValue,
    })),
  };
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (stat.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function inferName(root: string): string {
  const pkg = join(root, "package.json");
  if (existsSync(pkg)) {
    try {
      const parsed = JSON.parse(readFileSync(pkg, "utf8")) as { name?: string };
      if (parsed.name) return parsed.name.replace(/^@/, "").replace(/\//g, "-");
    } catch {
      // fall through
    }
  }
  return root.split(/[/\\]/).filter(Boolean).at(-1) ?? "design-system";
}
