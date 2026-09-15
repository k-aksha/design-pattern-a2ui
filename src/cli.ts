#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertDesignSystem } from "./agent.js";
import { hasErrorDiagnostics, scanManifest, validateManifestFile } from "./manifest/agent.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    catalogId: { type: "string" },
    name: { type: "string" },
    manifest: { type: "string" },
    project: { type: "string" },
    merge: { type: "boolean", default: undefined },
    force: { type: "boolean", default: false },
    "fill-missing": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  printHelp();
  process.exit(0);
}

const command = positionals[0] ?? "convert";
const inputPath = positionals[1];

if (command === "help") {
  printHelp();
  process.exit(0);
}

if (!inputPath) {
  console.error("Missing design-system path.");
  printHelp();
  process.exit(1);
}

if (command === "scan") {
  const result = scanManifest({
    input: inputPath,
    outDir: values.out ? resolve(values.out) : undefined,
    project: values.project,
    catalogId: values.catalogId,
    name: values.name,
    merge: values.merge ?? true,
    force: values.force,
  });

  console.log(`Scanned ${result.manifest.name ?? inputPath}`);
  console.log(`  components: ${result.manifest.components?.length ?? 0}`);
  console.log(`  diagnostics: ${result.diagnostics.length}`);
  console.log(`  manifest: ${result.files["a2ui.manifest.json"] ?? result.files[values.manifest ?? ""]}`);
  console.log(`  report: ${result.files["scan-report.md"]}`);

  if (hasErrorDiagnostics(result.diagnostics)) {
    process.exit(1);
  }
  process.exit(0);
}

if (command === "validate") {
  const result = validateManifestFile({
    input: inputPath,
    manifestPath: values.manifest,
  });

  console.log(`Validated manifest for ${inputPath}`);
  console.log(`  valid: ${result.valid}`);
  console.log(`  diagnostics: ${result.diagnostics.length}`);

  for (const diagnostic of result.diagnostics) {
    const prefix = diagnostic.level.toUpperCase();
    const location = [diagnostic.file, diagnostic.component].filter(Boolean).join(" · ");
    console.log(`  [${prefix}] ${diagnostic.code}: ${diagnostic.message}${location ? ` (${location})` : ""}`);
  }

  process.exit(result.valid ? 0 : 1);
}

if (command !== "convert") {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const outDir = values.out ?? `${inputPath.replace(/\/$/, "")}/a2ui`;
const result = convertDesignSystem({
  input: inputPath,
  outDir,
  catalogId: values.catalogId,
  name: values.name,
  manifestPath: values.manifest,
  fillMissing: values["fill-missing"],
});

console.log(`Converted ${result.inventory.name}`);
console.log(`  components: ${Object.keys(result.catalog.components).length}`);
console.log(`  source components: ${result.inventory.components.length}`);
console.log(`  tokens: ${result.inventory.tokens.length}`);
console.log(`  catalogId: ${result.catalog.catalogId}`);
console.log(`  out: ${resolve(outDir)}`);

function printHelp() {
  console.log(`ds2a2ui — convert a design system into an A2UI v0.9 catalog

Usage:
  ds2a2ui scan <design-system-path> [--out <dir>] [--project tsconfig.json] [--merge] [--force]
  ds2a2ui validate <design-system-path> [--manifest path]
  ds2a2ui convert <design-system-path> [--out <dir>] [--catalogId <uri>] [--name <name>]
    [--manifest path] [--fill-missing]

Commands:
  scan      Generate a2ui.manifest.json + scan-report.md from TypeScript sources
  validate  Validate manifest schema and business rules
  convert   Write catalog.json, mapping.json, agent-prompt.md, and related artifacts

Flags:
  --merge         On scan, merge with an existing manifest (default: true)
  --force         On scan, overwrite the entire manifest
  --project       Explicit tsconfig path for monorepos
  --manifest      Manifest file path (validate/convert) or output filename (scan)
  --fill-missing  On convert, auto-scan components not listed in the manifest
`);
}
