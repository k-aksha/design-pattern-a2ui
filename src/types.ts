export type DesignToken = {
  name: string;
  path: string[];
  value: string | number;
  type?: string;
  source: string;
};

export type PropKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "children"
  | "action"
  | "unknown";

export type ComponentProp = {
  name: string;
  kind: PropKind;
  required: boolean;
  description?: string;
  enumValues?: string[];
  defaultValue?: string | number | boolean;
};

export type DiscoveredComponent = {
  name: string;
  exportName?: string;
  sourcePath: string;
  description?: string;
  props: ComponentProp[];
};

export type DesignSystemInventory = {
  name: string;
  catalogId?: string;
  root: string;
  components: DiscoveredComponent[];
  tokens: DesignToken[];
};

export type ConversionOptions = {
  input: string;
  outDir: string;
  catalogId?: string;
  name?: string;
  includeBasicLayout?: boolean;
};

export type ConversionResult = {
  catalog: A2uiCatalog;
  mapping: ComponentMapping[];
  inventory: DesignSystemInventory;
  files: Record<string, string>;
};

export type ComponentMapping = {
  catalogName: string;
  sourcePath: string;
  sourceExport?: string;
  props: Array<{ source: string; catalog: string; kind: PropKind }>;
};

export type JsonSchema = Record<string, unknown>;

export type A2uiCatalog = {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  catalogId: string;
  components: Record<string, JsonSchema>;
  functions: Record<string, JsonSchema>;
  $defs: Record<string, JsonSchema>;
};
