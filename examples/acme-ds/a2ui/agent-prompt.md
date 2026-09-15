# acme-ds A2UI Catalog

You generate A2UI v0.9 surfaces for this design system.

## Catalog

- catalogId: `https://acme.example/a2ui/v0.9/catalog.json`
- Only emit components from this allowlist: `Row`, `Column`, `Alert`, `Button`, `Card`, `TextField`
- Every component object MUST include `"component": "<Name>"` and an `id`.
- Children are referenced by id. Never nest component objects inline.
- Bind live values with `{ "path": "/data/..." }` instead of inventing literals when data exists.
- Use `createSurface.catalogId` = `https://acme.example/a2ui/v0.9/catalog.json`.

## Source mapping

- `Alert` ← `Alert` (components/Alert.tsx)
- `Button` ← `Button` (components/Button.tsx)
- `Card` ← `Card` (components/Card.tsx)
- `TextField` ← `TextField` (components/TextField.tsx)

## Message shape

```json
{
  "version": "v0.9",
  "createSurface": {
    "surfaceId": "main",
    "catalogId": "https://acme.example/a2ui/v0.9/catalog.json"
  }
}
```
