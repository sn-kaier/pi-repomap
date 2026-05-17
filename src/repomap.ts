/**
 * Repomap orchestrator.
 *
 * Coordinates the full pipeline:
 *   1. Scan directory → find supported files
 *   2. Parse files with tree-sitter → extract tags
 *   3. Build symbol graph → PageRank
 *   4. Render ranked tags as tree
 *
 * All progress/error output goes to stderr, the final map string to stdout.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import ignore from "ignore";
import { Parser } from "web-tree-sitter";
import type { Tag, RepomapOptions } from "./shared/types.ts";
import { initParser, createParser } from "./tree-sitter/init.ts";
import { extractTags } from "./tree-sitter/tags.ts";
import { extractMarkdownTags } from "./tree-sitter/markdown.ts";
import { getFileLanguage, isSupportedFile, isBinaryFile, isExcludedFile, shouldSkipDir, isParsableFile, MAX_FILE_SIZE } from "./tree-sitter/language.ts";
import { hasWasmGrammar, isMarkdownLanguage } from "./tree-sitter/grammars.ts";
import { buildGraph } from "./ranking/graph.ts";
import { pageRank, distributeRankToTags } from "./ranking/pagerank.ts";
import { renderTree, type RankedTag } from "./rendering/tree.ts";

/** Timing info for diagnostics */
export interface RepomapTiming {
  scan: number;
  parse: number;
  graph: number;
  rank: number;
  render: number;
  total: number;
}

/** Full result from a repomap operation */
export interface RepomapResult {
  map: string;
  tags: Tag[];
  rankedTags: RankedTag[];
  timing: RepomapTiming;
  fileCount: number;
  tagCount: number;
}

/**
 * Load .gitignore patterns from a directory.
 * Walks up from the target directory looking for .gitignore files.
 */
function loadGitignore(dirPath: string): ReturnType<typeof ignore> {
  const ig = ignore();

  // Look for .gitignore in the target directory and parent directories
  let current = path.resolve(dirPath);
  const gitignoreFiles: string[] = [];

  // Collect all .gitignore files from target up to root
  while (true) {
    const gitignorePath = path.join(current, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      gitignoreFiles.unshift(gitignorePath); // prepend so parent dirs are first
    }
    const parent = path.dirname(current);
    if (parent === current) break; // hit root
    current = parent;
  }

  // Also check for .gitignore in the root of any git repos
  // Add common ignore patterns as defaults
  ig.add([
    ".git/",
    "node_modules/",
    ".hg/",
    ".svn/",
    ".DS_Store",
    "*.pyc",
    "__pycache__/",
    ".venv/",
    "venv/",
    ".next/",
    ".nuxt/",
    "dist/",
    "build/",
    ".cache/",
  ]);

  // Load each .gitignore file
  for (const gitignorePath of gitignoreFiles) {
    try {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      ig.add(content);
    } catch {
      // skip unreadable files
    }
  }

  return ig;
}

/**
 * Scan a directory for all supported source files.
 * Returns relative paths (relative to the rootDir).
 */
