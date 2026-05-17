import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateTokenCount, fitsInBudget } from "../../src/rendering/tokens.ts";

describe("Token estimation", () => {
  it("returns 0 for empty string", () => {
    assert.equal(estimateTokenCount(""), 0);
  });

  it("estimates short text correctly", () => {
    const text = "Hello, world!";
    const estimate = estimateTokenCount(text);
    assert.ok(estimate > 0);
    // "Hello, world!" is ~13 chars → ~4 tokens
    assert.equal(estimate, 4);
  });

  it("estimates longer text via sampling", () => {
    // Generate text with ~1000 lines
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`This is line number ${i} of the test data.`);
    }
    const text = lines.join("\n");
    const estimate = estimateTokenCount(text);
    assert.ok(estimate > 0);
    // Each line is ~40 chars → ~11 tokens per line → ~11,000 tokens
    // But with sampling, should be in the right ballpark
    assert.ok(estimate > 100, `Expected > 100, got ${estimate}`);
  });

  it("fitsInBudget returns true for empty text", () => {
    assert.ok(fitsInBudget("", 100));
  });

  it("fitsInBudget returns true when within budget", () => {
    assert.ok(fitsInBudget("short", 100));
  });

  it("fitsInBudget returns false when over budget", () => {
    const longText = "a".repeat(1000);
    assert.ok(!fitsInBudget(longText, 10));
  });

  it("fitsInBudget returns true for zero budget (unlimited)", () => {
    assert.ok(fitsInBudget("anything", 0));
  });
});
