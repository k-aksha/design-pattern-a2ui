import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { convertDesignSystem } from "./agent.js";
import { extractCssTokens, extractJsonTokens } from "./parse-tokens.js";
import { parseComponentFile } from "./parse-components.js";
import { validateCatalog } from "./catalog.js";

const exampleRoot = fileURLToPath(new URL("../examples/acme-ds", import.meta.url));

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
