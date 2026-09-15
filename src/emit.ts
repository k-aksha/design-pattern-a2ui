import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { A2uiCatalog, ComponentMapping, DesignSystemInventory } from "./types.js";

export function emitArtifacts(options: {
  outDir: string;
  catalog: A2uiCatalog;
  mapping: ComponentMapping[];
  inventory: DesignSystemInventory;
}): Record<string, string> {
  mkdirSync(options.outDir, { recursive: true });

  const files: Record<string, string> = {
    "catalog.json": JSON.stringify(options.catalog, null, 2) + "\n",
    "mapping.json": JSON.stringify(
      {
        catalogId: options.catalog.catalogId,
        designSystem: options.inventory.name,
        components: options.mapping,
        tokenCount: options.inventory.tokens.length,
      },
      null,
      2,
    ) + "\n",
    "agent-prompt.md": agentPrompt(options.catalog, options.mapping),
    "client-capabilities.json": JSON.stringify(
      {
        "v0.9": {
          supportedCatalogIds: [options.catalog.catalogId],
        },
      },
      null,
      2,
    ) + "\n",
    "react-registry.stub.ts": reactStub(options.catalog, options.mapping),
  };

  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(options.outDir, name), contents);
  }

  return files;
}

function agentPrompt(catalog: A2uiCatalog, mapping: ComponentMapping[]): string {
  const names = Object.keys(catalog.components);
  return `# ${catalog.title}

You generate A2UI v0.9 surfaces for this design system.

## Catalog

- catalogId: \`${catalog.catalogId}\`
- Only emit components from this allowlist: ${names.map((n) => `\`${n}\``).join(", ")}
- Every component object MUST include \`"component": "<Name>"\` and an \`id\`.
- Children are referenced by id. Never nest component objects inline.
- Bind live values with \`{ "path": "/data/..." }\` instead of inventing literals when data exists.
- Use \`createSurface.catalogId\` = \`${catalog.catalogId}\`.

## Source mapping

${mapping
  .map(
    (item) =>
      `- \`${item.catalogName}\` ← \`${item.sourceExport ?? item.catalogName}\` (${item.sourcePath})`,
  )
  .join("\n")}

## Message shape

\`\`\`json
{
  "version": "v0.9",
  "createSurface": {
    "surfaceId": "main",
    "catalogId": "${catalog.catalogId}"
  }
}
\`\`\`
`;
}

function reactStub(catalog: A2uiCatalog, mapping: ComponentMapping[]): string {
  const imports = mapping
    .filter((item) => item.sourceExport && item.sourcePath !== "manifest")
    .map((item) => `// import { ${item.sourceExport} } from "${item.sourcePath}";`)
    .join("\n");

  return `/**
 * Stub client registry. Wire each catalog name to the matching design-system component.
 * catalogId: ${catalog.catalogId}
 */
export const catalogId = ${JSON.stringify(catalog.catalogId)};

export const registry = {
${mapping.map((item) => `  ${item.catalogName}: "${item.sourceExport ?? item.catalogName}",`).join("\n")}
} as const;

${imports}
`;
}
