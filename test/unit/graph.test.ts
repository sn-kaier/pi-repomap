import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "../../src/ranking/graph.ts";
import type { Tag } from "../../src/shared/types.ts";

describe("Graph builder", () => {
  it("builds edges from definitions to references", () => {
    const tags: Tag[] = [
      { relPath: "a.js", absPath: "/a.js", name: "foo", kind: "def", line: 1, kindDetail: "function" },
      { relPath: "b.js", absPath: "/b.js", name: "foo", kind: "ref", line: 5, kindDetail: "call" },
    ];

    const graph = buildGraph(tags);
    assert.ok(graph.nodes.has("a.js"));
    assert.ok(graph.nodes.has("b.js"));

    const fooEdges = graph.edges.filter((e) => e.ident === "foo");
    assert.equal(fooEdges.length, 1);
    assert.equal(fooEdges[0].source, "b.js");
    assert.equal(fooEdges[0].target, "a.js");
  });

  it("creates self-edges for definitions without references", () => {
    const tags: Tag[] = [
      { relPath: "a.js", absPath: "/a.js", name: "orphan", kind: "def", line: 1, kindDetail: "function" },
    ];

    const graph = buildGraph(tags);
    const orphanEdges = graph.edges.filter((e) => e.ident === "orphan");
    assert.equal(orphanEdges.length, 1);
    assert.equal(orphanEdges[0].source, "a.js");
    assert.equal(orphanEdges[0].target, "a.js");
    assert.equal(orphanEdges[0].weight, 0.1);
  });

  it("applies weight multiplier for long camelCase identifiers", () => {
    const tags: Tag[] = [
      { relPath: "a.js", absPath: "/a.js", name: "longCamelCaseName", kind: "def", line: 1, kindDetail: "function" },
      { relPath: "b.js", absPath: "/b.js", name: "longCamelCaseName", kind: "ref", line: 5, kindDetail: "call" },
    ];

    const graph = buildGraph(tags);
    const edge = graph.edges[0];
    // longCamelCaseName is camelCase and >= 8 chars → 10x multiplier
    assert.ok(edge.weight >= 9.0, `Expected weight >= 9.0, got ${edge.weight}`);
  });

  it("penalizes underscore-prefixed identifiers", () => {
    // Use a short name so snake_case boost doesn't apply (length < 8)
    const tags: Tag[] = [
      { relPath: "a.js", absPath: "/a.js", name: "_priv", kind: "def", line: 1, kindDetail: "function" },
      { relPath: "b.js", absPath: "/b.js", name: "_priv", kind: "ref", line: 5, kindDetail: "call" },
    ];

    const graph = buildGraph(tags);
    const edge = graph.edges[0];
    // _priv starts with _ → 0.1x multiplier (no snake_case boost since length < 8)
    assert.equal(edge.weight, 0.1, `Expected weight 0.1, got ${edge.weight}`);
  });

  it("applies personalization for chat files", () => {
    const tags: Tag[] = [
      { relPath: "a.js", absPath: "/a.js", name: "foo", kind: "def", line: 1, kindDetail: "function" },
    ];

    const graph = buildGraph(tags, new Set(["a.js"]));
    assert.ok(graph.personalization.has("a.js"));
  });

  it("applies personalization for mentioned identifiers matching path components", () => {
    const tags: Tag[] = [
      { relPath: "src/auth/utils.js", absPath: "/src/auth/utils.js", name: "helper", kind: "def", line: 1, kindDetail: "function" },
    ];

    const graph = buildGraph(tags, new Set(), new Set(), new Set(["auth"]));
    assert.ok(graph.personalization.has("src/auth/utils.js"), "File matching mentioned ident 'auth' should be personalized");
  });

  it("reduces weight for identifiers defined in many files", () => {
    // "common" defined in 6 files → 0.1x penalty
    const tags: Tag[] = [];
    for (let i = 0; i < 6; i++) {
      tags.push({
        relPath: `file${i}.js`,
        absPath: `/file${i}.js`,
        name: "common",
        kind: "def",
        line: 1,
        kindDetail: "function",
      });
    }
    tags.push({
      relPath: "user.js",
      absPath: "/user.js",
      name: "common",
      kind: "ref",
      line: 1,
      kindDetail: "call",
    });

    const graph = buildGraph(tags);
    // There should be 6 edges (user.js → each of the 6 definers)
    // Each should have weight 0.1 (mul) * sqrt(1) = 0.1
    const commonEdges = graph.edges.filter((e) => e.ident === "common");
    assert.equal(commonEdges.length, 6);
    for (const edge of commonEdges) {
      assert.equal(edge.weight, 0.1);
    }
  });

  it("boosts chat file references 50x", () => {
    const tags: Tag[] = [
      { relPath: "chat.js", absPath: "/chat.js", name: "foo", kind: "def", line: 1, kindDetail: "function" },
      { relPath: "chat.js", absPath: "/chat.js", name: "bar", kind: "ref", line: 5, kindDetail: "call" },
      { relPath: "other.js", absPath: "/other.js", name: "bar", kind: "def", line: 1, kindDetail: "function" },
    ];

    const graph = buildGraph(tags, new Set(["chat.js"]));
    const barEdge = graph.edges.find((e) => e.ident === "bar");
    assert.ok(barEdge);
    // chat.js is in chat files → 50x multiplier
    assert.equal(barEdge.source, "chat.js");
    assert.equal(barEdge.target, "other.js");
    assert.equal(barEdge.weight, 50.0);
  });
});
