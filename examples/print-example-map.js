#!/usr/bin/env node

/**
 * print-example-map.js
 *
 * Generates a repository map for a given directory and prints it to stdout.
 *
 * Usage:
 *   node print-example-map.js <path> [output-file]
 *
 * If output-file is provided, the map is written to that file instead of stdout.
 *
 * Examples:
 *   node print-example-map.js ./references/aider map-aider.txt
 *   node print-example-map.js ./references/pi-subagents
 *   node print-example-map.js ./src
 */

import { generateRepomap } from "../src/repomap.ts";
import * as fs from "node:fs";

const args = process.argv.slice(2);

if (args.length < 1 || args[0] === "--help" || args[0] === "-h") {
  console.error(`Usage: node print-example-map.js <path> [output-file]

Generates a repository map for the given directory.

Arguments:
  path          Directory or file to map (required)
  output-file   File to write the map to (optional; defaults to stdout)

Examples:
  node print-example-map.js ./references/aider map-aider.txt
  node print-example-map.js ./references/pi-subagents
  node print-example-map.js ./src
`);
  process.exit(args.length < 1 ? 1 : 0);
}

const targetPath = args[0];
const outputFile = args[1];

try {
  const result = await generateRepomap({ path: targetPath });

  if (outputFile) {
    fs.writeFileSync(outputFile, result.map, "utf-8");
    console.error(`[print-example-map] Wrote ${result.map.length} bytes to ${outputFile}`);
  } else {
    process.stdout.write(result.map);
  }
} catch (err) {
  console.error(`[print-example-map] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
