/**
 * Core types for the repomap extension.
 */

/** A single symbol tag extracted from source code */
export interface Tag {
  /** Path relative to the repo root */
  relPath: string;
  /** Absolute file path */
  absPath: string;
  /** Symbol name (e.g., "debounce", "EventEmitter") */
  name: string;
  /** Whether this is a definition or a reference */
  kind: "def" | "ref";
  /** Line number (0-indexed) where the symbol appears */
  line: number;
  /** Kind detail like "function", "class", "method", "interface", etc. */
  kindDetail: string;
  /** Optional: return type string (e.g., "void", "Promise<string>") */
  returnType?: string;
  /** Optional: visibility modifier ("public", "private", "protected") */
  visibility?: string;
}

/** Options for the repo map operation */
export interface RepomapOptions {
  /** Path to the directory or file to map */
  path: string;
  /** Maximum tokens for the output (0 = unlimited) */
  tokenBudget?: number;
  /** Maximum nesting depth in the output tree (0 = unlimited) */
  maxDepth?: number;
  // Note: PageRank is computed internally for ranking but never shown in output
  /** Files to boost in ranking (relative paths) */
  mentionedFiles?: string[];
  /** Identifiers to boost in ranking */
  mentionedIdents?: string[];
}

/** A language supported by our tree-sitter grammars */
export interface LanguageSupport {
  /** Language name used by tree-sitter */
  name: string;
  /** File extensions that map to this language */
  extensions: string[];
  /** Whether WASM grammar is available (not just filename fallback) */
  hasWasm: boolean;
}

/** Edge in the symbol graph */
export interface GraphEdge {
  source: string; // rel path of referencer file
  target: string; // rel path of definer file
  weight: number;
  ident: string; // the shared symbol name
}
