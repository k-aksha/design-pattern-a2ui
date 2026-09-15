import type { PropKind } from "../types.js";

export type DiagnosticLevel = "error" | "warning" | "info";

export type ScanDiagnostic = {
  level: DiagnosticLevel;
  code: string;
  message: string;
  file?: string;
  component?: string;
};

export type ManifestProp = {
  name: string;
  kind: PropKind;
  required?: boolean;
  description?: string;
  enumValues?: string[];
  defaultValue?: string | number | boolean;
};

export type ManifestComponent = {
  name: string;
  exportName?: string;
  source?: string;
  description?: string;
  includeInCatalog?: boolean;
  props?: ManifestProp[];
};

export type ManifestDocument = {
  $schema?: string;
  name?: string;
  catalogId?: string;
  components?: ManifestComponent[];
};

export type GenerateManifestOptions = {
  input: string;
  project?: string;
  name?: string;
  catalogId?: string;
  include?: string[];
  exclude?: string[];
};

export type GenerateManifestResult = {
  manifest: ManifestDocument;
  diagnostics: ScanDiagnostic[];
};

export type MergeManifestOptions = {
  scanned: ManifestDocument;
  existing?: ManifestDocument;
  force?: boolean;
};

export type ValidateManifestResult = {
  valid: boolean;
  diagnostics: ScanDiagnostic[];
};

export type EmitManifestOptions = {
  outDir: string;
  manifestFile?: string;
  manifest: ManifestDocument;
  diagnostics: ScanDiagnostic[];
};

export type ScanManifestOptions = GenerateManifestOptions & {
  outDir?: string;
  manifestFile?: string;
  merge?: boolean;
  force?: boolean;
};

export type ScanManifestResult = {
  manifest: ManifestDocument;
  diagnostics: ScanDiagnostic[];
  files: Record<string, string>;
};

export const MANIFEST_SCHEMA_URL = "./node_modules/design-pattern-a2ui/manifest.schema.json";

export const MANIFEST_FILENAMES = ["a2ui.manifest.json", "design-system.manifest.json"] as const;

export const VALID_PROP_KINDS: PropKind[] = [
  "string",
  "number",
  "boolean",
  "enum",
  "children",
  "action",
  "unknown",
];
