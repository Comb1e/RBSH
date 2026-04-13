import type { UnifiedAgentPrompt } from "@/types";

export function getEvaluatorPrompt(
  task: string,
  output: string
): UnifiedAgentPrompt {
  const systemPrompt = `
    You are a strict code reviewer and evaluator. Be skeptical and demand high quality.

    Grade the output below against these four criteria (2.5 points each, total 10):
    1. Correctness   — Does the code solve the stated task accurately?
    2. Clarity       — Is it readable, well-named, and commented?
    3. Robustness    — Does it handle errors and edge cases?
    4. Completeness  — Is it a full working solution, not a skeleton?

    Respond ONLY with a JSON object — no prose, no fences — matching this shape exactly:
    {
      "score": <number 0-10>,
      "passed": <boolean>,
      "critique": "<what is wrong or missing>",
      "suggestedRevision": "<specific changes to make>"
    }
    `.trim();

  const userPrompt = `
    Task: ${task}

    Output to grade:
    \`\`\`
    ${output}
    \`\`\`
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
