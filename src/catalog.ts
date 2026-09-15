import { slugify, toCamelCase } from "./naming.js";
import type {
  A2uiCatalog,
  ComponentMapping,
  DesignSystemInventory,
  DiscoveredComponent,
  JsonSchema,
} from "./types.js";

const COMMON = "https://a2ui.org/specification/v0_9/common_types.json";

const BASIC_LAYOUT: Record<string, JsonSchema> = {
  Row: layoutComponent("Row", "Arranges children horizontally."),
  Column: layoutComponent("Column", "Arranges children vertically."),
};

export function buildCatalog(
  inventory: DesignSystemInventory,
  options: { catalogId?: string; name?: string; includeBasicLayout?: boolean } = {},
): { catalog: A2uiCatalog; mapping: ComponentMapping[] } {
  const name = options.name ?? inventory.name;
  const catalogId =
    options.catalogId ??
    inventory.catalogId ??
    `https://example.com/a2ui/v0.9/${slugify(name)}/catalog.json`;

  const components: Record<string, JsonSchema> = {};
  const mapping: ComponentMapping[] = [];

  if (options.includeBasicLayout !== false) {
    Object.assign(components, BASIC_LAYOUT);
  }

  for (const component of inventory.components) {
    const catalogName = uniqueName(component.name, components);
    components[catalogName] = componentSchema(catalogName, component);
    mapping.push({
      catalogName,
      sourcePath: component.sourcePath,
      sourceExport: component.exportName,
      props: component.props.map((prop) => ({
        source: prop.name,
        catalog: catalogPropName(prop.name, prop.kind),
        kind: prop.kind,
      })),
    });
  }

  const theme = themeSchema(inventory);
  const catalog: A2uiCatalog = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: catalogId,
    title: `${name} A2UI Catalog`,
    description: `Design-system catalog generated from ${name}. Agents must only emit components listed here.`,
    catalogId,
    components,
    functions: standardFunctions(),
    $defs: {
      CatalogComponentCommon: {
        type: "object",
        properties: {
          weight: {
            type: "number",
            description:
              "Relative flex weight when this component is a direct child of Row or Column.",
          },
        },
      },
      theme,
      anyComponent: {
        oneOf: Object.keys(components).map((componentName) => ({
          $ref: `#/components/${componentName}`,
        })),
        discriminator: { propertyName: "component" },
      },
      anyFunction: {
        oneOf: Object.keys(standardFunctions()).map((fn) => ({
          $ref: `#/functions/${fn}`,
        })),
      },
    },
  };

  return { catalog, mapping };
}

function uniqueName(name: string, existing: Record<string, JsonSchema>): string {
  if (!existing[name]) return name;
  let i = 2;
  while (existing[`${name}${i}`]) i += 1;
  return `${name}${i}`;
}

function componentSchema(name: string, component: DiscoveredComponent): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    component: { const: name },
  };
  const required = ["component"];

  for (const prop of component.props) {
    const catalogName = catalogPropName(prop.name, prop.kind);
    properties[catalogName] = propSchema(prop);
    if (prop.required) required.push(catalogName);
  }

  return {
    type: "object",
    description: component.description ?? `${name} from the source design system.`,
    allOf: [
      { $ref: `${COMMON}#/$defs/ComponentCommon` },
      { $ref: "#/$defs/CatalogComponentCommon" },
      {
        type: "object",
        properties,
        required,
      },
    ],
    unevaluatedProperties: false,
  };
}

function catalogPropName(name: string, kind: DiscoveredComponent["props"][number]["kind"]): string {
  if (kind === "action") return "action";
  if (kind === "children" && name === "children") return "children";
  return toCamelCase(name);
}

