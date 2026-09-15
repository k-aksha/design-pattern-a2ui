# Contributing

Thanks for helping make design-system → A2UI conversion easier for everyone.

## Ways to contribute

- **Documentation** — clearer use cases, framework guides, or translation
- **Scanners** — support for Svelte, Angular, Flutter widgets, or Storybook metadata
- **Token formats** — Style Dictionary, Tokens Studio, Tailwind theme exports
- **Examples** — small sample design systems that show one use case well
- **Bug reports** — incorrect prop inference or invalid generated catalogs

## Development setup

```bash
git clone https://github.com/YOUR_ORG/design-pattern-a2ui.git
cd design-pattern-a2ui
npm install
npm test
npx tsx src/cli.ts convert examples/acme-ds --out examples/acme-ds/a2ui
```

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] New behavior has a test in `src/agent.test.ts` when practical
- [ ] README or `docs/` updated if user-facing behavior changed
- [ ] No secrets or private URLs in committed files

## Code style

- Match existing TypeScript patterns in `src/`
- Prefer focused diffs over large refactors
- Keep the CLI offline — no required cloud APIs in core conversion

## Questions

Open a GitHub Discussion or Issue with your design-system layout (React/Vue, token format) and we can suggest the best conversion path.
