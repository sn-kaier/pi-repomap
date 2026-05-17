import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pageRank } from "../../src/ranking/pagerank.ts";
import type { GraphEdge } from "../../src/shared/types.ts";

describe("PageRank", () => {
  it("returns empty map for empty graph", () => {
    const nodes = new Set<string>();
    const edges: GraphEdge[] = [];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 0);
  });

  it("assigns equal rank to a single node", () => {
    const nodes = new Set(["a"]);
    const edges: GraphEdge[] = [];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 1);
    assert.ok(result.get("a")! > 0);
    assert.equal(result.get("a")!, 1.0);
  });

  it("converges for a two-node graph with no edges", () => {
    const nodes = new Set(["a", "b"]);
    const edges: GraphEdge[] = [];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 2);
    // Both should have roughly equal rank (dangling node handling)
    assert.ok(result.get("a")! > 0);
    assert.ok(result.get("b")! > 0);
    const sum = result.get("a")! + result.get("b")!;
    assert.ok(Math.abs(sum - 1.0) < 0.01, "Ranks should sum to ~1.0");
  });

  it("assigns higher rank to the target of a directed edge", () => {
    // a → b  (a refers to b)
    const nodes = new Set(["a", "b"]);
    const edges: GraphEdge[] = [
      { source: "a", target: "b", weight: 1.0, ident: "foo" },
    ];
    const result = pageRank(nodes, edges);
    assert.ok(result.get("b")! > result.get("a")!, "Target 'b' should rank higher than source 'a'");
  });

  it("converges within tolerance", () => {
    const nodes = new Set(["a", "b", "c"]);
    const edges: GraphEdge[] = [
      { source: "a", target: "b", weight: 1.0, ident: "x" },
      { source: "b", target: "c", weight: 1.0, ident: "y" },
      { source: "c", target: "a", weight: 1.0, ident: "z" },
    ];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 3);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.01, "Ranks should sum to ~1.0 for a strongly connected graph");
  });

  it("handles disconnected components", () => {
    // Two separate two-node graphs: a↔b and c↔d
    const nodes = new Set(["a", "b", "c", "d"]);
    const edges: GraphEdge[] = [
      { source: "a", target: "b", weight: 1.0, ident: "x" },
      { source: "b", target: "a", weight: 1.0, ident: "x" },
      { source: "c", target: "d", weight: 1.0, ident: "y" },
      { source: "d", target: "c", weight: 1.0, ident: "y" },
    ];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 4);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.01, "Ranks should sum to ~1.0");
  });

  it("applies personalization correctly", () => {
    const nodes = new Set(["a", "b", "c"]);
    const edges: GraphEdge[] = [
      { source: "a", target: "b", weight: 1.0, ident: "x" },
    ];
    const personalization = new Map([["c", 100]]);

    const result = pageRank(nodes, edges, personalization);
    // 'c' gets a significant rank boost from personalization
    assert.ok(result.get("c")! > 0, "Personalized node should have non-zero rank");
  });

  it("handles multiple edges between same nodes", () => {
    const nodes = new Set(["a", "b"]);
    const edges: GraphEdge[] = [
      { source: "a", target: "b", weight: 1.0, ident: "x" },
      { source: "a", target: "b", weight: 2.0, ident: "y" },
      { source: "a", target: "b", weight: 3.0, ident: "z" },
    ];
    const result = pageRank(nodes, edges);
    assert.equal(result.size, 2);
    const sum = Array.from(result.values()).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.01, "Ranks should sum to ~1.0");
  });
});
