import ts from "typescript";
import type { ComponentProp, DiscoveredComponent, PropKind } from "./types.js";
import { inferKind, toPascalCase } from "./naming.js";

const SKIP_EXPORTS = new Set([
  "default",
  "props",
  "cn",
  "clsx",
  "classNames",
  "useTheme",
  "theme",
]);

export function parseComponentFile(filePath: string, source: string): DiscoveredComponent[] {
  if (filePath.endsWith(".vue")) {
    return parseVueSfc(filePath, source);
  }

  const scriptKind = filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : filePath.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : filePath.endsWith(".js")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;

  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const checkerLike = collectTypeAliases(sf);
  const found: DiscoveredComponent[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node) && looksLikeComponent(node.name.text)) {
      found.push(fromFunction(filePath, node, checkerLike, source));
    }

    if (
      ts.isVariableStatement(node) &&
      isExported(node)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        if (!looksLikeComponent(decl.name.text)) continue;
        const init = decl.initializer;
        if (
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          found.push(fromFunctionLike(filePath, decl.name.text, init, checkerLike, source));
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);

  if (found.length === 0) {
    const fallback = inferFromFileName(filePath, source);
    if (fallback) found.push(fallback);
  }

  return found.filter((component) => component.props.length > 0 || looksLikeUiFile(filePath, source));
}

function parseVueSfc(filePath: string, source: string): DiscoveredComponent[] {
  const name = toPascalCase(filePath.split(/[/\\]/).pop()?.replace(/\.vue$/i, "") ?? "Component");
  const props: ComponentProp[] = [];
  const defineProps = source.match(/defineProps\s*(?:<\s*\{([\s\S]*?)\}\s*>|\(\s*\{([\s\S]*?)\}\s*\))/);
  const block = defineProps?.[1] ?? defineProps?.[2];
  if (block) {
    for (const line of block.split(/[,\n]/)) {
      const match = line.match(/([A-Za-z_][A-Za-z0-9_]*)\s*(\?)?\s*:/);
      if (!match) continue;
      props.push({
        name: match[1]!,
        required: !match[2],
        kind: inferKind(match[1]!),
      });
    }
  }
  return [{ name, sourcePath: filePath, props }];
}

type TypeTable = Map<string, ts.TypeLiteralNode | ts.InterfaceDeclaration>;

function collectTypeAliases(sf: ts.SourceFile): TypeTable {
  const table: TypeTable = new Map();
  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      table.set(node.name.text, node.type);
    }
    if (ts.isInterfaceDeclaration(node)) {
      table.set(node.name.text, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return table;
}

function fromFunction(
  filePath: string,
  node: ts.FunctionDeclaration,
  types: TypeTable,
  source: string,
): DiscoveredComponent {
  return fromFunctionLike(filePath, node.name!.text, node, types, source);
}

function fromFunctionLike(
  filePath: string,
  name: string,
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  types: TypeTable,
  source: string,
): DiscoveredComponent {
  const param = node.parameters[0];
  const props = param ? propsFromParameter(param, types) : [];
  return {
    name: toPascalCase(name),
    exportName: name,
    sourcePath: filePath,
    description: leadingComment(source, node),
    props,
  };
}

function propsFromParameter(param: ts.ParameterDeclaration, types: TypeTable): ComponentProp[] {
  const type = param.type;
  if (!type) {
    if (ts.isObjectBindingPattern(param.name)) {
      return param.name.elements
        .filter((el): el is ts.BindingElement => ts.isBindingElement(el) && ts.isIdentifier(el.name))
        .map((el) => {
          const name = (el.name as ts.Identifier).text;
          return { name, required: !el.initializer, kind: inferKind(name) };
        });
    }
    return [];
  }

  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const literal = types.get(type.typeName.text);
    if (literal) return propsFromMembers(getMembers(literal));
  }

  if (ts.isTypeLiteralNode(type)) {
    return propsFromMembers(type.members);
  }

  return [];
}

function getMembers(node: ts.TypeLiteralNode | ts.InterfaceDeclaration): readonly ts.TypeElement[] {
  return node.members;
}

function propsFromMembers(members: readonly ts.TypeElement[]): ComponentProp[] {
  const props: ComponentProp[] = [];
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;
    if (name === "className" || name === "style" || name === "class") continue;
    props.push({
      name,
      required: !member.questionToken,
      kind: kindFromType(name, member.type),
      enumValues: enumFromType(member.type),
    });
  }
  return props;
}

function kindFromType(name: string, type?: ts.TypeNode): PropKind {
  const enums = enumFromType(type);
  if (enums?.length) return "enum";
  if (type && ts.isFunctionTypeNode(type)) return "action";
  if (type?.kind === ts.SyntaxKind.BooleanKeyword) return "boolean";
  if (type?.kind === ts.SyntaxKind.NumberKeyword) return "number";
  if (type?.kind === ts.SyntaxKind.StringKeyword) return "string";
  if (name === "children" || name === "child") return "children";
  return inferKind(name);
}

function enumFromType(type?: ts.TypeNode): string[] | undefined {
  if (!type) return undefined;
  if (ts.isUnionTypeNode(type)) {
    const values = type.types
      .map((entry) => (ts.isLiteralTypeNode(entry) && ts.isStringLiteral(entry.literal) ? entry.literal.text : undefined))
      .filter((value): value is string => Boolean(value));
    return values.length ? values : undefined;
  }
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
    return [type.literal.text];
  }
  return undefined;
}

function isExported(node: ts.Node): boolean {
  return Boolean(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export);
}

function looksLikeComponent(name: string): boolean {
  return /^[A-Z]/.test(name) && !SKIP_EXPORTS.has(name);
}

function looksLikeUiFile(filePath: string, source: string): boolean {
  return (
    /return\s*\([\s\n]*</.test(source) ||
    /<[A-Z][A-Za-z0-9]*/.test(source) ||
    filePath.endsWith(".vue")
  );
}

function inferFromFileName(filePath: string, source: string): DiscoveredComponent | undefined {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  const name = toPascalCase(base.replace(/\.(tsx|ts|jsx|js|vue)$/i, ""));
  if (!/^[A-Z]/.test(name) || /^(Index|Types|Utils|Theme|Tokens)$/.test(name)) return undefined;
  if (!looksLikeUiFile(filePath, source)) return undefined;
  return { name, sourcePath: filePath, props: [] };
}

function leadingComment(source: string, node: ts.Node): string | undefined {
  const ranges = ts.getLeadingCommentRanges(source, node.getFullStart());
  if (!ranges?.length) return undefined;
  const text = ranges
    .map((range) => source.slice(range.pos, range.end))
    .join("\n")
    .replace(/\/\*+|\*+\/|\/\/|\*/g, "")
    .trim();
  return text || undefined;
}
