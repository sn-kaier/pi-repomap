/**
 * Tree output formatter.
 *
 * Converts ranked tags into a curly-brace nested format:
 *
 *   path/to/file.py {
 *     92 class GUI {
 *       93 tool_output()
 *       97 tool_error()
 *     }
 *   }
 *
 * Visibility modifiers (public/private/protected) and return types are
 * always shown when available. PageRank is used internally for ranking
 * but never shown in the output.
 */

import type { Tag } from "../shared/types.ts";
import { estimateTokenCount } from "./tokens.ts";

/** Map header describing the output format */
const MAP_HEADER = `# Repository Map
# ================
# Each entry shows: line-number symbol-name
# Line numbers refer to the source file. Symbols are ranked by PageRank importance.
# Class/interface bodies are nested with 2-space indentation.
`;

/** A ranked tag with its computed rank and reference count */
export interface RankedTag {
  tag: Tag;
  rank: number;
  refCount: number;
}

/** Options for rendering */
export interface RenderOptions {
  /** Maximum nesting depth (0 = unlimited) */
  maxDepth?: number;
  /** Maximum token budget (0 = unlimited) */
  tokenBudget?: number;
  /** Files in the chat (skip these) */
  chatFiles?: Set<string>;
}

/**
 * Render ranked tags into a curly-brace nested format.
 */
export function renderTree(rankedTags: RankedTag[], options: RenderOptions = {}): string {
  const { maxDepth = 0, tokenBudget = 0, chatFiles = new Set() } = options;

  if (rankedTags.length === 0) return "";

  // Group tags by file
  const fileGroups = new Map<string, RankedTag[]>();
  for (const rt of rankedTags) {
    if (chatFiles.has(rt.tag.relPath)) continue;
    if (!fileGroups.has(rt.tag.relPath)) {
      fileGroups.set(rt.tag.relPath, []);
    }
    fileGroups.get(rt.tag.relPath)!.push(rt);
  }

  // Sort files by their highest-ranked tag
  const sortedFiles = Array.from(fileGroups.entries()).sort((a, b) => {
    const maxRankA = Math.max(...a[1].map((rt) => rt.rank));
    const maxRankB = Math.max(...b[1].map((rt) => rt.rank));
    return maxRankB - maxRankA;
  });

  const lines: string[] = [];

  for (const [filePath, tags] of sortedFiles) {
    const fileLines = renderFile(tags, maxDepth);
    lines.push(`${filePath} {`, ...fileLines, "}");
  }

  let output = MAP_HEADER + "\n" + lines.join("\n") + "\n";

  // Truncate long lines
  output = output
    .split("\n")
    .map((line) => (line.length > 100 ? line.slice(0, 100) + "…" : line))
    .join("\n");

  // If token budget is set, binary search for the right size
  if (tokenBudget > 0) {
    output = truncateToBudget(output, tokenBudget, sortedFiles, maxDepth);
  }

  return output;
}

/**
 * Format a single symbol line: "line symbolName()"/"line class Name"/etc.
 * Visibility modifiers and return types are always shown when available.
 */
function formatSymbolLine(tag: Tag): string {
  const lineNum = tag.line + 1;
  const name = tag.name;
  const detail = tag.kindDetail;

  let symbol: string;
  if (detail === "function" || detail === "method" || detail === "call") {
    let sig = `${name}()`;
    if (tag.returnType) {
      sig += `: ${tag.returnType}`;
    }
    if (tag.visibility) {
      sig = `${tag.visibility} ${sig}`;
    }
    symbol = sig;
  } else if (detail === "class") {
    symbol = `class ${name}`;
  } else if (detail === "interface") {
    symbol = `interface ${name}`;
  } else if (detail === "type") {
    symbol = `type ${name}`;
  } else if (detail === "enum") {
    symbol = `enum ${name}`;
  } else {
    symbol = name;
  }

  return `${lineNum} ${symbol}`;
}

/**
 * Render all tags within a single file as nested curly-brace blocks.
 * Classes/interfaces open a block; their methods go inside; the block closes.
 * Headings create a hierarchical scope by level (h1 nests deepest).
 */
function renderFile(tags: RankedTag[], maxDepth: number): string[] {
  if (tags.length === 0) return [];

  const sorted = sortTagsByKind(tags);
  const lines: string[] = [];
  let classTags: RankedTag[] = [];

  function flushClass() {
    if (classTags.length === 0) return;

    const header = classTags[0];
    const methods = classTags.slice(1);

    if (methods.length === 0) {
      lines.push(formatSymbolLine(header.tag) + " {}");
    } else {
      lines.push(formatSymbolLine(header.tag) + " {");

      for (const rt of methods) {
        lines.push("  " + formatSymbolLine(rt.tag));
      }

      lines.push("  }");
    }
    classTags = [];
  }

  // Collect non-heading, non-class/interface tags to render after heading nesting
  const nonStructuralTags: RankedTag[] = [];
  const headingTags: RankedTag[] = [];

  for (const rt of sorted) {
    if (rt.tag.kindDetail === "class" || rt.tag.kindDetail === "interface") {
      flushClass();
      classTags = [rt];
    } else if (classTags.length > 0 && (rt.tag.kindDetail === "method" || rt.tag.kindDetail === "function")) {
      classTags.push(rt);
    } else if (rt.tag.kindDetail === "heading") {
      flushClass();
      headingTags.push(rt);
    } else {
      flushClass();
      nonStructuralTags.push(rt);
    }
  }
  flushClass();

  // If there are headings, render them as a nested hierarchy
  if (headingTags.length > 0) {
    const headingLines = renderHeadingHierarchy(headingTags);
    lines.push(...headingLines);
  }

  // Append remaining non-heading tags
  for (const rt of nonStructuralTags) {
    lines.push(formatSymbolLine(rt.tag));
  }

  return lines;
}

