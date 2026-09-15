import type { ManifestComponent, ManifestDocument, ManifestProp, MergeManifestOptions } from "./types.js";

export function mergeManifests(options: MergeManifestOptions): ManifestDocument {
  const { scanned, existing, force } = options;

  if (force || !existing) {
    return {
      ...scanned,
      name: scanned.name ?? existing?.name,
      catalogId: scanned.catalogId ?? existing?.catalogId,
      components: scanned.components ?? [],
    };
  }

  const existingByName = new Map((existing.components ?? []).map((entry) => [entry.name, entry]));
  const mergedComponents: ManifestComponent[] = [];

  for (const scannedComponent of scanned.components ?? []) {
    const prior = existingByName.get(scannedComponent.name);
    if (!prior) {
      mergedComponents.push(scannedComponent);
      continue;
    }
    existingByName.delete(scannedComponent.name);
    mergedComponents.push(mergeComponent(scannedComponent, prior));
  }

  for (const leftover of existingByName.values()) {
    mergedComponents.push(leftover);
  }

  return {
    $schema: scanned.$schema ?? existing.$schema,
    name: scanned.name ?? existing.name,
    catalogId: scanned.catalogId ?? existing.catalogId,
    components: mergedComponents,
  };
}

function mergeComponent(scanned: ManifestComponent, existing: ManifestComponent): ManifestComponent {
  const existingProps = new Map((existing.props ?? []).map((prop) => [prop.name, prop]));

  const mergedProps: ManifestProp[] = (scanned.props ?? []).map((prop) => {
    const prior = existingProps.get(prop.name);
    if (!prior) return prop;
    existingProps.delete(prop.name);
    return {
      ...prop,
      description: prior.description ?? prop.description,
      required: prior.required ?? prop.required,
      kind: prior.kind ?? prop.kind,
      enumValues: prior.enumValues ?? prop.enumValues,
      defaultValue: prior.defaultValue ?? prop.defaultValue,
    };
  });

  for (const leftover of existingProps.values()) {
    mergedProps.push(leftover);
  }

  return {
    ...scanned,
    exportName: existing.exportName ?? scanned.exportName,
    source: existing.source ?? scanned.source,
    description: existing.description ?? scanned.description,
    includeInCatalog: existing.includeInCatalog ?? scanned.includeInCatalog,
    props: mergedProps,
  };
}
