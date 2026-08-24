import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith(".tsx") ? [path] : [];
  });
}

describe("HTML button semantics", () => {
  it("declares a type on every button so nested forms cannot submit implicitly", () => {
    const workspace = join(process.cwd(), "..", "..");
    const roots = [join(workspace, "apps"), join(workspace, "packages")];
    const missing: string[] = [];

    for (const file of roots.flatMap(sourceFiles)) {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "button") {
          const hasType = node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "type");
          if (!hasType) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            missing.push(`${relative(process.cwd(), file)}:${line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect(missing).toEqual([]);
  });
});
