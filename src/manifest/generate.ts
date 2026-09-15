import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { parseComponentFile } from "../parse-components.js";
import { toPascalCase } from "../naming.js";
import { extractComponentsFromProgram } from "./extract-components.js";
import { extractPropsForComponent } from "./extract-props.js";
import { createTypeScriptProgram } from "./tsc-program.js";
import type {
  GenerateManifestOptions,
  GenerateManifestResult,
  ManifestComponent,
  ManifestDocument,
  ScanDiagnostic,
} from "./types.js";
import { MANIFEST_SCHEMA_URL } from "./types.js";

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

export function generateManifest(options: GenerateManifestOptions): GenerateManifestResult {
  const root = resolve(options.input);
  if (!existsSync(root)) {
    throw new Error(`Design system path not found: ${root}`);
  }

  const diagnostics: ScanDiagnostic[] = [];
  const ctx = createTypeScriptProgram(root, options.project);

  let components: ManifestComponent[] = [];

  if (ctx) {
    const extracted = extractComponentsFromProgram(ctx);
    diagnostics.push(...extracted.diagnostics);

    for (const ref of extracted.components) {
      const { props, diagnostics: propDiagnostics } = extractPropsForComponent(ctx, ref);
      diagnostics.push(...propDiagnostics);
      components.push({
        name: ref.name,
        exportName: ref.exportName,
        source: ref.source,
        description: ref.description,
        includeInCatalog: true,
        props,
      });
    }
  } else {
    diagnostics.push({
      level: "info",
      code: "no-tsconfig",
      message:
        "No tsconfig.json found; falling back to per-file parsing (cross-file props will not resolve).",
    });
    components = scanWithRegexFallback(root, diagnostics);
  }

  components = applyPathFilters(components, root, options.include, options.exclude);

  const manifest: ManifestDocument = {
    $schema: MANIFEST_SCHEMA_URL,
    name: options.name ?? inferName(root),
    catalogId: options.catalogId,
    components,
  };

  return { manifest, diagnostics };
}

function scanWithRegexFallback(root: string, diagnostics: ScanDiagnostic[]): ManifestComponent[] {
  const components: ManifestComponent[] = [];
  const seen = new Set<string>();

  for (const file of walkFiles(root)) {
    const ext = extname(file).toLowerCase();
    if (!COMPONENT_EXTS.has(ext)) continue;
    if (/\.d\.ts$/.test(file) || /\.test\.|\.spec\.|\.stories\./i.test(file)) continue;

    const rel = relative(root, file);
    const source = readFileSync(file, "utf8");

    if (ext === ".vue") {
      diagnostics.push({
        level: "warning",
        code: "vue-regex-fallback",
        message: `Vue SFC "${rel}" parsed via regex; complex defineProps may need manual manifest entries.`,
        file: rel,
      });
    }

    for (const component of parseComponentFile(file, source)) {
      const name = toPascalCase(component.name);
      if (seen.has(name)) continue;
      seen.add(name);
      components.push({
        name,
        exportName: component.exportName ?? name,
        source: relative(root, component.sourcePath) || rel,
        description: component.description,
        includeInCatalog: true,
        props: component.props.map((prop) => ({
          name: prop.name,
          kind: prop.kind,
          required: prop.required,
          description: prop.description,
          enumValues: prop.enumValues,
          defaultValue: prop.defaultValue,
        })),
      });
    }
  }

  return components;
}

function applyPathFilters(
  components: ManifestComponent[],
  root: string,
  include?: string[],
  exclude?: string[],
): ManifestComponent[] {
  if (!include?.length && !exclude?.length) return components;

  return components.filter((component) => {
    const source = component.source ?? "";
    const abs = resolve(root, source);
    const rel = relative(root, abs);
    if (include?.length && !include.some((pattern) => matchGlob(rel, pattern))) return false;
    if (exclude?.length && exclude.some((pattern) => matchGlob(rel, pattern))) return false;
    return true;
  });
}

function matchGlob(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
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
