/**
 * Integration tests for the full repomap pipeline.
 *
 * Runs the complete scan → parse → rank → render pipeline on
 * the test fixtures and verifies the output structure.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRepomap } from "../../src/repomap.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");
const ROOT_DIR = path.resolve(__dirname, "..", "..");

describe("Repomap integration", { timeout: 30_000 }, () => {
  it("generates a map for the test fixtures directory", async () => {
    const result = await generateRepomap({ path: FIXTURES_DIR });

    // Should have found and parsed our fixture files
    assert.ok(result.fileCount > 0, "Should find fixture files");
    assert.ok(result.tagCount > 0, "Should extract tags");

    // Output should be a non-empty string
    assert.ok(result.map.length > 0, "Map should not be empty");

    // Should contain file paths (relative paths)
    assert.ok(result.map.includes("js/simple.js"), "Should reference js/simple.js");
    assert.ok(result.map.includes("ts/interfaces.ts"), "Should reference ts/interfaces.ts");
    assert.ok(result.map.includes("python/simple.py"), "Should reference python/simple.py");

    // Should contain line numbers at line start (format: "92 class")
    assert.ok(/\d+ class/.test(result.map), "Should contain class with line number");
    assert.ok(/\d+ \w+\(\)/.test(result.map), "Should contain function with line number");

    // Should contain curly brace nesting
    assert.ok(result.map.includes(" {"), "Should contain opening brace");
    assert.ok(result.map.includes("}"), "Should contain closing brace");

    // Output should NOT contain rank or ref info (we removed those)
    assert.ok(!result.map.includes("rank:"), "Should not contain rank scores");
    assert.ok(!result.map.includes("refs:"), "Should not contain reference counts");

    // Timing should be populated
    assert.ok(result.timing.total > 0, "Should record total timing");
    assert.ok(result.timing.scan >= 0, "Should record scan timing");
    assert.ok(result.timing.parse >= 0, "Should record parse timing");
    assert.ok(result.timing.graph >= 0, "Should record graph timing");
    assert.ok(result.timing.rank >= 0, "Should record rank timing");
    assert.ok(result.timing.render >= 0, "Should record render timing");
  });

  it("includes JavaScript symbols correctly", async () => {
    const result = await generateRepomap({ path: path.join(FIXTURES_DIR, "js") });

    // Should find EventEmitter class
    assert.ok(result.map.includes("EventEmitter"), "Should find EventEmitter class");
    // Should find methods
    assert.ok(result.map.includes("emit()"), "Should find emit method");
    assert.ok(result.map.includes("on()"), "Should find on method");
    // Should find functions
    assert.ok(result.map.includes("debounce()"), "Should find debounce function");
    assert.ok(result.map.includes("throttle()"), "Should find throttle function");
  });

  it("includes TypeScript symbols correctly", async () => {
    const result = await generateRepomap({ path: path.join(FIXTURES_DIR, "ts") });

    // Should find interface, type, and enum
    assert.ok(result.map.includes("interface User"), "Should find User interface");
    assert.ok(result.map.includes("type Status") || result.map.includes("Status"), "Should find Status type");
    assert.ok(result.map.includes("enum Role") || result.map.includes("Role"), "Should find Role enum");
    // Should find class and methods
    assert.ok(result.map.includes("class Account"), "Should find Account class");
  });

  it("includes Python symbols correctly", async () => {
    const result = await generateRepomap({ path: path.join(FIXTURES_DIR, "python") });

    // Should find class and methods
    assert.ok(result.map.includes("class Counter"), "Should find Counter class");
    assert.ok(result.map.includes("increment()"), "Should find increment method");
    assert.ok(result.map.includes("reset()"), "Should find reset method");
    // Should find functions
    assert.ok(result.map.includes("format_count()"), "Should find format_count function");
    assert.ok(result.map.includes("main()"), "Should find main function");
  });

  it("respects tokenBudget parameter", async () => {
    const result = await generateRepomap({
      path: FIXTURES_DIR,
      tokenBudget: 100, // Very small budget
    });

    assert.ok(result.map.length > 0, "Map should not be empty even with small budget");

    const resultFull = await generateRepomap({
      path: FIXTURES_DIR,
      tokenBudget: 0, // Unlimited
    });

    const hasMoreContent = resultFull.map.length >= result.map.length;
    assert.ok(hasMoreContent, "Unlimited budget map should not be smaller than limited");
  });

  it("handles an empty directory gracefully", async () => {
    const emptyDir = path.join(ROOT_DIR, "test", "fixtures", "empty");
    fs.mkdirSync(emptyDir, { recursive: true });

    try {
      const result = await generateRepomap({ path: emptyDir });
      assert.equal(result.fileCount, 0, "Should find 0 files");
      assert.equal(result.tagCount, 0, "Should have 0 tags");
      assert.equal(result.map, "", "Map should be empty");
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("handles a single file path", async () => {
    const result = await generateRepomap({
      path: path.join(FIXTURES_DIR, "python", "simple.py"),
    });

    assert.ok(result.fileCount >= 1, "Should find the Python file");
    assert.ok(result.tagCount > 0, "Should extract tags");
    assert.ok(result.map.includes("simple.py"), "Output should reference the file");
  });

  it("handles binary-only directory gracefully", async () => {
    const binaryDir = path.join(ROOT_DIR, "test", "fixtures", "binaries");
    fs.mkdirSync(binaryDir, { recursive: true });
    const dummyPng = path.join(binaryDir, "image.png");
    fs.writeFileSync(dummyPng, Buffer.alloc(100));

    try {
      const result = await generateRepomap({ path: binaryDir });
      assert.equal(result.fileCount, 0, "Should find 0 supported files");
      assert.equal(result.map, "", "Map should be empty");
    } finally {
      fs.rmSync(binaryDir, { recursive: true, force: true });
    }
  });

  it("supports mentionedFiles boost", async () => {
    const result = await generateRepomap({
      path: FIXTURES_DIR,
      mentionedFiles: ["python/simple.py"],
    });

    assert.ok(result.map, "Should generate a map");
  });
});
