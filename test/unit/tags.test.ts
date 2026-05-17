import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { initParser, createParser } from "../../src/tree-sitter/init.ts";
import { extractTags } from "../../src/tree-sitter/tags.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

describe("Tag extraction", () => {
  before(async () => {
    await initParser();
  });

  describe("JavaScript", () => {
    it("extracts class definitions", async () => {
      const code = `
class MyClass {
  constructor() {}
  doSomething() {}
}
      `;
      const parser = await createParser("javascript");
      assert.ok(parser, "Parser should be created");

      const tags = extractTags(parser, code, "test.js", "/abs/test.js", "javascript");
      const defs = tags.filter((t) => t.kind === "def");

      assert.ok(defs.some((t) => t.name === "MyClass" && t.kindDetail === "class"), "Should find MyClass class");
      assert.ok(defs.some((t) => t.name === "doSomething" && t.kindDetail === "method"), "Should find doSomething method");
    });

    it("extracts function definitions", async () => {
      const code = `
function greet(name) {
  return "Hello " + name;
}

const add = (a, b) => a + b;
      `;
      const parser = await createParser("javascript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "test.js", "/abs/test.js", "javascript");
      const defs = tags.filter((t) => t.kind === "def");

      assert.ok(defs.some((t) => t.name === "greet" && t.kindDetail === "function"), "Should find greet function");
    });

    it("extracts call references", async () => {
      const code = `
function hello() {}
hello();
new Date();
      `;
      const parser = await createParser("javascript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "test.js", "/abs/test.js", "javascript");
      const refs = tags.filter((t) => t.kind === "ref");

      assert.ok(refs.some((t) => t.name === "hello" && t.kindDetail === "call"), "Should find hello call reference");
    });

    it("handles a real file", async () => {
      const filePath = path.join(FIXTURES_DIR, "js", "simple.js");
      const code = fs.readFileSync(filePath, "utf-8");
      const parser = await createParser("javascript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "simple.js", filePath, "javascript");
      assert.ok(tags.length > 0, "Should extract tags");
    });
  });

  describe("TypeScript", () => {
    it("extracts interface definitions", async () => {
      const code = `
interface User {
  id: number;
  name: string;
}
      `;
      const parser = await createParser("typescript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "test.ts", "/abs/test.ts", "typescript");
      const defs = tags.filter((t) => t.kind === "def");

      assert.ok(defs.some((t) => t.name === "User" && t.kindDetail === "interface"), "Should find User interface");
    });

    it("extracts type alias definitions", async () => {
      const code = `
type Status = "active" | "inactive";
      `;
      const parser = await createParser("typescript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "test.ts", "/abs/test.ts", "typescript");
      const defs = tags.filter((t) => t.kind === "def");

      assert.ok(defs.some((t) => t.name === "Status" && t.kindDetail === "type"), "Should find Status type alias");
    });

    it("handles a real file", async () => {
      const filePath = path.join(FIXTURES_DIR, "ts", "interfaces.ts");
      const code = fs.readFileSync(filePath, "utf-8");
      const parser = await createParser("typescript");
      assert.ok(parser);

      const tags = extractTags(parser, code, "interfaces.ts", filePath, "typescript");
      assert.ok(tags.length > 0, "Should extract tags");
    });
  });

  describe("Python", () => {
    it("extracts class and function definitions", async () => {
      const code = `
class MyClass:
    def my_method(self):
        pass

def my_function():
    pass
      `;
      const parser = await createParser("python");
      assert.ok(parser);

      const tags = extractTags(parser, code, "test.py", "/abs/test.py", "python");
      const defs = tags.filter((t) => t.kind === "def");

      assert.ok(defs.some((t) => t.name === "MyClass" && t.kindDetail === "class"), "Should find MyClass");
      assert.ok(defs.some((t) => t.name === "my_function" && t.kindDetail === "function"), "Should find my_function");
    });

    it("handles a real file", async () => {
      const filePath = path.join(FIXTURES_DIR, "python", "simple.py");
      const code = fs.readFileSync(filePath, "utf-8");
      const parser = await createParser("python");
      assert.ok(parser);

      const tags = extractTags(parser, code, "simple.py", filePath, "python");
      assert.ok(tags.length > 0, "Should extract tags");
    });
  });
});
