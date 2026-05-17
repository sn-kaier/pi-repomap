/**
 * pi-repomap extension for pi-agent.
 *
 * Registers a `repomap` tool that generates a structured, ranked
 * repository map using web-tree-sitter.
 *
 * Usage in pi-agent:
 *   repomap({ path: "./src", tokenBudget: 1024 })
 *   repomap({ path: ".", maxDepth: 3 })
 */

import { type ExtensionAPI, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema, type Static } from "typebox";
import { generateRepomap } from "../repomap.ts";

/** Tool parameter schema */
const RepomapParams = Type.Object({
  path: Type.String({ description: "Path to a directory or file to map" }),
  tokenBudget: Type.Optional(
    Type.Integer({ description: "Maximum estimated tokens for the output (0 = no limit)", default: 0, minimum: 0 })
  ),
  maxDepth: Type.Optional(
    Type.Integer({ description: "Maximum nesting depth in the output tree (0 = unlimited)", default: 0, minimum: 0 })
  ),

  mentionedFiles: Type.Optional(
    Type.Array(Type.String(), { description: "File paths to boost in ranking (relative to repo root)" })
  ),
  mentionedIdents: Type.Optional(
    Type.Array(Type.String(), { description: "Identifier names to boost in ranking" })
  ),
});

interface RepomapParamsType {
  path: string;
  tokenBudget?: number;
  maxDepth?: number;
  mentionedFiles?: string[];
  mentionedIdents?: string[];
}

export default function registerRepomap(pi: ExtensionAPI): void {
  const tool: ToolDefinition<typeof RepomapParams, { fileCount: number; tagCount: number; estimatedTokens: number }> = {
    name: "repomap",
    label: "Repo Map",
    description: `Generate a structured, ranked repository map using tree-sitter.

Scans a directory for source files, extracts symbol definitions and references,
builds a graph, runs PageRank, and outputs a compact tree of ranked symbols.
Always use it once before exploring the codebase!

Examples:
  repomap({ path: "./src" })
  repomap({ path: "./src", tokenBudget: 1024 })
  repomap({ path: ".", maxDepth: 2 })
  repomap({ path: "./lib", tokenBudget: 2048 })`,

    parameters: RepomapParams as unknown as TSchema,

    async execute(
      _id: string,
      params: RepomapParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: ((result: { content?: string; details?: Record<string, unknown> }) => void) | undefined
    ) {
      try {
        if (onUpdate) {
          onUpdate({ content: "Scanning files..." });
        }

        const result = await generateRepomap({
          path: params.path,
          tokenBudget: params.tokenBudget ?? 0,
          maxDepth: params.maxDepth ?? 0,
          mentionedFiles: params.mentionedFiles ?? [],
          mentionedIdents: params.mentionedIdents ?? [],
        });

        if (!result.map) {
          return {
            content: "(empty — no source files found or parsed)",
            details: { fileCount: 0, tagCount: 0, estimatedTokens: 0 },
          };
        }

        const tokenEstimate = Math.ceil(result.map.length / 3.5);

        return {
          content: result.map,
          details: {
            fileCount: result.fileCount,
            tagCount: result.tagCount,
            estimatedTokens: tokenEstimate,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[repomap] Error: ${message}`);
        return {
          content: `Error generating repo map: ${message}`,
          details: { fileCount: 0, tagCount: 0, estimatedTokens: 0 },
        };
      }
    },
  };

  pi.registerTool(tool);
}
