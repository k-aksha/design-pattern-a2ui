import ts from "typescript";
import type { PropKind } from "../types.js";
import { inferKind } from "../naming.js";
import type { ScanDiagnostic } from "./types.js";

export type MappedPropType = {
  kind: PropKind;
  enumValues?: string[];
  diagnostics: ScanDiagnostic[];
};

const SKIP_PROPS = new Set(["className", "style", "class", "key", "ref"]);
const CHILDREN_TYPES = new Set([
  "ReactNode",
  "ReactElement",
  "JSX.Element",
  "React.ReactNode",
  "React.ReactElement",
]);

export function shouldSkipProp(name: string): boolean {
  return SKIP_PROPS.has(name);
}

export function mapTypeToPropKind(
  checker: ts.TypeChecker,
  type: ts.Type,
  propName: string,
  file?: string,
): MappedPropType {
  const diagnostics: ScanDiagnostic[] = [];

  if (propName === "children" || propName === "child") {
    return { kind: "children", diagnostics };
  }

  const enumValues = extractStringLiteralUnion(checker, type);
  if (enumValues.length) {
    return { kind: "enum", enumValues, diagnostics };
  }

  if (checker.isTypeAssignableTo(type, checker.getStringType())) {
    return { kind: "string", diagnostics };
  }

  if (checker.isTypeAssignableTo(type, checker.getNumberType())) {
    return { kind: "number", diagnostics };
  }

  if (checker.isTypeAssignableTo(type, checker.getBooleanType())) {
    return { kind: "boolean", diagnostics };
  }

  const signatures = type.getCallSignatures();
  if (signatures.length > 0) {
    return { kind: "action", diagnostics };
  }

  if (isChildrenType(checker, type)) {
    return { kind: "children", diagnostics };
  }

  if (type.flags & ts.TypeFlags.Object) {
    const objectFlags = (type as ts.ObjectType).objectFlags;
    if (objectFlags & ts.ObjectFlags.Anonymous || objectFlags & ts.ObjectFlags.Mapped) {
      diagnostics.push({
        level: "warning",
        code: "nested-prop-type",
        message: `Prop "${propName}" has a nested object type; mapped to unknown for manual review.`,
        file,
      });
      return { kind: "unknown", diagnostics };
    }

    const symbol = type.getSymbol();
    const typeName = symbol?.getName() ?? checker.typeToString(type);
    if (/ReactNode|ReactElement|JSX\.Element|VNode|Slot/i.test(typeName)) {
      return { kind: "children", diagnostics };
    }
  }

  if (type.flags & ts.TypeFlags.Any || type.flags & ts.TypeFlags.Unknown) {
    diagnostics.push({
      level: "warning",
      code: "unresolved-prop-type",
      message: `Prop "${propName}" type could not be resolved; mapped to unknown.`,
      file,
    });
    return { kind: "unknown", diagnostics };
  }

  if (/^on[A-Z]/.test(propName)) {
    return { kind: "action", diagnostics };
  }

  diagnostics.push({
    level: "warning",
    code: "unsupported-prop-type",
    message: `Prop "${propName}" (${checker.typeToString(type)}) mapped via naming heuristics.`,
    file,
  });
  return { kind: inferKind(propName), diagnostics };
}

function extractStringLiteralUnion(checker: ts.TypeChecker, type: ts.Type): string[] {
  if (type.isUnion()) {
    return type.types
      .map((entry) => {
        if (entry.isStringLiteral()) return entry.value;
        return undefined;
      })
      .filter((value): value is string => value !== undefined);
  }

  if (type.isStringLiteral()) {
    return [type.value];
  }

  if (type.flags & ts.TypeFlags.Union) {
    return (type as ts.UnionType).types
      .map((entry) => {
        if (entry.isStringLiteral()) return entry.value;
        if (entry.flags & ts.TypeFlags.StringLiteral) {
          return (entry as ts.StringLiteralType).value;
        }
        return undefined;
      })
      .filter((value): value is string => value !== undefined);
  }

  return [];
}

function isChildrenType(checker: ts.TypeChecker, type: ts.Type): boolean {
  const text = checker.typeToString(type);
  if (CHILDREN_TYPES.has(text)) return true;
  const symbol = type.getSymbol();
  if (symbol && CHILDREN_TYPES.has(symbol.getName())) return true;
  return /ReactNode|ReactElement|JSX\.Element/i.test(text);
}
