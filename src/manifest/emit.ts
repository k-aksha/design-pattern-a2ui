import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EmitManifestOptions } from "./types.js";
import type { ManifestComponent, ScanDiagnostic } from "./types.js";

export function emitManifestArtifacts(options: EmitManifestOptions): Record<string, string> {
  const outDir = resolve(options.outDir);
  mkdirSync(outDir, { recursive: true });

  const manifestFile = options.manifestFile ?? "a2ui.manifest.json";
  const manifestPath = join(outDir, manifestFile);
  const reportPath = join(outDir, "scan-report.md");

  const manifestJson = `${JSON.stringify(options.manifest, null, 2)}\n`;
  const report = renderScanReport(options.manifest.components ?? [], options.diagnostics);

  writeFileSync(manifestPath, manifestJson, "utf8");
  writeFileSync(reportPath, report, "utf8");

  return {
    [manifestFile]: manifestPath,
    "scan-report.md": reportPath,
  };
}

function renderScanReport(components: ManifestComponent[], diagnostics: ScanDiagnostic[]): string {
  const lines: string[] = [
    "# Manifest scan report",
    "",
    "Review this report before committing `a2ui.manifest.json`. Set `includeInCatalog: false` to exclude components without deleting entries.",
    "",
    "## Components",
    "",
    "| Component | Source | Props | In catalog |",
    "| --- | --- | ---: | --- |",
  ];

  for (const component of components.sort((a, b) => a.name.localeCompare(b.name))) {
    const propCount = component.props?.length ?? 0;
    const inCatalog = component.includeInCatalog === false ? "no" : "yes";
    lines.push(`| ${component.name} | ${component.source ?? "—"} | ${propCount} | ${inCatalog} |`);
  }

  if (components.length === 0) {
    lines.push("| _none_ | — | 0 | — |");
  }

  lines.push("", "## Diagnostics", "");

  const grouped = {
    error: diagnostics.filter((entry) => entry.level === "error"),
    warning: diagnostics.filter((entry) => entry.level === "warning"),
    info: diagnostics.filter((entry) => entry.level === "info"),
  };

  for (const level of ["error", "warning", "info"] as const) {
    const entries = grouped[level];
    if (!entries.length) continue;
    lines.push(`### ${level[0]!.toUpperCase()}${level.slice(1)}`, "");
    lines.push("| Code | Message | File | Component |", "| --- | --- | --- | --- |");
    for (const entry of entries) {
      lines.push(
        `| ${entry.code} | ${escapeCell(entry.message)} | ${entry.file ?? "—"} | ${entry.component ?? "—"} |`,
      );
    }
    lines.push("");
  }

  if (diagnostics.length === 0) {
    lines.push("_No diagnostics._", "");
  }

  lines.push(
    "## Suggested manual fixes",
    "",
    "- Set `includeInCatalog: false` for components that should not be agent-callable.",
    "- Add manual entries for default exports, class components, and `forwardRef` wrappers flagged above.",
    "- Refine `description`, `required`, and enum values after the automated scan.",
    "",
  );

  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
