/**
 * Markdown tag extraction.
 *
 * Pure TypeScript line scanner — no tree-sitter dependency.
 * Parses .md / .mdx files and extracts:
 *   - ATX and setext headings (def, heading)
 *   - YAML frontmatter keys (def, field)
 *   - Fenced code blocks (def, codeblock)
 *   - GitHub-Flavored Markdown callouts (def, callout)
 *   - Wikilinks [[page]] (ref, wikilink)
 *   - Inline links to local .md files (ref, link)
 *   - Reference-style links to local .md files (ref, linkref)
 *
 * Cross-file link references are resolved against the source file's
 * relative path so the graph builder can match them to heading defs.
 */

import * as path from "node:path";
import type { Tag } from "../shared/types.ts";

const ScanState = {
  NORMAL: "NORMAL",
  FRONTMATTER: "FRONTMATTER",
  FENCE_ACTIVE: "FENCE_ACTIVE",
} as const;
type ScanState = (typeof ScanState)[keyof typeof ScanState];

/**
 * Extract the filename stem from a resolved markdown path.
 * "agents/scout.md" → "scout"
 * "README.md"       → "README"
 */
function stemFromPath(filePath: string): string {
  const base = path.posix.basename(filePath);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Resolve a link target against the source file's relative path and
 * return just the filename stem.
 *
 * Examples:
 *   link="./scout.md"   source="docs/index.md" → "scout"
 *   link="../agents/scout.md" source="docs/index.md" → "scout"
 *   link="scout"        source="docs/index.md" → "scout"   (wikilink-style, append .md first)
 */
function resolveLinkStem(link: string, sourceRelPath: string): string {
  let targetPath = link;
  // If no extension, treat as wikilink shorthand and append .md
  if (!targetPath.includes(".")) {
    targetPath = `${targetPath}.md`;
  }
  // Only resolve .md targets
  if (!targetPath.endsWith(".md") && !targetPath.endsWith(".mdx")) {
    return stemFromPath(targetPath);
  }
  const sourceDir = path.posix.dirname(sourceRelPath);
  const resolved = path.posix.normalize(path.posix.join(sourceDir, targetPath));
  return stemFromPath(resolved);
}

/**
 * Extract markdown structural tags from source code.
 */
export function extractMarkdownTags(
  sourceCode: string,
  relPath: string,
  absPath: string,
): Tag[] {
  const tags: Tag[] = [];
  const lines = sourceCode.split("\n");

  let state: ScanState = ScanState.NORMAL;
  let fenceChar = "";
  let fenceLang = "";
  let fenceLine = 0;

  const addTag = (
    name: string,
    kind: "def" | "ref",
    kindDetail: string,
    line: number,
    returnType?: string,
  ) => {
    tags.push({ relPath, absPath, name, kind, line, kindDetail, returnType });
  };

  // Detect frontmatter: file must start with "---" on line 0.
  // If so, we skip line 0 (the opening fence) and enter FRONTMATTER state
  // starting at line 1, where actual YAML keys live.
  let i = 0;
  if (lines.length > 0 && lines[0].trim() === "---") {
    state = ScanState.FRONTMATTER;
    i = 1; // skip the opening fence
  }

  for (; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimEnd();

    switch (state) {
      // ── YAML Frontmatter ────────────────────────────────────────────
      case ScanState.FRONTMATTER: {
        if (trimmed === "---") {
          state = ScanState.NORMAL;
          break;
        }
        // Match top-level YAML keys: key: value
        const yamlMatch = trimmed.match(/^(\w[\w_-]*?):\s*(.*)$/);
        if (yamlMatch) {
          const key = yamlMatch[1];
          const value = yamlMatch[2].trim();
          // Emit the field key as a definition
          addTag(key, "def", "field", i, value || undefined);
          // Also emit the value as a definition when it's a simple identifier,
          // so wikilinks [[scout]] can connect to frontmatter `name: scout`
          if (value && /^[\w\-]+$/.test(value) && value.length > 0) {
            addTag(value, "def", "name", i);
          }
        }
        break;
      }

      // ── Inside a fenced code block ─────────────────────────────────
      case ScanState.FENCE_ACTIVE: {
        if (trimmed.startsWith(fenceChar)) {
          // Emit the code-block language tag (at the opening fence line)
          addTag(fenceLang || "text", "def", "codeblock", fenceLine);
          state = ScanState.NORMAL;
        }
        break;
      }

      // ── Normal content ──────────────────────────────────────────────
      case ScanState.NORMAL: {
        // --- Fenced code block ---
        const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(\w*)/);
        if (fenceMatch) {
          state = ScanState.FENCE_ACTIVE;
          fenceChar = fenceMatch[1];
          fenceLang = fenceMatch[2];
          fenceLine = i;
          break;
        }

        // --- ATX heading ---
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
        if (headingMatch) {
          addTag(
            headingMatch[2].trim(),
            "def",
            "heading",
            i,
            `h${headingMatch[1].length}`,
          );
          break;
        }

        // --- Setext heading (h1: underlined with ===) ---
        // Current line must have content (not empty, not a list item, not a header)
        if (trimmed.length > 0 && i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          if (/^={2,}\s*$/.test(next)) {
            addTag(trimmed, "def", "heading", i, "h1");
            i++; // skip the === line
            break;
          }
        }
        // --- Setext heading (h2: underlined with ---, but not a list item or thematic break) ---
        if (trimmed.length > 0 && i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          if (
            /^-{2,}\s*$/.test(next) &&
            !trimmed.startsWith("-") &&
            !trimmed.startsWith("*") &&
            !trimmed.startsWith("+") &&
            !/^#/.test(trimmed)
          ) {
            addTag(trimmed, "def", "heading", i, "h2");
            i++; // skip the --- line
            break;
          }
        }

        // --- GitHub-Flavored Markdown callout ---
        const calloutMatch = trimmed.match(/^>\s*\[!(\w+)\]/i);
        if (calloutMatch) {
          addTag(calloutMatch[1], "def", "callout", i);
          break;
        }

        // --- Legacy bold-label callout: > **Note:**, > **Warning:**, etc. ---
        const legacyCallout = trimmed.match(/^>\s*\*\*(Tip|Note|Warning|Caution|Important|TODO|Info)\b/i);
        if (legacyCallout) {
          addTag(legacyCallout[1], "def", "callout", i);
          break;
        }

        // --- Wikilinks [[PageName]] ---
        const wikiRegex = /\[\[([\w\s./-]+?)\]\]/g;
        let wikiMatch: RegExpExecArray | null;
        while ((wikiMatch = wikiRegex.exec(trimmed)) !== null) {
          const target = resolveLinkStem(wikiMatch[1].trim(), relPath);
          addTag(target, "ref", "wikilink", i);
        }

        // --- Inline links to local .md / .mdx files ---
        const inlineRegex = /\[([^\]]*)\]\(([^)]+\.mdx?)\)/g;
        let inlineMatch: RegExpExecArray | null;
        while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
          const target = resolveLinkStem(inlineMatch[2], relPath);
          addTag(target, "ref", "link", i);
        }

        // --- Reference-style links: [label]: ./path.md ---
        const refLinkMatch = trimmed.match(/^\[([^\]]+)\]:\s+(\S+\.mdx?)\b/);
        if (refLinkMatch) {
          const target = resolveLinkStem(refLinkMatch[2], relPath);
          addTag(target, "ref", "linkref", i);
        }

        break;
      }
    }
  }

  // If we're still inside a fence at EOF, emit it anyway
  if (state === ScanState.FENCE_ACTIVE) {
    addTag(fenceLang || "text", "def", "codeblock", fenceLine);
  }

  return tags;
}
