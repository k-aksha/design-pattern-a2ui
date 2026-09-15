import ts from "typescript";
import type { ManifestProp } from "./types.js";
import type { ScanDiagnostic } from "./types.js";
import { mapTypeToPropKind, shouldSkipProp } from "./map-types.js";
import type { ExtractedComponentRef } from "./extract-components.js";
import type { TypeScriptProgramContext } from "./tsc-program.js";

export function extractPropsForComponent(
  ctx: TypeScriptProgramContext,
  component: ExtractedComponentRef,
): { props: ManifestProp[]; diagnostics: ScanDiagnostic[] } {
  const diagnostics: ScanDiagnostic[] = [];
  const props: ManifestProp[] = [];

  const fn =
    ts.isFunctionDeclaration(component.node) ||
    ts.isArrowFunction(component.node) ||
    ts.isFunctionExpression(component.node)
      ? component.node
      : undefined;

  if (!fn) {
    diagnostics.push({
      level: "warning",
      code: "unsupported-component-shape",
      message: `Could not extract props for "${component.name}".`,
      file: component.source,
      component: component.name,
    });
    return { props, diagnostics };
  }

  const param = fn.parameters[0];
  if (!param) {
    diagnostics.push({
      level: "warning",
      code: "missing-props-parameter",
      message: `Component "${component.name}" has no props parameter.`,
      file: component.source,
      component: component.name,
    });
    return { props, diagnostics };
  }

  const propsType = resolveParameterType(ctx.checker, param);
  if (!propsType) {
    diagnostics.push({
      level: "warning",
      code: "unresolved-props-type",
      message: `Could not resolve props type for "${component.name}".`,
      file: component.source,
      component: component.name,
    });
    return { props, diagnostics };
  }

  for (const prop of getProperties(ctx.checker, propsType)) {
    if (shouldSkipProp(prop.name)) continue;

    const mapped = mapTypeToPropKind(ctx.checker, prop.type, prop.name, component.source);
    diagnostics.push(...mapped.diagnostics);

    const manifestProp: ManifestProp = {
      name: prop.name,
      kind: mapped.kind,
      required: prop.required,
      description: prop.description,
    };
    if (mapped.enumValues?.length) manifestProp.enumValues = mapped.enumValues;
    props.push(manifestProp);
  }

  if (props.length === 0) {
    diagnostics.push({
      level: "warning",
      code: "empty-props",
      message: `Component "${component.name}" has no catalog-relevant props.`,
      file: component.source,
      component: component.name,
    });
  }

  return { props, diagnostics };
}

type ResolvedProp = {
  name: string;
  type: ts.Type;
  required: boolean;
  description?: string;
};

function resolveParameterType(checker: ts.TypeChecker, param: ts.ParameterDeclaration): ts.Type | undefined {
  if (param.type) {
    return checker.getTypeFromTypeNode(param.type);
  }

  if (ts.isObjectBindingPattern(param.name)) {
    return checker.getTypeAtLocation(param);
  }

  return checker.getTypeAtLocation(param);
}

function getProperties(checker: ts.TypeChecker, type: ts.Type): ResolvedProp[] {
  const props: ResolvedProp[] = [];
  for (const symbol of type.getProperties()) {
    if (symbol.flags & ts.SymbolFlags.Method) continue;
    const name = symbol.getName();
    if (shouldSkipProp(name)) continue;

    const declarations = symbol.getDeclarations();
    const decl = declarations?.[0];
    const propType = checker.getTypeOfSymbolAtLocation(symbol, decl ?? symbol.valueDeclaration!);
    const required = !Boolean(
      decl && ts.isPropertySignature(decl) && decl.questionToken,
    ) && !Boolean(
      decl && ts.isPropertyDeclaration(decl) && decl.questionToken,
    );

    props.push({
      name,
      type: propType,
      required,
      description: jsDocDescription(symbol, checker),
    });
  }
  return props;
}

function jsDocDescription(symbol: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const tags = symbol.getJsDocTags();
  for (const tag of tags) {
    if (tag.name === "deprecated") continue;
  }
  const comment = symbol.getDocumentationComment(checker);
  if (comment.length) {
    return ts.displayPartsToString(comment).trim() || undefined;
  }
  return undefined;
}