function scanFiles(rootDir: string, ig: ReturnType<typeof ignore>): string[] {
  const results: string[] = [];
  const root = path.resolve(rootDir);

  if (!fs.existsSync(root)) {
    return [];
  }

  // If the path is a single file, just check it
  if (fs.statSync(root).isFile()) {
    if (isSupportedFile(root)) {
      return [root];
    }
    return [];
  }

  const walkDir = (dirPath: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        // Check gitignore
        const relPath = path.relative(root, fullPath);
        if (ig.ignores(relPath)) continue;
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const relPath = path.relative(root, fullPath);
        if (ig.ignores(relPath)) continue;

        // Skip binary files
        if (isBinaryFile(fullPath)) continue;

        // Skip excluded files (minified, source maps, etc.)
        if (isExcludedFile(fullPath)) continue;

        // Skip files that are too large
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;
        } catch {
          continue;
        }

        if (isSupportedFile(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  };

  walkDir(root);
  return results;
}

/**
 * Run the complete repo map pipeline.
 */
export async function generateRepomap(options: RepomapOptions): Promise<RepomapResult> {
  const startTime = performance.now();
  const timings: RepomapTiming = { scan: 0, parse: 0, graph: 0, rank: 0, render: 0, total: 0 };

  const inputPath = path.resolve(options.path);
  // If a single file is given, use its parent dir as root so relPath resolves to just the filename
  const isSingleFile = fs.statSync(inputPath).isFile();
  const rootDir = isSingleFile ? path.dirname(inputPath) : inputPath;
  const rootName = isSingleFile ? path.basename(inputPath) : path.basename(rootDir);

  // 1. Scan files
  const scanStart = performance.now();
  const ig = loadGitignore(rootDir);
  const files = scanFiles(rootDir, ig);
  timings.scan = performance.now() - scanStart;

  if (files.length === 0) {
    console.error(`[repomap] No supported source files found in ${rootDir}`);
    timings.total = performance.now() - startTime;
    return { map: "", tags: [], rankedTags: [], timing: timings, fileCount: 0, tagCount: 0 };
  }

  console.error(`[repomap] Found ${files.length} source files in ${rootName}`);

  // 2. Initialize tree-sitter and parse files
  const parseStart = performance.now();
  await initParser();

  // Group files by language so we reuse parsers
  const fileByLang = new Map<string, string[]>();
  for (const file of files) {
    const lang = getFileLanguage(file);
    if (lang) {
      if (!fileByLang.has(lang)) {
        fileByLang.set(lang, []);
      }
      fileByLang.get(lang)!.push(file);
    }
  }

  // Create parsers for each language
  const parsers = new Map<string, Parser | null>();
  for (const [lang, langFiles] of fileByLang) {
    if (hasWasmGrammar(lang)) {
      const parser = await createParser(lang);
      parsers.set(lang, parser);
      console.error(`[repomap] Loaded parser for ${lang} (${langFiles.length} files)`);
    }
  }

  // Parse each file and extract tags
  const allTags: Tag[] = [];

  for (const [lang, langFiles] of fileByLang) {
    const parser = parsers.get(lang);

    for (const filePath of langFiles) {
      const relPath = path.relative(rootDir, filePath);

      try {
        const sourceCode = fs.readFileSync(filePath, "utf-8");

        if (isMarkdownLanguage(lang)) {
          // Parse with the pure-TS markdown scanner (no tree-sitter needed)
          const tags = extractMarkdownTags(sourceCode, relPath, filePath);
          allTags.push(...tags);
          console.error(`[repomap]   ${relPath}: ${tags.length} markdown tags`);
        } else if (parser && hasWasmGrammar(lang)) {
          // Parse with tree-sitter
          const tags = extractTags(parser, sourceCode, relPath, filePath, lang);
          allTags.push(...tags);
          console.error(`[repomap]   ${relPath}: ${tags.length} tags`);
        } else {
          // Fallback: filename-only inclusion (no tree-sitter grammar)
          // Just include the filename in the map
          console.error(`[repomap]   ${relPath}: included (filename only, no grammar)`);
        }
      } catch (err) {
        console.error(`[repomap]   ${relPath}: error - ${err}`);
      }
    }
  }

  timings.parse = performance.now() - parseStart;
  console.error(`[repomap] Extracted ${allTags.length} total tags from ${files.length} files`);

  // Clean up parsers
  for (const parser of parsers.values()) {
    if (parser) parser.delete();
  }

  // 3-4. Build graph and compute PageRank
  const graphStart = performance.now();

  const mentionedFilesSet = new Set(options.mentionedFiles || []);
  const mentionedIdentsSet = new Set(options.mentionedIdents || []);

  const graph = buildGraph(allTags, new Set(), mentionedFilesSet, mentionedIdentsSet);

  timings.graph = performance.now() - graphStart;

  const rankStart = performance.now();

  const rankResult = pageRank(
    graph.nodes,
    graph.edges,
    graph.personalization
  );

  // Distribute rank to individual tags
  const outWeightSum = new Map<string, number>();
  for (const edge of graph.edges) {
    outWeightSum.set(edge.source, (outWeightSum.get(edge.source) || 0) + edge.weight);
  }

  const rankedTagEntries = distributeRankToTags(
    rankResult,
    graph.edges,
    graph.definitions,
    outWeightSum
  );

  timings.rank = performance.now() - rankStart;

  // 5. Render
  const renderStart = performance.now();

  const mapString = renderTree(rankedTagEntries, {
    maxDepth: options.maxDepth || 0,
    tokenBudget: options.tokenBudget || 0,
  });

  timings.render = performance.now() - renderStart;
  timings.total = performance.now() - startTime;

  console.error(`[repomap] Generated map (${mapString.length} chars, ~${Math.ceil(mapString.length / 3.5)} est. tokens) in ${timings.total.toFixed(0)}ms`);

  return {
    map: mapString,
    tags: allTags,
    rankedTags: rankedTagEntries,
    timing: timings,
    fileCount: files.length,
    tagCount: allTags.length,
  };
}
