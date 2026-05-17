#!/usr/bin/env node

/**
 * Copies WASM files needed by pi-repomap into the vendor/ directory.
 *
 * Sources:
 *   - Core tree-sitter.wasm from web-tree-sitter (official npm package)
 *   - Language grammars from @vscode/tree-sitter-wasm (pre-built WASM for VS Code supported langs)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const vendorDir = path.join(rootDir, "vendor");

/** Core tree-sitter runtime WASM (v0.26.x uses web-tree-sitter.wasm) */
const CORE_WASM = "web-tree-sitter.wasm";

/** Language grammar WASM files we need */
const LANGUAGE_WASM = [
  "tree-sitter-javascript.wasm",
  "tree-sitter-typescript.wasm",
  "tree-sitter-tsx.wasm",
  "tree-sitter-python.wasm",
];

function copyFile(src, dest, label) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const size = fs.statSync(dest).size;
  console.error(`[repomap] ✓ ${label} (${(size / 1024).toFixed(0)} KB)`);
}

function main() {
  const errors = [];

  // --- 1. Core tree-sitter.wasm from web-tree-sitter ---
  const coreSrc = path.join(rootDir, "node_modules", "web-tree-sitter", CORE_WASM);
  if (fs.existsSync(coreSrc)) {
    copyFile(coreSrc, path.join(vendorDir, CORE_WASM), "core tree-sitter.wasm");
  } else {
    errors.push(`Core WASM not found at ${coreSrc}`);
  }

  // --- 2. Language grammars from @vscode/tree-sitter-wasm ---
  const vscodeWasmDir = path.join(
    rootDir,
    "node_modules",
    "@vscode",
    "tree-sitter-wasm",
    "wasm"
  );

  let langCopied = 0;
  for (const wasmFile of LANGUAGE_WASM) {
    const src = path.join(vscodeWasmDir, wasmFile);
    if (fs.existsSync(src)) {
      const langName = wasmFile.replace("tree-sitter-", "").replace(".wasm", "");
      copyFile(src, path.join(vendorDir, wasmFile), `${langName} grammar`);
      langCopied++;
    } else {
      errors.push(`${wasmFile} not found in @vscode/tree-sitter-wasm`);
    }
  }

  // Summary
  const totalExpected = 1 + LANGUAGE_WASM.length; // core + languages
  const totalCopied = (fs.existsSync(path.join(vendorDir, CORE_WASM)) ? 1 : 0) + langCopied;

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`[repomap] ✗ ${err}`);
    }
  }

  if (totalCopied === totalExpected) {
    console.error(`[repomap] All ${totalCopied} WASM files ready in vendor/`);
  } else {
    console.error(`[repomap] ${totalCopied}/${totalExpected} WASM files copied (${errors.length} errors)`);
    if (errors.length > 0) process.exit(1);
  }
}

main();
