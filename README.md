# Design system → A2UI

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Convert an existing design system into an [A2UI v0.9](https://a2ui.org/catalogs/) catalog — the JSON Schema contract a GenUI agent uses to emit UI your client already renders.

A2UI recommends catalogs that **mirror your component library** rather than mapping the Basic Catalog through adapters. This tool automates that conversion offline (no Google SDK, no LLM calls).

## Who this is for

| Persona | Job to be done |
| --- | --- |
| **Design-system / platform engineers** | Turn `Button`, `Card`, tokens into a catalog agents can safely call by name |
| **GenUI / A2A agent engineers** | Ship `catalog.json` + `agent-prompt.md` as an allowlist for the model |
| **Product teams (brownfield)** | Add AI UI without replacing your existing design language |
| **Design ops / multi-brand** | Generate per-brand catalogs and themes from token files |

**Not for:** Figma-to-code, production renderers, or a hosted A2UI client — this generates the **agent-facing contract** only.

## Use cases

Detailed stories with who benefits, commands, and next steps:

1. [Mature React/Vue design system → agent-safe catalog](docs/use-cases.md#1-mature-react-or-vue-design-system--agent-safe-catalog)
2. [Constrain a GenUI agent to your allowlist](docs/use-cases.md#2-constrain-a-genui-agent-to-your-allowlist)
3. [Brownfield product — keep your visual language](docs/use-cases.md#3-brownfield-product--keep-your-visual-language)
4. [Tokens and theme without full typed components](docs/use-cases.md#4-tokens-and-theme-without-a-full-typed-component-library)
5. [Explicit inventory with a manifest](docs/use-cases.md#5-explicit-inventory-with-a-manifest-security-allowlist)
6. [Multi-brand and white-label](docs/use-cases.md#6-multi-brand-and-white-label)

See the full guide: **[docs/use-cases.md](docs/use-cases.md)**

## What it produces

| File | Role |
| --- | --- |
| `catalog.json` | A2UI catalog (`catalogId`, components, functions, theme) |
| `mapping.json` | Source component/prop → catalog names |
| `agent-prompt.md` | Instructions for a GenUI agent using this catalog |
| `client-capabilities.json` | `supportedCatalogIds` handshake payload |
| `react-registry.stub.ts` | Client registration stub |

## Usage

```bash
npm install
npx tsx src/cli.ts convert examples/acme-ds --out examples/acme-ds/a2ui
```

Or against any design-system tree:

```bash
npx tsx src/cli.ts convert /path/to/your-ds --catalogId https://yourco.com/a2ui/v0.9/catalog.json
```

Programmatic:

```ts
import { DesignSystemToA2uiAgent } from "design-pattern-a2ui";

const agent = new DesignSystemToA2uiAgent();
const result = agent.convert({
  input: "./packages/ui",
  outDir: "./a2ui",
  catalogId: "https://yourco.com/a2ui/v0.9/catalog.json",
});
```

## What it scans

- Exported React/TSX function components and their props types (`type` / `interface`)
- Vue SFCs with `defineProps`
- CSS custom properties (`--color-primary`)
- Token JSON (Style Dictionary / DTCG `{ "value": ... }` trees)
- Optional `a2ui.manifest.json` or `design-system.manifest.json` for an explicit inventory

Example manifest:

```json
{
  "name": "acme-ds",
  "catalogId": "https://acme.example/a2ui/v0.9/catalog.json",
  "components": [
    {
      "name": "Button",
      "source": "src/Button.tsx",
      "props": [
        { "name": "label", "kind": "string", "required": true },
        { "name": "variant", "kind": "enum", "enumValues": ["primary", "ghost"] }
      ]
    }
  ]
}
```

## After conversion

1. Register matching renderers in your A2UI client under the same component names.
2. Advertise `catalog.json`'s `catalogId` via `supportedCatalogIds`.
3. Give generating agents `agent-prompt.md` plus the catalog schema.
4. On `createSurface`, set `catalogId` to that URI. Surfaces stay locked to one catalog.

## Open source on GitHub

This repo is structured for public sharing so designers and engineers can discover it together:

- **[Publishing on GitHub](docs/github-publish.md)** — create a public repo, topics, and how designers collaborate without running the CLI
- **[Contributing](CONTRIBUTING.md)** — development setup and PR guidelines
- **[License](LICENSE)** — Apache-2.0

## Related

- [A2UI catalogs](https://a2ui.org/catalogs/)
- [Defining your own catalog](https://a2ui.org/guides/defining-your-own-catalog/)
