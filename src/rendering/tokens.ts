/**
 * Token estimation for repo map output.
 *
 * Provides fast character-based token estimation, with a more precise
 * sampling approach for longer texts. This is used to fit the repo map
 * within a token budget.
 *
 * Note: This is an approximation. Real token counts vary by model
 * (claude vs gpt vs deepseek all tokenize differently).
 * Character-based estimation at ~3.5 chars/token is a reasonable
 * average across common LLMs.
 */

/** Average characters per token across common LLMs */
const CHARS_PER_TOKEN = 3.5;

/**
 * Estimate the number of tokens in a text string.
 *
 * For short texts (< 200 chars), counts precisely.
 * For longer texts, samples every Nth line to avoid O(n) scan.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  const length = text.length;

  if (length < 200) {
    // Short text: precise character count
    return Math.ceil(length / CHARS_PER_TOKEN);
  }

  // Long text: sample every 100th line, estimate total
  const lines = text.split("\n");
  const numLines = lines.length;

  if (numLines <= 1) {
    return Math.ceil(length / CHARS_PER_TOKEN);
  }

  const step = Math.max(1, Math.floor(numLines / 100));
  let sampleLength = 0;
  let sampledLines = 0;

  for (let i = 0; i < numLines; i += step) {
    sampleLength += lines[i].length + 1; // +1 for newline
    sampledLines++;
  }

  if (sampledLines === 0) return 0;

  const avgLineLength = sampleLength / sampledLines;
  const estimatedTotalLength = avgLineLength * numLines;

  return Math.ceil(estimatedTotalLength / CHARS_PER_TOKEN);
}

/**
 * Check if a rendered map fits within a token budget.
 * Returns true if the estimated token count is within budget.
 */
export function fitsInBudget(text: string, budget: number): boolean {
  if (budget <= 0) return true; // no limit
  return estimateTokenCount(text) <= budget;
}
