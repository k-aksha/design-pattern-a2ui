# Manifest scan report

Review this report before committing `a2ui.manifest.json`. Set `includeInCatalog: false` to exclude components without deleting entries.

## Components

| Component | Source | Props | In catalog |
| --- | --- | ---: | --- |
| Alert | components/Alert.tsx | 2 | yes |
| Button | components/Button.tsx | 4 | yes |
| Card | components/Card.tsx | 3 | yes |
| TextField | components/TextField.tsx | 5 | yes |

## Diagnostics

### Warning

| Code | Message | File | Component |
| --- | --- | --- | --- |
| unsupported-prop-type | Prop "disabled" (boolean \| undefined) mapped via naming heuristics. | components/Button.tsx | — |
| unsupported-prop-type | Prop "subtitle" (string \| undefined) mapped via naming heuristics. | components/Card.tsx | — |
| unsupported-prop-type | Prop "value" (string \| undefined) mapped via naming heuristics. | components/TextField.tsx | — |
| unsupported-prop-type | Prop "placeholder" (string \| undefined) mapped via naming heuristics. | components/TextField.tsx | — |
| unsupported-prop-type | Prop "required" (boolean \| undefined) mapped via naming heuristics. | components/TextField.tsx | — |

## Suggested manual fixes

- Set `includeInCatalog: false` for components that should not be agent-callable.
- Add manual entries for default exports, class components, and `forwardRef` wrappers flagged above.
- Refine `description`, `required`, and enum values after the automated scan.
