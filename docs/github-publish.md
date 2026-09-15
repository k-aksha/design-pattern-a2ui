# Publishing on GitHub (open source)

This project is meant to be **public on GitHub** so design-system teams, agent engineers, and product builders can discover and use it without a private toolchain.

## Who should star or fork this repo

- **Designers & design ops** — understand how tokens and component names become an agent-facing catalog
- **Design-system engineers** — automate catalog generation when components ship
- **Agent / platform engineers** — get `catalog.json` + `agent-prompt.md` for allowlisted GenUI
- **Product teams** — add AI UI to brownfield apps without abandoning their design system

## Before you push

1. **License** — [`LICENSE`](../LICENSE) (Apache-2.0) is included at the repo root.
2. **Secrets** — never commit `.env`, API keys, or private `catalogId` URLs if they encode internal infra. Use example domains (`https://yourco.com/...`).
3. **Generated output** — `examples/acme-ds/a2ui/` is checked in as a reference; your own conversions can stay gitignored under `**/a2ui/` if you prefer (already ignored during scan).

## Create a public GitHub repository

From the project root (after your first commit):

```bash
# Install GitHub CLI: https://cli.github.com/
gh auth login

gh repo create design-pattern-a2ui \
  --public \
  --source=. \
  --remote=origin \
  --description "Convert any design system into an A2UI v0.9 catalog for GenUI agents" \
  --push
```

If the repo already exists locally with commits:

```bash
git remote add origin https://github.com/YOUR_ORG/design-pattern-a2ui.git
git push -u origin main
```

## Make it easy to find

On the GitHub repo **About** section, set:

- **Description:** Convert design systems to A2UI v0.9 catalogs for agent-generated UI
- **Topics:** `a2ui`, `design-system`, `generative-ui`, `json-schema`, `agent`, `react`, `design-tokens`

Add a link in the README to [Use cases](./use-cases.md) and the [A2UI protocol](https://a2ui.org/catalogs/).

## Share with designers

Designers do not need to run Node locally to benefit:

1. Read [use-cases.md](./use-cases.md) — especially tokens/theme and multi-brand flows
2. Pair with engineering on `a2ui.manifest.json` to define which components agents may use
3. Review generated `mapping.json` to confirm prop names match design language

Engineers run the CLI; designers own naming, allowlists, and theme tokens.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md). Issues and PRs welcome for new scanners (e.g. Svelte, Flutter), better token parsers, and documentation.
