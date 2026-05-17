## 🎯 Strategic Objective

Build a standalone, high-performance repository mapping extension for the **pi-agent** ecosystem. This extension will utilize `web-tree-sitter` (WebAssembly) and the **Node.js runtime** to parse codebases and print a structured, token-optimized layout map directly to `stdout`.

The architecture must mimic the repository map logic found in Aider, translating source file structures (classes, functions, methods, definitions) into a hierarchical map optimized for LLM context windows.

## Conventions

Always use the `repomap` skill before exploring the codebase.
This is especially useful when you need to plan or perform changes.