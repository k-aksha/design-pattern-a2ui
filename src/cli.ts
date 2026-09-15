#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { convertDesignSystem } from "./agent.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    catalogId: { type: "string" },
    name: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  printHelp();
  process.exit(0);
}

let command = positionals[0];
let inputPath = positionals[1];
if (command && command !== "convert" && command !== "help") {
  inputPath = command;
  command = "convert";
}

if (!command || command === "help") {
  printHelp();
  process.exit(command === "help" ? 0 : 1);
}

if (!inputPath) {
  console.error("Missing design-system path.");
  printHelp();
  process.exit(1);
}

const outDir = values.out ?? `${inputPath.replace(/\/$/, "")}/a2ui`;
const result = convertDesignSystem({
  input: inputPath,
  outDir,
  catalogId: values.catalogId,
  name: values.name,
});

console.log(`Converted ${result.inventory.name}`);
console.log(`  components: ${Object.keys(result.catalog.components).length}`);
console.log(`  source components: ${result.inventory.components.length}`);
console.log(`  tokens: ${result.inventory.tokens.length}`);
console.log(`  catalogId: ${result.catalog.catalogId}`);
console.log(`  out: ${resolve(outDir)}`);

function printHelp() {
  console.log(`ds2a2ui — convert a design system into an A2UI v0.9 catalog

Usage:
  ds2a2ui convert <design-system-path> [--out <dir>] [--catalogId <uri>] [--name <name>]

Writes catalog.json, mapping.json, agent-prompt.md, client-capabilities.json,
and react-registry.stub.ts.
`);
}
