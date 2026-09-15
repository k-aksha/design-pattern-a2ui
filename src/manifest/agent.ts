import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { emitManifestArtifacts } from "./emit.js";
import { generateManifest } from "./generate.js";
import { mergeManifests } from "./merge.js";
import { hasErrorDiagnostics, validateManifest } from "./validate.js";
import type {
  GenerateManifestOptions,
  ManifestDocument,
  ScanManifestOptions,
  ScanManifestResult,
  ValidateManifestResult,
} from "./types.js";
import { MANIFEST_FILENAMES } from "./types.js";

export type ValidateManifestOptions = {
  input: string;
  manifestPath?: string;
};

export class ManifestGenerator {
  scan(options: ScanManifestOptions): ScanManifestResult {
    const input = resolve(options.input);
    const outDir = resolve(options.outDir ?? input);
    const manifestFile = options.manifestFile ?? "a2ui.manifest.json";

    const generated = generateManifest(options);
    const existing = readExistingManifest(input, manifestFile, options.merge !== false);
    const manifest = mergeManifests({
      scanned: generated.manifest,
      existing,
      force: options.force,
    });

    const validation = validateManifest(manifest);
    const diagnostics = [...generated.diagnostics, ...validation.diagnostics];

    const files = emitManifestArtifacts({
      outDir,
      manifestFile,
      manifest,
      diagnostics,
    });

    return { manifest, diagnostics, files };
  }

  validate(options: ValidateManifestOptions): ValidateManifestResult {
    const input = resolve(options.input);
    const manifest = readManifestDocument(input, options.manifestPath);
    if (!manifest) {
      return {
        valid: false,
        diagnostics: [
          {
            level: "error",
            code: "manifest-not-found",
            message: "No manifest file found. Run ds2a2ui scan first or pass --manifest.",
          },
        ],
      };
    }
    return validateManifest(manifest);
  }

  generate(options: GenerateManifestOptions) {
    return generateManifest(options);
  }
}

export function scanManifest(options: ScanManifestOptions): ScanManifestResult {
  return new ManifestGenerator().scan(options);
}

export function validateManifestFile(options: ValidateManifestOptions): ValidateManifestResult {
  return new ManifestGenerator().validate(options);
}

export function readManifestDocument(root: string, manifestPath?: string): ManifestDocument | undefined {
  if (manifestPath) {
    const abs = resolve(manifestPath);
    if (!existsSync(abs)) return undefined;
    return JSON.parse(readFileSync(abs, "utf8")) as ManifestDocument;
  }

  for (const name of MANIFEST_FILENAMES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, "utf8")) as ManifestDocument;
  }
  return undefined;
}

function readExistingManifest(
  root: string,
  manifestFile: string,
  merge: boolean,
): ManifestDocument | undefined {
  if (!merge) return undefined;
  const path = join(root, manifestFile);
  if (!existsSync(path)) return readManifestDocument(root);
  return JSON.parse(readFileSync(path, "utf8")) as ManifestDocument;
}

export { hasErrorDiagnostics, validateManifest };
