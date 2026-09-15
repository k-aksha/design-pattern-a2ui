/**
 * Stub client registry. Wire each catalog name to the matching design-system component.
 * catalogId: https://acme.example/a2ui/v0.9/catalog.json
 */
export const catalogId = "https://acme.example/a2ui/v0.9/catalog.json";

export const registry = {
  Alert: "Alert",
  Button: "Button",
  Card: "Card",
  TextField: "TextField",
} as const;

// import { Alert } from "components/Alert.tsx";
// import { Button } from "components/Button.tsx";
// import { Card } from "components/Card.tsx";
// import { TextField } from "components/TextField.tsx";