/**
 * Heading scope: stores a heading entry with its accumulated child lines.
 */
interface HeadingScope {
  level: number;
  tag: RankedTag;
  childLines: string[];
}

/**
 * Render a single scope's contribution into indented lines.
 */
function renderScopeLines(scope: HeadingScope, indent: string): string[] {
  const headerLine = `${indent}${scope.tag.tag.line + 1} ${scope.tag.tag.name}`;
  if (scope.childLines.length === 0) {
    // Leaf heading — just the name, no braces
    return [headerLine];
  }
  return [
    `${headerLine} {`,
    ...scope.childLines,
    `${indent}}`,
  ];
}

/**
 * Render heading tags as a hierarchical nested structure.
 *
 * Headings at deeper levels (##, ###) nest inside the nearest preceding
 * higher-level heading (#, ##). When a heading at the same or higher level
 * appears, the current scope closes and its rendered lines are accumulated
 * into the parent scope's child list (or top-level output if no parent).
 *
 * # h1          → level 1, opens a scope
 * ## h2         → level 2, nests inside h1
 * ### h3        → level 3, nests inside h2
 * ## h2-again   → level 2, closes h3 and h2, opens new h2 inside h1
 *
 * Renders as:
 *   1 h1 {
 *     3 h2 {
 *       4 h3
 *     }
 *     7 h2-again
 *   }
 */
function renderHeadingHierarchy(headings: RankedTag[]): string[] {
  const topLevelOutput: string[] = [];
  const stack: HeadingScope[] = [];

  for (const rt of headings) {
    const level = parseInt(rt.tag.returnType?.replace("h", "") || "1", 10);

    // Close scopes at same or deeper level, accumulating into parent
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      const closed = stack.pop()!;
      const indent = "  ".repeat(stack.length);
      const lines = renderScopeLines(closed, indent);

      // Add rendered lines to parent's child list, or top-level output
      if (stack.length > 0) {
        stack[stack.length - 1].childLines.push(...lines);
      } else {
        topLevelOutput.push(...lines);
      }
    }

    // Push the new heading as a scope
    stack.push({ level, tag: rt, childLines: [] });
  }

  // Flush remaining scopes from innermost to outermost
  while (stack.length > 0) {
    const closed = stack.pop()!;
    const indent = "  ".repeat(stack.length);
    const lines = renderScopeLines(closed, indent);

    if (stack.length > 0) {
      stack[stack.length - 1].childLines.push(...lines);
    } else {
      topLevelOutput.push(...lines);
    }
  }

  return topLevelOutput;
}

/**
 * Sort tags by kind priority: structural code first, then markdown elements.
 */
function sortTagsByKind(tags: RankedTag[]): RankedTag[] {
  const kindOrder: Record<string, number> = {
    class: 0,
    interface: 1,
    enum: 2,
    type: 3,
    function: 4,
    method: 5,
    call: 6,
    heading: 10,
    name: 11,
    field: 12,
    codeblock: 13,
    callout: 14,
    link: 20,
    wikilink: 21,
    linkref: 22,
  };

  return [...tags].sort((a, b) => {
    const orderA = kindOrder[a.tag.kindDetail] ?? 99;
    const orderB = kindOrder[b.tag.kindDetail] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.tag.line - b.tag.line;
  });
}

/**
 * Truncate rendered output to fit within a token budget.
 * Uses binary search over the sorted file list.
 */
function truncateToBudget(
  currentOutput: string,
  budget: number,
  sortedFiles: [string, RankedTag[]][],
  maxDepth: number
): string {
  if (budget <= 0) return currentOutput;

  let low = 0;
  let high = sortedFiles.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = renderFileRange(sortedFiles, 0, mid, maxDepth);
    const estimatedTokens = estimateTokenCount(candidate);

    if (estimatedTokens <= budget) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // If no files fit within budget, at least return the header
  if (!best) {
    const headerTokens = estimateTokenCount(MAP_HEADER);
    if (headerTokens <= budget) {
      return MAP_HEADER;
    }
    return "";
  }

  return best;
}

/**
 * Render a range of files (flat, for budget truncation).
 */
function renderFileRange(
  sortedFiles: [string, RankedTag[]][],
  start: number,
  end: number,
  maxDepth: number
): string {
  const lines: string[] = [];

  for (let i = start; i < end && i < sortedFiles.length; i++) {
    const [filePath, tags] = sortedFiles[i];
    const fileLines = renderFile(tags, maxDepth);
    lines.push(`${filePath} {`, ...fileLines, "}");
  }

  if (lines.length === 0) return "";
  return MAP_HEADER + "\n" + lines.join("\n");
}
