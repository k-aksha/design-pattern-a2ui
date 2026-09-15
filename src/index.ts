export { DesignSystemToA2uiAgent, convertDesignSystem } from "./agent.js";
export { scanDesignSystem } from "./scan.js";
export { buildCatalog, validateCatalog } from "./catalog.js";
export {
  ManifestGenerator,
  scanManifest,
  validateManifestFile,
  readManifestDocument,
  validateManifest,
  hasErrorDiagnostics,
} from "./manifest/agent.js";
export { generateManifest } from "./manifest/generate.js";
export { mergeManifests } from "./manifest/merge.js";
export { emitManifestArtifacts } from "./manifest/emit.js";
export type {
  A2uiCatalog,
  ConversionOptions,
  ConversionResult,
  DesignSystemInventory,
} from "./types.js";
export type {
  ManifestDocument,
  ManifestComponent,
  ManifestProp,
  ScanDiagnostic,
  GenerateManifestOptions,
  ScanManifestOptions,
  ScanManifestResult,
  ValidateManifestResult,
} from "./manifest/types.js";
