/**
 * Lightweight PageRank implementation.
 *
 * Computes PageRank on a directed graph of files connected by symbol references.
 * No external dependencies — pure math, ~60 lines of core logic.
 */

import type { GraphEdge } from "../shared/types.ts";

/** PageRank result: file → rank score */
export type PageRankResult = Map<string, number>;

/** Options for PageRank computation */
export interface PageRankOptions {
  /** Damping factor (default: 0.85) */
  dampingFactor?: number;
  /** Convergence threshold (default: 1e-6) */
  tolerance?: number;
  /** Maximum iterations (default: 100) */
  maxIterations?: number;
}

/**
 * Compute PageRank for a graph of files.
 *
 * @param nodes All unique file paths (nodes in the graph)
 * @param edges Directed edges with weights
 * @param personalization Per-node personalization scores (optional)
 * @param options PageRank options
 * @returns Map of node → rank score
 */
export function pageRank(
  nodes: Set<string>,
  edges: GraphEdge[],
  personalization: Map<string, number> = new Map(),
  options: PageRankOptions = {}
): PageRankResult {
  const { dampingFactor = 0.85, tolerance = 1e-6, maxIterations = 100 } = options;
  const n = nodes.size;

  if (n === 0) return new Map();

  // Build adjacency lists: out-edges per source node
  const outEdges = new Map<string, { target: string; weight: number }[]>();
  const outWeightSum = new Map<string, number>();

  for (const node of nodes) {
    outEdges.set(node, []);
    outWeightSum.set(node, 0);
  }

  for (const edge of edges) {
    if (!outEdges.has(edge.source)) continue;
    outEdges.get(edge.source)!.push({ target: edge.target, weight: edge.weight });
    outWeightSum.set(edge.source, (outWeightSum.get(edge.source) || 0) + edge.weight);
  }

  // Initialize ranks uniformly
  const rank = new Map<string, number>();
  const initialRank = 1 / n;
  for (const node of nodes) {
    rank.set(node, initialRank);
  }

  // Build personalization vector (uniform if empty)
  const hasPersonalization = personalization.size > 0;
  const persVector = new Map<string, number>();

  if (hasPersonalization) {
    const persSum = Array.from(personalization.values()).reduce((a, b) => a + b, 0);
    if (persSum > 0) {
      for (const node of nodes) {
        persVector.set(node, (personalization.get(node) || 0) / persSum);
      }
    }
  }
  // If no personalization or the sum was 0, use uniform distribution
  if (persVector.size === 0) {
    for (const node of nodes) {
      persVector.set(node, initialRank);
    }
  }

  // Handle dangling nodes (nodes with no out-edges)
  const danglingNodes: string[] = [];
  for (const node of nodes) {
    const sum = outWeightSum.get(node) || 0;
    if (sum === 0 || outEdges.get(node)?.length === 0) {
      danglingNodes.push(node);
    }
  }

  // Iterate until convergence
  for (let iter = 0; iter < maxIterations; iter++) {
    let danglingSum = 0;
    for (const node of danglingNodes) {
      danglingSum += rank.get(node) || 0;
    }
    const danglingWeight = danglingSum / n;

    const newRank = new Map<string, number>();

    // Initial rank: teleportation + dangling redistribution
    for (const node of nodes) {
      const persScore = persVector.get(node) || initialRank;
      const teleport = (1 - dampingFactor) * persScore;
      newRank.set(node, teleport + dampingFactor * danglingWeight);
    }

    // Distribute rank along edges
    for (const [source, edges] of outEdges) {
      const sourceRank = rank.get(source) || 0;
      const outSum = outWeightSum.get(source) || 0;
      if (outSum === 0) continue;

      for (const edge of edges) {
        const contribution = dampingFactor * sourceRank * (edge.weight / outSum);
        newRank.set(edge.target, (newRank.get(edge.target) || 0) + contribution);
      }
    }

    // Check convergence (L1 norm)
    let diff = 0;
    for (const node of nodes) {
      diff += Math.abs((newRank.get(node) || 0) - (rank.get(node) || 0));
    }

    // Update ranks
    for (const node of nodes) {
      rank.set(node, newRank.get(node) || 0);
    }

    if (diff < tolerance) {
      break;
    }
  }

  return rank;
}

/**
 * Distribute file-level PageRank scores to individual tag symbols.
 *
 * For each edge (referencer → definer, weight w, ident s):
 *   definer_rank_share += rank(referencer) * w / sum_out_weight(referencer)
 *
 * Returns tags sorted by rank descending.
 */
export function distributeRankToTags(
  rank: PageRankResult,
  edges: GraphEdge[],
  definitions: Map<string, Tag[]>,
  outWeightSum: Map<string, number> = new Map()
): { tag: Tag; rank: number; refCount: number }[] {
  // Build out-weight sums if not provided
  if (outWeightSum.size === 0) {
    for (const edge of edges) {
      outWeightSum.set(
        edge.source,
        (outWeightSum.get(edge.source) || 0) + edge.weight
      );
    }
  }

  // Distribute rank: (definer_file, ident) → accumulated rank
  const rankedDefs = new Map<string, number>();

  // (definer_file, ident) → count of references to that ident
  const refCounts = new Map<string, number>();

  for (const edge of edges) {
    const sourceRank = rank.get(edge.source) || 0;
    const outSum = outWeightSum.get(edge.source) || 0;
    if (outSum === 0) continue;

    const contribution = sourceRank * (edge.weight / outSum);
    const key = `${edge.target}:${edge.ident}`;
    rankedDefs.set(key, (rankedDefs.get(key) || 0) + contribution);
    refCounts.set(key, (refCounts.get(key) || 0) + 1);
  }

  // Sort by rank descending
  const sorted = Array.from(rankedDefs.entries())
    .sort((a, b) => b[1] - a[1]);

  const result: { tag: Tag; rank: number; refCount: number }[] = [];

  for (const [key, tagRank] of sorted) {
    const tags = definitions.get(key);
    if (tags && tags.length > 0) {
      // Use the first definition tag (line, kindDetail) for display
      result.push({
        tag: tags[0],
        rank: tagRank,
        refCount: refCounts.get(key) || 0,
      });
    }
  }

  return result;
}
