import { relative } from "node:path";
import ts from "typescript";
import { toPascalCase } from "../naming.js";
import type { ScanDiagnostic } from "./types.js";
import type { TypeScriptProgramContext } from "./tsc-program.js";

const SKIP_EXPORTS = new Set([
  "default",
  "props",
  "cn",
  "clsx",
  "classNames",
  "useTheme",
  "theme",
]);

export type ExtractedComponentRef = {
  name: string;
  exportName: string;
  source: string;
  sourceFile: ts.SourceFile;
  node: ts.Node;
  description?: string;
};

export function extractComponentsFromProgram(
  ctx: TypeScriptProgramContext,
): { components: ExtractedComponentRef[]; diagnostics: ScanDiagnostic[] } {
  const components: ExtractedComponentRef[] = [];
  const diagnostics: ScanDiagnostic[] = [];
  const seen = new Set<string>();

  for (const sourceFile of ctx.program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (sourceFile.fileName.includes("node_modules")) continue;
    if (/\.(test|spec|stories)\.[tj]sx?$/i.test(sourceFile.fileName)) continue;

    const rel = relative(ctx.root, sourceFile.fileName);
    if (rel.startsWith("..")) continue;

    const visit = (node: ts.Node) => {
      if (ts.isExportAssignment(node)) {
        diagnostics.push({
          level: "warning",
          code: "default-export-only",
          message: "Default export components are not auto-discovered; add a manual manifest entry.",
          file: rel,
        });
      }

      if (ts.isClassDeclaration(node) && node.name && isExported(node) && looksLikeComponent(node.name.text)) {
        diagnostics.push({
          level: "warning",
          code: "class-component",
          message: `Class component "${node.name.text}" is not auto-discovered; add a manual manifest entry.`,
          file: rel,
          component: node.name.text,
        });
      }

      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr) && expr.text === "forwardRef") {
          diagnostics.push({
            level: "warning",
            code: "forward-ref-component",
            message: "forwardRef components are not auto-discovered; add a manual manifest entry.",
            file: rel,
          });
        }
      }

      if (ts.isFunctionDeclaration(node) && node.name && isExported(node) && looksLikeComponent(node.name.text)) {
        addComponent(node.name.text, node, sourceFile, rel);
      }

      if (ts.isVariableStatement(node) && isExported(node)) {
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          if (!looksLikeComponent(decl.name.text)) continue;
          const init = decl.initializer;
          if (!init) continue;

          if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
            addComponent(decl.name.text, init, sourceFile, rel);
            continue;
          }

          if (ts.isCallExpression(init)) {
            const callee = init.expression;
            if (ts.isIdentifier(callee) && (callee.text === "forwardRef" || callee.text === "memo")) {
              diagnostics.push({
                level: "warning",
                code: "wrapped-component",
                message: `Wrapped component "${decl.name.text}" may need a manual manifest entry.`,
                file: rel,
                component: decl.name.text,
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    function addComponent(exportName: string, node: ts.Node, sf: ts.SourceFile, source: string) {
      const name = toPascalCase(exportName);
      if (seen.has(name)) {
        diagnostics.push({
          level: "error",
          code: "duplicate-component-name",
          message: `Duplicate component name "${name}" found during scan.`,
          file: source,
          component: name,
        });
        return;
      }
      seen.add(name);
      components.push({
        name,
        exportName,
        source,
        sourceFile: sf,
        node,
        description: leadingComment(sf, node),
      });
    }
  }

  return { components, diagnostics };
}

function isExported(node: ts.Node): boolean {
  return Boolean(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export);
}

function looksLikeComponent(name: string): boolean {
  return /^[A-Z]/.test(name) && !SKIP_EXPORTS.has(name);
}

function leadingComment(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
  if (!ranges?.length) return undefined;
  const text = ranges
    .map((range) => sourceFile.text.slice(range.pos, range.end))
    .join("\n")
    .replace(/\/\*+|\*+\/|\/\/|\*/g, "")
    .trim();
  return text || undefined;
}
