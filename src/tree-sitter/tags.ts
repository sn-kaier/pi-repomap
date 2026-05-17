/**
 * Tree-sitter tag extraction.
 *
 * Parses source code with tree-sitter and runs tag queries to extract
 * symbol definitions and references — the raw material for the repo map.
 *
 * Uses web-tree-sitter v0.26.x API (named imports for Query).
 */

import { Parser, Query } from "web-tree-sitter";
import type { Tag } from "../shared/types.ts";
import { getQueryForLanguage, DEF_PREFIX, REF_PREFIX } from "./grammars.ts";

/**
 * Parse a file's source code and extract all tags (definitions + references).
 * Uses web-tree-sitter v0.26.x API.
 */
export function extractTags(
  parser: Parser,
  sourceCode: string,
  relPath: string,
  absPath: string,
  lang: string
): Tag[] {
  const queryScm = getQueryForLanguage(lang);
  if (!queryScm) {
    return [];
  }

  // Get the Language object from the parser
  const language = parser.language;
  if (!language) {
    return [];
  }

  const tree = parser.parse(sourceCode);
  if (!tree) {
    return [];
  }

  // Create query and run captures
  const query = new Query(language, queryScm);
  const captures = query.captures(tree.rootNode);

  const tags: Tag[] = [];
  const seen = new Set<string>();

  for (const capture of captures) {
    const tagName = capture.name;
    const node = capture.node;

    // Determine kind from capture name prefix
    let kind: "def" | "ref" | null = null;
    let kindDetail = "";

    if (tagName.startsWith(DEF_PREFIX)) {
      kind = "def";
      kindDetail = tagName.slice(DEF_PREFIX.length);
    } else if (tagName.startsWith(REF_PREFIX)) {
      kind = "ref";
      kindDetail = tagName.slice(REF_PREFIX.length);
    } else {
      continue; // skip doc/other captures
    }

    const symbolName = node.text;

    // Deduplicate: same symbol at same location
    const key = `${symbolName}:${kind}:${node.startPosition.row}:${lang}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Extract visibility and return type from parent node for definitions
    let returnType: string | undefined;
    let visibility: string | undefined;

    if (kind === "def" && (kindDetail === "function" || kindDetail === "method")) {
      const parent = node.parent;
      if (parent) {
        // Extract return type
        // TypeScript: type_annotation child (e.g., ": void")
        // Python: type child (e.g., "bool")
        const returnNode = findChildByType(parent, ["type_annotation", "type"]);
        if (returnNode) {
          returnType = returnNode.text.replace(/^:\s*/, "");
        }

        // Extract visibility (TypeScript/JS class members)
        visibility = extractVisibility(parent, lang);
      }
    }

    tags.push({
      relPath,
      absPath,
      name: symbolName,
      kind,
      line: node.startPosition.row,
      kindDetail,
      returnType,
      visibility,
    });
  }

  return tags;
}

/**
 * Find a child node by its type string (or one of several).
 */
function findChildByType(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && types.includes(child.type)) {
      return child;
    }
  }
  return null;
}

/**
 * Extract visibility modifier from a declaration node.
 * Checks for public/private/protected modifiers in the node's children.
 */
function extractVisibility(node: Parser.SyntaxNode, lang: string): string | undefined {
  // Only relevant for TypeScript/JavaScript class members
  if (lang !== "typescript" && lang !== "tsx" && lang !== "javascript") {
    return undefined;
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    const text = child.text;
    if (text === "public" || text === "private" || text === "protected") {
      return text;
    }
  }

  return undefined;
}
