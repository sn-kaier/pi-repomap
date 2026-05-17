# pi-repomap 🗺️

A **pi-agent extension** that generates structured, ranked repository maps using `web-tree-sitter`. Scans source code, extracts symbol definitions and references, builds a graph, runs PageRank, and outputs a compact tree of ranked symbols — optimized for LLM context windows.

## Installation

### From npm (published release)

```bash
pi install npm:@sn-kaier/pi-repomap
```

### From Git (latest source)

```bash
# HTTPS (recommended)
pi install https://github.com/sn-kaier/pi-repomap

# Or with the git: prefix
pi install git:github.com/sn-kaier/pi-repomap

# Pin to a specific tag or commit
pi install git:github.com/sn-kaier/pi-repomap@v0.1.0

# SSH (requires configured SSH keys)
pi install git:git@github.com:sn-kaier/pi-repomap
```

> **Note:** When installing from git, pi clones the repo and runs `npm install` automatically, which triggers the `postinstall` script to copy the required WASM grammars into `vendor/`. No extra steps needed.

### Try without installing (temporary)

```bash
pi -e git:github.com/sn-kaier/pi-repomap
```

### From a local checkout

```bash
pi install /path/to/pi-repomap
pi install ./relative/path/to/pi-repomap
```

## Usage

Once installed, pi-agent gains the `repomap` tool. Ask Pi to map a codebase:

```text
Generate a repo map of ./src with 2048 token budget.
```

Or use it programmatically within prompts:

```text
First, generate a repo map of the codebase, then help me understand the architecture.
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `string` | (required) | Directory or file to map |
| `tokenBudget` | `number` | `0` (unlimited) | Maximum estimated tokens for the output |
| `maxDepth` | `number` | `0` (unlimited) | Maximum nesting depth in the output tree |
| `mentionedFiles` | `string[]` | `[]` | File paths to boost in PageRank ranking |
| `mentionedIdents` | `string[]` | `[]` | Identifier names to boost in PageRank ranking |

### Example output (TypeScript)

```
src/utils.ts {
15 class EventEmitter {
22 on()
45 emit()
}
89 debounce()
120 throttle()
}
```

### Example output (Markdown)

```
docs/guide.md {
  3 Quickstart {
    5 Installation
    8 Configuration
  }
12 API Reference
}
```

Line numbers refer to the source file. Symbols are ranked by PageRank importance.
Class/interface/markdown-heading bodies are nested with 2-space indentation.

## How it works

1. **Scan** — walks the directory tree, respecting `.gitignore`, finding supported source files
2. **Parse** — uses `web-tree-sitter` WASM grammars for JavaScript, TypeScript, and Python; uses a pure TypeScript line scanner for Markdown/MDX
3. **Extract symbols** — runs tree-sitter tag queries to find definitions (`class`, `function`, `interface`, etc.) and references (calls); for markdown, extracts headings, YAML frontmatter, code blocks, GFM callouts, wikilinks, and cross-file link references
4. **Build graph** — connects files through shared symbols (file A defines `foo`, file B references `foo` → edge A→B); cross-file markdown links are resolved relative to the source file's path
5. **PageRank** — computes importance scores across the file graph using a lightweight pure-math implementation, boosting mentioned files and identifiers
6. **Render** — outputs a compact, token-efficient tree of ranked symbols; respects token budget via binary-search truncation

## Supported languages

| Language | Extensions | Parser |
|----------|-----------|--------|
| JavaScript | `.js`, `.mjs`, `.cjs`, `.jsx` | ✅ Full tree-sitter AST |
| TypeScript | `.ts`, `.mts`, `.cts` | ✅ Full tree-sitter AST |
| TSX | `.tsx` | ✅ Full tree-sitter AST |
| Python | `.py` | ✅ Full tree-sitter AST |
| Markdown | `.md`, `.mdx` | ✅ Pure-TS line scanner (headings, frontmatter, code blocks, callouts, wikilinks, cross-file links) |
| Svelte | `.svelte` | 📄 Filename-only inclusion |

## Development

```bash
# Install dependencies
npm install

# Copy WASM grammars to vendor/
npm run copy-wasm

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run integration tests (requires WASM grammars)
npm run test:integration
```

WASM grammar files are copied from `node_modules/@vscode/tree-sitter-wasm` into the `vendor/` directory during `postinstall` and `pretest`. The core tree-sitter runtime (`web-tree-sitter.wasm`) is loaded from `vendor/` at runtime.

## Programmatic API (for other extensions)

```ts
import { generateRepomap } from "@sn-kaier/pi-repomap/src/repomap.ts";

const result = await generateRepomap({
  path: "./src",
  tokenBudget: 2048,
  mentionedFiles: ["src/main.ts"],
  mentionedIdents: ["debounce", "EventEmitter"],
});

console.log(result.map);
console.log(`Mapped ${result.fileCount} files with ${result.tagCount} tags`);
```

The result object (`RepomapResult`) includes:
- `map` — the rendered tree string
- `tags` — all extracted tags
- `rankedTags` — tags sorted by PageRank score
- `timing` — per-stage timing breakdown
- `fileCount` / `tagCount` — summary counts

## License

MIT
