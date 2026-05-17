/**
 * Symbol graph builder.
 *
 * Builds a directed multigraph connecting files that define symbols
 * to files that reference them. This graph is the input to PageRank.
 */

import type { Tag, GraphEdge } from "../shared/types.ts";

export interface SymbolGraph {
  /** All nodes (files by relative path) */
  nodes: Set<string>;
  /** Edges from referencer file → definer file */
  edges: GraphEdge[];
  /** Map of file → personalization score (0 = none, >0 = boosted) */
  personalization: Map<string, number>;
  /** Map of (file, ident) → definition tags (for rendering) */
  definitions: Map<string, Tag[]>;
  /** Files that are in the chat (boosted) */
  chatFiles: Set<string>;
  /** Mentioned identifiers (extra boost) */
  mentionedIdents: Set<string>;
  /** Mentioned file paths (extra boost) */
  mentionedFiles: Set<string>;
}

/**
 * Build a symbol graph from extracted tags.
 *
 * @param tags All extracted tags from the scanned directory
 * @param chatFiles Files currently in the chat (boosted)
 * @param mentionedFiles File paths to boost
 * @param mentionedIdents Identifiers to boost
 */
export function buildGraph(
  tags: Tag[],
  chatFiles: Set<string> = new Set(),
  mentionedFiles: Set<string> = new Set(),
  mentionedIdents: Set<string> = new Set()
): SymbolGraph {
  // Definitions: symbol name → set of files that define it
  const defines = new Map<string, Set<string>>();

  // References: symbol name → list of files that reference it
  const references = new Map<string, string[]>();

  // Definitions: (file, symbol) → tag list
  const definitions = new Map<string, Tag[]>();

  // All unique files
  const allFiles = new Set<string>();

  // Personalization: file → score
  const personalization = new Map<string, number>();

  // Populate maps
  for (const tag of tags) {
    allFiles.add(tag.relPath);

    if (tag.kind === "def") {
      if (!defines.has(tag.name)) {
        defines.set(tag.name, new Set());
      }
      defines.get(tag.name)!.add(tag.relPath);

      const key = `${tag.relPath}:${tag.name}`;
      if (!definitions.has(key)) {
        definitions.set(key, []);
      }
      definitions.get(key)!.push(tag);
    } else if (tag.kind === "ref") {
      if (!references.has(tag.name)) {
        references.set(tag.name, []);
      }
      references.get(tag.name)!.push(tag.relPath);
    }
  }

  // Compute personalization scores
  const personalizeBase = allFiles.size > 0 ? 100 / allFiles.size : 0;

  for (const file of allFiles) {
    let score = 0;

    if (chatFiles.has(file)) {
      score += personalizeBase;
    }

    if (mentionedFiles.has(file)) {
      score = Math.max(score, personalizeBase);
    }

    // Check path components against mentionedIdents
    const pathParts = file.replace(/\\/g, "/").split("/");
    const fileName = pathParts[pathParts.length - 1] || "";
    const fileNameWithoutExt = fileName.includes(".")
      ? fileName.slice(0, fileName.lastIndexOf("."))
      : fileName;
    const allComponents = new Set([...pathParts, fileName, fileNameWithoutExt]);

    for (const ident of mentionedIdents) {
      if (allComponents.has(ident)) {
        score += personalizeBase;
        break;
      }
    }

    if (score > 0) {
      personalization.set(file, score);
    }
  }

  const graph: SymbolGraph = {
    nodes: allFiles,
    edges: [],
    personalization,
    definitions,
    chatFiles,
    mentionedIdents,
    mentionedFiles,
  };

  // Build edges
  // Use all unique idents that appear in both defines and references
  const idents = new Set([...defines.keys()].filter((id) => references.has(id) || defines.get(id)!.size > 0));

  for (const ident of idents) {
    const definers = defines.get(ident);
    const referencers = references.get(ident);

    if (!definers || definers.size === 0) continue;

    // Compute weight adjustments
    let mul = 1.0;

    const isSnake = ident.includes("_") && /[a-zA-Z]/.test(ident);
    const isKebab = ident.includes("-") && /[a-zA-Z]/.test(ident);
    const isCamel = /[a-z]/.test(ident) && /[A-Z]/.test(ident);

    if (mentionedIdents.has(ident)) {
      mul *= 10;
    }
    if ((isSnake || isKebab || isCamel) && ident.length >= 8) {
      mul *= 10;
    }
    if (ident.startsWith("_")) {
      mul *= 0.1;
    }
    if (definers.size > 5) {
      mul *= 0.1;
    }

    // Add self-edges for definitions with no references
    if (!referencers || referencers.length === 0) {
      for (const definer of definers) {
        graph.edges.push({
          source: definer,
          target: definer,
          weight: 0.1,
          ident,
        });
      }
      continue;
    }

    // Count reference occurrences per referencer
    const refCount = new Map<string, number>();
    for (const ref of referencers) {
      refCount.set(ref, (refCount.get(ref) || 0) + 1);
    }

    for (const [referencer, count] of refCount) {
      for (const definer of definers) {
        let useMul = mul;
        if (chatFiles.has(referencer)) {
          useMul *= 50;
        }

        // sqrt scale to prevent high-frequency noise
        const scaledCount = Math.sqrt(count);
        graph.edges.push({
          source: referencer,
          target: definer,
          weight: useMul * scaledCount,
          ident,
        });
      }
    }
  }

  return graph;
}
