import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { generateManifest } from "./generate.js";
import { mergeManifests } from "./merge.js";
import { validateManifest, hasErrorDiagnostics } from "./validate.js";
import { scanManifest } from "./agent.js";
import { scanDesignSystem } from "../scan.js";
import { extractCssTokens, extractJsonTokens } from "../parse-tokens.js";
import { parseComponentFile } from "../parse-components.js";
import { validateCatalog } from "../catalog.js";
import { convertDesignSystem } from "../agent.js";

const exampleRoot = fileURLToPath(new URL("../../examples/acme-ds", import.meta.url));
const advancedRoot = fileURLToPath(new URL("../../examples/acme-ds-advanced", import.meta.url));

test("parses React component props including enums and actions", () => {
  const [button] = parseComponentFile(
    "Button.tsx",
    `
      export type ButtonProps = {
        label: string;
        variant?: "primary" | "secondary";
        onPress?: () => void;
      };
      export function Button(props: ButtonProps) {
        return <button>{props.label}</button>;
      }
    `,
  );
  assert.equal(button?.name, "Button");
  assert.deepEqual(
    button?.props.map((prop) => [prop.name, prop.kind, prop.required]),
    [
      ["label", "string", true],
      ["variant", "enum", false],
      ["onPress", "action", false],
    ],
  );
});

test("extracts CSS and JSON tokens", () => {
  const css = extractCssTokens("t.css", ":root { --color-primary: #112233; }");
  assert.equal(css[0]?.name, "colorPrimary");
  const json = extractJsonTokens("t.json", {
    color: { danger: { value: "#ff0000", type: "color" } },
  });
  assert.equal(json[0]?.name, "colorDanger");
});

test("generates cross-file props from TypeScript program", () => {
  const result = generateManifest({
    input: advancedRoot,
    name: "acme-ds-advanced",
    catalogId: "https://acme.example/a2ui/v0.9/catalog.json",
  });

  const button = result.manifest.components?.find((entry) => entry.name === "Button");
  assert.ok(button, "Button component should be discovered");
  assert.equal(button?.source, "components/Button.tsx");

  const variant = button?.props?.find((prop) => prop.name === "variant");
  assert.equal(variant?.kind, "enum");
  assert.deepEqual(variant?.enumValues, ["primary", "secondary", "ghost"]);

  const onPress = button?.props?.find((prop) => prop.name === "onPress");
  assert.equal(onPress?.kind, "action");

  const label = button?.props?.find((prop) => prop.name === "label");
  assert.equal(label?.kind, "string");
  assert.equal(label?.required, true);
  assert.match(label?.description ?? "", /label/i);
});

test("merge preserves manual descriptions after re-scan", () => {
  const generated = generateManifest({ input: advancedRoot, name: "acme-ds-advanced" });
  const merged = mergeManifests({
    scanned: generated.manifest,
    existing: {
      components: [
        {
          name: "Button",
          description: "Curated CTA button for agents",
          props: [{ name: "label", kind: "string", required: true, description: "Manual label copy" }],
        },
      ],
    },
  });

  const button = merged.components?.find((entry) => entry.name === "Button");
  assert.equal(button?.description, "Curated CTA button for agents");
  const label = button?.props?.find((prop) => prop.name === "label");
  assert.equal(label?.description, "Manual label copy");
});

test("validate rejects duplicate component names and invalid prop kinds", () => {
  const result = validateManifest({
    name: "bad",
    components: [
      { name: "Button", props: [{ name: "label", kind: "string" }] },
      { name: "Button", props: [{ name: "label", kind: "not-a-kind" as never }] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((entry) => entry.code === "duplicate-component-name"));
  assert.ok(result.diagnostics.some((entry) => entry.code === "invalid-prop-kind"));
});

test("manifest-primary scan respects includeInCatalog and fillMissing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ds2a2ui-manifest-"));
  try {
    writeFileSync(
      join(dir, "a2ui.manifest.json"),
      JSON.stringify(
        {
          name: "test-ds",
          components: [
            {
              name: "Button",
              includeInCatalog: false,
              props: [{ name: "label", kind: "string", required: true }],
            },
          ],
        },
        null,
        2,
      ),
    );
    mkdirSync(join(dir, "components"), { recursive: true });
    writeFileSync(
      join(dir, "components", "Extra.tsx"),
      `
        export type ExtraProps = { title: string };
        export function Extra(props: ExtraProps) { return <div>{props.title}</div>; }
      `,
    );

    const strictInventory = scanDesignSystem(dir);
    assert.equal(strictInventory.components.length, 0);

    const filledInventory = scanDesignSystem(dir, { fillMissing: true });
    assert.ok(filledInventory.components.some((entry) => entry.name === "Extra"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan command emits manifest and report", () => {
  const outDir = mkdtempSync(join(tmpdir(), "ds2a2ui-scan-"));
  try {
    const result = scanManifest({
      input: advancedRoot,
      outDir,
      merge: false,
      name: "acme-ds-advanced",
      catalogId: "https://acme.example/a2ui/v0.9/catalog.json",
    });

    assert.ok(result.files["a2ui.manifest.json"]);
    assert.ok(result.files["scan-report.md"]);
    assert.match(readFileSync(result.files["scan-report.md"]!, "utf8"), /Manifest scan report/);
    assert.equal(hasErrorDiagnostics(result.diagnostics), false);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("converts the sample design system into a valid A2UI catalog", () => {
  const outDir = mkdtempSync(join(tmpdir(), "ds2a2ui-"));
  try {
    const result = convertDesignSystem({ input: exampleRoot, outDir });
    assert.equal(result.catalog.catalogId, "https://acme.example/a2ui/v0.9/catalog.json");
    assert.ok(result.catalog.components.Button);
    assert.ok(result.catalog.components.Card);
    assert.ok(result.catalog.components.TextField);
    assert.ok(result.catalog.components.Alert);
    assert.ok(result.catalog.components.Row);
    assert.equal(validateCatalog(result.catalog).length, 0);
    assert.match(result.files["agent-prompt.md"]!, /catalogId/);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("converts acme-ds with manifest allowlist only", () => {
  const outDir = mkdtempSync(join(tmpdir(), "ds2a2ui-manifest-convert-"));
  const manifestDir = mkdtempSync(join(tmpdir(), "ds2a2ui-manifest-file-"));
  try {
    const manifestPath = join(manifestDir, "a2ui.manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          name: "acme-ds",
          catalogId: "https://acme.example/a2ui/v0.9/catalog.json",
          components: [
            {
              name: "Button",
              source: "components/Button.tsx",
              includeInCatalog: true,
              props: [
                { name: "label", kind: "string", required: true },
                { name: "variant", kind: "enum", enumValues: ["primary", "secondary", "ghost"] },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = convertDesignSystem({
      input: exampleRoot,
      outDir,
      manifestPath,
    });

    assert.equal(result.inventory.components.length, 1);
    assert.equal(result.inventory.components[0]?.name, "Button");
    assert.ok(result.catalog.components.Button);
    assert.equal(result.catalog.components.Alert, undefined);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(manifestDir, { recursive: true, force: true });
  }
});
