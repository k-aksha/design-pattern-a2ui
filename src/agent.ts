import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalog, validateCatalog } from "./catalog.js";
import { emitArtifacts } from "./emit.js";
import { scanDesignSystem } from "./scan.js";
import type { ConversionOptions, ConversionResult } from "./types.js";

export class DesignSystemToA2uiAgent {
  convert(options: ConversionOptions): ConversionResult {
    const input = resolve(options.input);
    const outDir = resolve(options.outDir);
    mkdirSync(outDir, { recursive: true });

    const inventory = scanDesignSystem(input, {
      manifestPath: options.manifestPath,
      fillMissing: options.fillMissing,
    });
    const { catalog, mapping } = buildCatalog(inventory, {
      catalogId: options.catalogId,
      name: options.name ?? inventory.name,
      includeBasicLayout: options.includeBasicLayout,
    });

    const errors = validateCatalog(catalog);
    if (errors.length) {
      throw new Error(`Generated catalog is invalid:\n- ${errors.join("\n- ")}`);
    }

    const files = emitArtifacts({ outDir, catalog, mapping, inventory });
    return { catalog, mapping, inventory, files };
  }
}

export function convertDesignSystem(options: ConversionOptions): ConversionResult {
  return new DesignSystemToA2uiAgent().convert(options);
}
