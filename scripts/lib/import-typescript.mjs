import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export async function importTypescript(file, replacements = {}) {
  return import(await typescriptModuleUrl(file, replacements));
}

export async function typescriptModuleUrl(file, replacements = {}) {
  const cache = new Map();
  async function compile(filename) {
    const absolute = path.resolve(filename);
    if (cache.has(absolute)) return cache.get(absolute);
    const source = await readFile(absolute, "utf8");
    let code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const imports = [...code.matchAll(/from ["']([^"']+)["']/g)];
    for (const match of imports) {
      const specifier = match[1];
      const url = replacements[specifier] ?? (specifier.startsWith(".")
        ? await compile(path.resolve(path.dirname(absolute), `${specifier}.ts`)) : null);
      if (url) code = code.replace(match[0], `from "${url}"`);
    }
    const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
    cache.set(absolute, url);
    return url;
  }
  return compile(file);
}
