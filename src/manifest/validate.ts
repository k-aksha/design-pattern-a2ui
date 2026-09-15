import type { ManifestDocument, ScanDiagnostic, ValidateManifestResult } from "./types.js";
import { VALID_PROP_KINDS } from "./types.js";

export function validateManifest(manifest: ManifestDocument): ValidateManifestResult {
  const diagnostics: ScanDiagnostic[] = [];

  if (manifest.name !== undefined && typeof manifest.name !== "string") {
    diagnostics.push({
      level: "error",
      code: "invalid-name",
      message: "Manifest name must be a string.",
    });
  }

  if (manifest.catalogId !== undefined) {
    if (typeof manifest.catalogId !== "string" || !/^https?:\/\//.test(manifest.catalogId)) {
      diagnostics.push({
        level: "error",
        code: "invalid-catalog-id",
        message: "catalogId must be an http(s) URI string.",
      });
    }
  }

  if (manifest.components !== undefined && !Array.isArray(manifest.components)) {
    diagnostics.push({
      level: "error",
      code: "invalid-components",
      message: "components must be an array.",
    });
    return { valid: false, diagnostics };
  }

  const seenNames = new Set<string>();

  for (const component of manifest.components ?? []) {
    if (!component.name || typeof component.name !== "string") {
      diagnostics.push({
        level: "error",
        code: "missing-component-name",
        message: "Each component must have a name.",
      });
      continue;
    }

    if (!/^[A-Z][A-Za-z0-9]*$/.test(component.name)) {
      diagnostics.push({
        level: "error",
        code: "invalid-component-name",
        message: `Component name "${component.name}" must be PascalCase.`,
        component: component.name,
      });
    }

    if (seenNames.has(component.name)) {
      diagnostics.push({
        level: "error",
        code: "duplicate-component-name",
        message: `Duplicate component name "${component.name}".`,
        component: component.name,
      });
    }
    seenNames.add(component.name);

    if (component.includeInCatalog !== undefined && typeof component.includeInCatalog !== "boolean") {
      diagnostics.push({
        level: "error",
        code: "invalid-include-in-catalog",
        message: `includeInCatalog for "${component.name}" must be a boolean.`,
        component: component.name,
      });
    }

    const propNames = new Set<string>();
    for (const prop of component.props ?? []) {
      if (!prop.name || typeof prop.name !== "string") {
        diagnostics.push({
          level: "error",
          code: "missing-prop-name",
          message: `Component "${component.name}" has a prop without a name.`,
          component: component.name,
        });
        continue;
      }

      if (propNames.has(prop.name)) {
        diagnostics.push({
          level: "error",
          code: "duplicate-prop-name",
          message: `Duplicate prop "${prop.name}" on component "${component.name}".`,
          component: component.name,
        });
      }
      propNames.add(prop.name);

      if (!VALID_PROP_KINDS.includes(prop.kind)) {
        diagnostics.push({
          level: "error",
          code: "invalid-prop-kind",
          message: `Prop "${prop.name}" on "${component.name}" has invalid kind "${prop.kind}".`,
          component: component.name,
        });
      }

      if (prop.kind === "enum" && (!prop.enumValues || prop.enumValues.length === 0)) {
        diagnostics.push({
          level: "error",
          code: "missing-enum-values",
          message: `Enum prop "${prop.name}" on "${component.name}" requires enumValues.`,
          component: component.name,
        });
      }

      if (prop.kind !== "enum" && prop.enumValues?.length) {
        diagnostics.push({
          level: "warning",
          code: "unexpected-enum-values",
          message: `Prop "${prop.name}" on "${component.name}" has enumValues but kind is "${prop.kind}".`,
          component: component.name,
        });
      }
    }

    if ((component.props ?? []).length === 0) {
      diagnostics.push({
        level: "warning",
        code: "empty-props",
        message: `Component "${component.name}" has no props defined.`,
        component: component.name,
      });
    }
  }

  const valid = !diagnostics.some((entry) => entry.level === "error");
  return { valid, diagnostics };
}

export function hasErrorDiagnostics(diagnostics: ScanDiagnostic[]): boolean {
  return diagnostics.some((entry) => entry.level === "error");
}
