import {
  ScoreExtractionResult,
} from "@/types/index.js";

/**
 * Extracts the content inside <TASK_COMPLETE>...</TASK_COMPLETE> XML tags.
 * Case-insensitive. Also tolerates leading/trailing whitespace around the content.
 */
export function extractTaskCompleteContent(input: string): string | null {
  // Accepts: <TASK_COMPLETE>...</TASK_COMPLETE> (with optional attributes, case-insensitive)
  const regex = /<TASK_COMPLETE\b[^>]*>\s*([\s\S]*?)\s*<\/TASK_COMPLETE>/i;
  const match = input.match(regex);

  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  console.log("[INFO] No <TASK_COMPLETE> block found.");
  return null;
}

/**
 * Extracts the content inside <SUMMARIZATION>...</SUMMARIZATION> XML tags.
 * Accepts optional attributes (e.g. <SUMMARIZATION type="json">) and is case-insensitive.
 */
export function extractSummarizationContent(input: string): string | null {
  const regex = /<SUMMARIZATION\b[^>]*>\s*([\s\S]*?)\s*<\/SUMMARIZATION>/i;
  const match = input.match(regex);

  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  console.log("[INFO] No <SUMMARIZATION> block found.");
  return null;
}

export function serializeResult(result: unknown): string {
  if (result === null) return "null";
  if (result === undefined) return "undefined";

  if (typeof result === "string") return result;

  try {
    return JSON.stringify(result);
  } catch {
    // Handle circular references and other non-serializable values
    return String(result);
  }
}

/**
 * Extracts the overall score and pass/fail status from a text string.
 *
 * @param text - The input string containing score information.
 * @returns An object with score and status, or null if not found.
 */
export function extractOverallScore(text: string): ScoreExtractionResult {
  if (!text || typeof text !== "string") {
    return {
      score: 0,
      status: "Fail",
    };
  }

  // Strategy:
  // 1. Look for the "## Overall Score" header.
  // 2. Capture the number (integer or decimal) following it.
  // 3. Capture the "Pass" or "Fail" keyword appearing after the score.

  // Regex Explanation:
  // ##\s*Overall\s+Score : Matches the header "## Overall Score" (flexible whitespace)
  // \s*                  : Optional whitespace/newlines after header
  // (\d+(?:\.\d+)?)      : Capture Group 1: The score (e.g., 4.0, 4, 92.5)
  // .*?                  : Non-greedy match for any characters in between (e.g., "/ 4.0 —")
  // (Pass|Fail)          : Capture Group 2: The status "Pass" or "Fail"
  // i                    : Case-insensitive flag
  const regex =
    /##\s*Overall\s+Score[\s\S]*?(\d+(?:\.\d+)?)[\s\S]*?(Pass|Fail)/i;

  const match = text.match(regex);

  if (!match) {
    return {
      score: 0,
      status: "Fail",
    };
  }

  const scoreStr = match[1];
  const statusStr = match[2].toLowerCase();

  const score = parseFloat(scoreStr);

  if (isNaN(score)) {
    return {
      score: 0,
      status: "Fail",
    };
  }

  return {
    score: score,
    // Normalize to capitalized 'Pass' or 'Fail'
    status: statusStr === "pass" ? "Pass" : "Fail",
  };
}
