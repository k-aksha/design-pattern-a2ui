import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

export type TypeScriptProgramContext = {
  program: ts.Program;
  checker: ts.TypeChecker;
  root: string;
  tsconfigPath: string;
};

export function findTsConfig(root: string, projectPath?: string): string | undefined {
  if (projectPath) {
    const abs = resolve(projectPath);
    if (!existsSync(abs)) {
      throw new Error(`tsconfig not found: ${abs}`);
    }
    return abs;
  }

  let dir = resolve(root);
  while (true) {
    const candidate = join(dir, "tsconfig.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function createTypeScriptProgram(
  root: string,
  projectPath?: string,
): TypeScriptProgramContext | undefined {
  const tsconfigPath = findTsConfig(root, projectPath);
  if (!tsconfigPath) return undefined;

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostic(configFile.error));
  }

  const configDir = dirname(tsconfigPath);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    configDir,
    undefined,
    tsconfigPath,
  );
  if (parsed.errors.length) {
    throw new Error(parsed.errors.map(formatDiagnostic).join("\n"));
  }

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });

  return {
    program,
    checker: program.getTypeChecker(),
    root: resolve(root),
    tsconfigPath,
  };
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  if (diagnostic.file && diagnostic.start !== undefined) {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
  }
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}
