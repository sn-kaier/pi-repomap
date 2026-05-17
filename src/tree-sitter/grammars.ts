/**
 * Language → WASM file mapping and Tree-sitter tag query definitions.
 *
 * Query patterns follow Aider's convention:
 *   - name.definition.* → definitions
 *   - name.reference.* → references
 *
 * These are embedded as JS strings (no loose .scm files) so they
 * ship entirely in the source code.
 */

import type { LanguageSupport } from "../shared/types.ts";

/** Map of language name → WASM filename */
export const WASM_FILES: Record<string, string> = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  python: "tree-sitter-python.wasm",
};

/** Supported languages and their file extensions */
export const SUPPORTED_LANGUAGES: LanguageSupport[] = [
  {
    name: "javascript",
    extensions: [".js", ".mjs", ".cjs", ".jsx"],
    hasWasm: true,
  },
  {
    name: "typescript",
    extensions: [".ts", ".mts", ".cts"],
    hasWasm: true,
  },
  {
    name: "tsx",
    extensions: [".tsx"],
    hasWasm: true,
  },
  {
    name: "python",
    extensions: [".py"],
    hasWasm: true,
  },
  // Fallback-only languages (no WASM grammar available)
  {
    name: "markdown",
    extensions: [".md", ".mdx"],
    hasWasm: false,
  },
  {
    name: "svelte",
    extensions: [".svelte"],
    hasWasm: false,
  },
];

/** Map file extension → language name */
export function extensionToLanguage(ext: string): string | null {
  const lower = ext.toLowerCase();
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.extensions.includes(lower)) {
      return lang.name;
    }
  }
  return null;
}

/** Check if a language has WASM grammar support */
export function hasWasmGrammar(lang: string): boolean {
  const support = SUPPORTED_LANGUAGES.find((l) => l.name === lang);
  return support?.hasWasm ?? false;
}

/** Check if a language is markdown/mdx (parsed without tree-sitter) */
export function isMarkdownLanguage(lang: string): boolean {
  return lang === "markdown" || lang === "mdx";
}

/**
 * Tree-sitter query for JavaScript.
 * Captures function declarations, class declarations, methods, arrow functions,
 * and call references.
 */
export const JS_QUERY = `
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name.definition.method) @definition.method
  (#not-eq? @name.definition.method "constructor")
)

(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name.definition.class)
    (class_declaration
      name: (_) @name.definition.class)
  ] @definition.class
)

(
  (comment)* @doc
  .
  [
    (function_expression
      name: (identifier) @name.definition.function)
    (function_declaration
      name: (identifier) @name.definition.function)
    (generator_function
      name: (identifier) @name.definition.function)
    (generator_function_declaration
      name: (identifier) @name.definition.function)
  ] @definition.function
)

(
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name.definition.function
      value: [(arrow_function) (function_expression)]) @definition.function)
)

(
  (variable_declaration
    (variable_declarator
      name: (identifier) @name.definition.function
      value: [(arrow_function) (function_expression)]) @definition.function)
)

(assignment_expression
  left: [
    (identifier) @name.definition.function
    (member_expression
      property: (property_identifier) @name.definition.function)
  ]
  right: [(arrow_function) (function_expression)]
) @definition.function

(pair
  key: (property_identifier) @name.definition.function
  value: [(arrow_function) (function_expression)]) @definition.function

(
  (call_expression
    function: (identifier) @name.reference.call) @reference.call
  (#not-match? @name.reference.call "^(require)$")
)

(call_expression
  function: (member_expression
    property: (property_identifier) @name.reference.call)
  arguments: (_) @reference.call)

(new_expression
  constructor: (_) @name.reference.class) @reference.class
`;

/**
 * Tree-sitter query for Python.
 * Captures class definitions, function definitions, and call references.
 */
export const PYTHON_QUERY = `
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(function_definition
  name: (identifier) @name.definition.function) @definition.function

(call
  function: [
      (identifier) @name.reference.call
      (attribute
        attribute: (identifier) @name.reference.call)
  ]) @reference.call
`;

/**
 * Tree-sitter query for TypeScript.
 * Includes JavaScript patterns plus TypeScript-specific: interfaces, type aliases, enums.
 * For TSX (.tsx files), uses the TypeScript grammar which handles TSX syntax.
 */
export const TS_QUERY = `
${JS_QUERY}

(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

(type_alias_declaration
  name: (type_identifier) @name.definition.type) @definition.type

(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum
`;

/** Map language name → query string */
export function getQueryForLanguage(lang: string): string | null {
  switch (lang) {
    case "javascript":
    case "jsx":
      return JS_QUERY;
    case "typescript":
    case "tsx":
      return TS_QUERY;
    case "python":
      return PYTHON_QUERY;
    default:
      return null;
  }
}

/** The name.definition.* and name.reference.* tag prefixes we care about */
export const DEF_PREFIX = "name.definition.";
export const REF_PREFIX = "name.reference.";