function propSchema(prop: DiscoveredComponent["props"][number]): JsonSchema {
  const description = prop.description ?? `Mapped from design-system prop '${prop.name}'.`;
  if (prop.kind === "children") {
    return nameLooksSingular(prop.name)
      ? {
          $ref: `${COMMON}#/$defs/ComponentId`,
          description: `${description} Pass a child component id, not inline children.`,
        }
      : {
          $ref: `${COMMON}#/$defs/ChildList`,
          description: `${description} Children must be referenced by id.`,
        };
  }
  if (prop.kind === "action") {
    return { $ref: `${COMMON}#/$defs/Action`, description };
  }
  if (prop.kind === "enum" && prop.enumValues?.length) {
    return {
      type: "string",
      enum: prop.enumValues,
      description,
      ...(prop.defaultValue !== undefined ? { default: prop.defaultValue } : {}),
    };
  }
  if (prop.kind === "boolean") {
    return { $ref: `${COMMON}#/$defs/DynamicBoolean`, description };
  }
  if (prop.kind === "number") {
    return { $ref: `${COMMON}#/$defs/DynamicNumber`, description };
  }
  return { $ref: `${COMMON}#/$defs/DynamicString`, description };
}

function nameLooksSingular(name: string): boolean {
  return /^(child|content)$/i.test(name);
}

function layoutComponent(name: "Row" | "Column", description: string): JsonSchema {
  return {
    type: "object",
    description,
    allOf: [
      { $ref: `${COMMON}#/$defs/ComponentCommon` },
      { $ref: "#/$defs/CatalogComponentCommon" },
      {
        type: "object",
        properties: {
          component: { const: name },
          children: {
            $ref: `${COMMON}#/$defs/ChildList`,
            description: "Child component ids or a template over a data list.",
          },
          justify: {
            type: "string",
            enum: ["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"],
            default: "start",
          },
          align: {
            type: "string",
            enum: ["start", "center", "end", "stretch"],
            default: "stretch",
          },
        },
        required: ["component", "children"],
      },
    ],
    unevaluatedProperties: false,
  };
}

function themeSchema(inventory: DesignSystemInventory): JsonSchema {
  const properties: Record<string, JsonSchema> = {
    primaryColor: {
      type: "string",
      pattern: "^#[0-9a-fA-F]{6}$",
      description: "Primary brand color as a 6-digit hex value.",
    },
  };

  const used = new Set(["primaryColor"]);
  for (const token of inventory.tokens) {
    const key = sanitizeThemeKey(token.name);
    if (!key || used.has(key)) continue;
    used.add(key);
    properties[key] = {
      type: typeof token.value === "number" ? "number" : "string",
      description: `Token ${token.path.join(".")} from the design system.`,
      ...(typeof token.value === "string" && token.type === "color" && /^#[0-9a-fA-F]{6}$/.test(token.value)
        ? { pattern: "^#[0-9a-fA-F]{6}$", default: token.value }
        : { default: token.value }),
    };
  }

  return {
    type: "object",
    properties,
    additionalProperties: true,
  };
}

function sanitizeThemeKey(name: string): string | undefined {
  const key = toCamelCase(name);
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return undefined;
  return key;
}

function standardFunctions(): Record<string, JsonSchema> {
  return {
    required: {
      type: "object",
      description: "Validates that a value is present.",
      properties: {
        call: { const: "required" },
        args: { type: "object", additionalProperties: false },
        returnType: { const: "boolean" },
      },
      required: ["call", "args"],
      unevaluatedProperties: false,
    },
    formatString: {
      type: "object",
      description: "Formats a string template.",
      properties: {
        call: { const: "formatString" },
        args: {
          type: "object",
          properties: {
            template: { $ref: `${COMMON}#/$defs/DynamicString` },
          },
          required: ["template"],
        },
        returnType: { const: "string" },
      },
      required: ["call", "args"],
      unevaluatedProperties: false,
    },
  };
}

export function validateCatalog(catalog: A2uiCatalog): string[] {
  const errors: string[] = [];
  if (!catalog.catalogId) errors.push("catalogId is required");
  if (catalog.catalogId !== catalog.$id) errors.push("$id must match catalogId");
  if (!catalog.components || Object.keys(catalog.components).length === 0) {
    errors.push("catalog must define at least one component");
  }
  for (const [name, schema] of Object.entries(catalog.components)) {
    const json = JSON.stringify(schema);
    if (!json.includes(`"const":"${name}"`) && !json.includes(`"const": "${name}"`)) {
      errors.push(`component ${name} must set component const to its name`);
    }
  }
  return errors;
}
