/**
 * Language detection utilities.
 * Maps file extensions to language names and provides helpers
 * for determining which files to parse.
 */

import { extensionToLanguage, hasWasmGrammar } from "./grammars.ts";

/** File extensions we consider binary/skip-worthy */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".ogg",
  ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".exe", ".dll", ".so", ".dylib", ".wasm",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  ".o", ".a", ".lib", ".obj",
]);

/** Suffix patterns for files to always exclude */
const EXCLUDED_FILE_PATTERNS = [
  /\.min\.js$/i,   // minified JavaScript
  /\.map$/i,        // source map files (.js.map, .css.map, etc.)
];

/** Directories we always skip */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".hg",
  ".svn",
  "bower_components",
  ".next",
  ".nuxt",
  ".output",
  "dist",
  "build",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".venv",
  "venv",
  ".env",
  ".idea",
  ".vscode",
]);

/**
 * Check if a file path is binary based on its extension.
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if a file path matches an exclusion pattern (minified, source map, etc.).
 */
export function isExcludedFile(filePath: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if a directory should be skipped.
 */
export function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.has(dirName);
}

/**
 * Check if a file has a supported extension for parsing or inclusion.
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  const lang = extensionToLanguage(ext);
  return lang !== null;
}

/**
 * Check if a file can be parsed with tree-sitter (has WASM grammar).
 */
export function isParsableFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  const lang = extensionToLanguage(ext);
  return lang !== null && hasWasmGrammar(lang);
}

/**
 * Get the language name for a file path, or null if unsupported.
 */
export function getFileLanguage(filePath: string): string | null {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  return extensionToLanguage(ext);
}

/** Maximum file size in bytes to attempt parsing (1 MB) */
export const MAX_FILE_SIZE = 1_000_000;
