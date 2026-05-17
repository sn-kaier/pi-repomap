/**
 * WebAssembly initialization layer for web-tree-sitter.
 *
 * Loads the core tree-sitter WASM module and provides a factory
 * for creating language-specific parsers.
 *
 * Uses web-tree-sitter v0.26.x API (named exports for Language, Query).
 * WASM grammar files are loaded from the vendor/ directory.
 */

import { Parser, Language } from "web-tree-sitter";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { WASM_FILES } from "./grammars.ts";

/** Resolve paths relative to this source file's location in the installed package */
function getExtensionDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // src/tree-sitter/init.ts → go up 2 levels to package root
  return path.resolve(path.dirname(thisFile), "..", "..");
}

/** Get the vendor directory path */
function getVendorDir(): string {
  return path.join(getExtensionDir(), "vendor");
}

/** Whether the parser has been initialized */
let initialized = false;

/**
 * Initialize the core tree-sitter WASM runtime.
 * Must be called before any language can be loaded.
 */
export async function initParser(): Promise<void> {
  if (initialized) return;

  const vendorDir = getVendorDir();
  const wasmPath = path.join(vendorDir, "web-tree-sitter.wasm");

  if (!fs.existsSync(wasmPath)) {
    throw new Error(
      `Core tree-sitter WASM not found at ${wasmPath}. ` +
        "Run 'npm run copy-wasm' to populate the vendor/ directory."
    );
  }

  await Parser.init({
    locateFile() {
      return wasmPath;
    },
  });

  initialized = true;
}

/**
 * Load a language grammar and create a new Parser for it.
 * Returns null if the WASM file doesn't exist or fails to load.
 */
export async function createParser(lang: string): Promise<Parser | null> {
  if (!initialized) {
    throw new Error("Parser not initialized. Call initParser() first.");
  }

  const wasmFile = WASM_FILES[lang];
  if (!wasmFile) {
    return null;
  }

  const wasmPath = path.join(getVendorDir(), wasmFile);

  if (!fs.existsSync(wasmPath)) {
    console.error(`[repomap] WASM grammar not found: ${wasmPath} (language: ${lang})`);
    return null;
  }

  try {
    const wasmBuffer = fs.readFileSync(wasmPath);
    const language = await Language.load(wasmBuffer);
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
  } catch (err) {
    console.error(`[repomap] Failed to load WASM grammar for ${lang}:`, err);
    return null;
  }
}
