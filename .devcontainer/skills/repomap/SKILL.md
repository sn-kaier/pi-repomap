---
name: repomap
description: Generate a repository map of any directory in this project using pi-repomap via the CLI script or programmatic API. Use before exploring unfamiliar parts of the codebase.
---

# Using Repomap Within This Repository

This skill helps you generate repository maps of any directory within this project (pi-repomap itself). Use it when you need a bird's-eye view of a codebase section before diving deeper.

## Quick Start

```bash
node --experimental-strip-types examples/print-example-map.js <path> [output-file]
```

### Examples

```bash
# Print map of the src/ directory to stdout
node --experimental-strip-types examples/print-example-map.js ./src

# Generate a map and save it to a file
node --experimental-strip-types examples/print-example-map.js ./src map-src.txt

# Map a single file
node --experimental-strip-types examples/print-example-map.js ./src/repomap.ts

# Map a reference repo
node --experimental-strip-types examples/print-example-map.js ./references/aider map-aider.txt
```

## How It Works

The script:
1. Calls `generateRepomap()` — the core pipeline in `src/repomap.ts`
2. Scans the target directory for supported source files
3. Parses them with `web-tree-sitter` (WASM)
4. Extracts symbol definitions and references
5. Runs PageRank to rank symbols by importance
6. Outputs a compact tree to stdout (or a file)

## What the Output Looks Like

```
# Repository Map
# ================
# Each entry shows: line-number symbol-name
# Line numbers refer to the source file. Symbols are ranked by PageRank importance.
# Class/interface bodies are nested with 2-space indentation.

src/runs/shared/pi-spawn.ts {
34 interface PiSpawnDeps {}
45 interface PiSpawnCommand {
  7 findPiPackageRootFromEntry(): string | undefined
  50 isRunnableNodeScript(): boolean
  }
}
test/unit/pi-spawn.test.ts {
```

- **Line numbers**: refer to the source file (first column)
- **Parentheses** `()`: indicate functions/methods
- **Return types**: shown after `:` when available (TypeScript/Python)
- **Curly braces** `{}`: show nesting — classes/interfaces contain their methods
- **Empty braces** `{}`: class/interface with no captured methods
- **Indentation**: 2 spaces per nesting level

## Programmatic API

You can also import `generateRepomap` directly:

```ts
import { generateRepomap } from "./src/repomap.ts";

const result = await generateRepomap({ path: "./src" });
console.log(result.map);
console.log(`Mapped ${result.fileCount} files with ${result.tagCount} tags`);
```

The result object includes `map` (string), `tags`, `rankedTags`, `timing`, `fileCount`, and `tagCount`.
