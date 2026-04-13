import type { UnifiedAgentPrompt, HandoffArtifact } from "@/types/index.js";

export function getGeneratorPrompt(
  artifact: HandoffArtifact
): UnifiedAgentPrompt {
  const systemPrompt = `
  You are an task complete agent continuing a multi-session task.
  === INSTRUCTIONS ===
  Complete the next step. Output ONLY the result of that step — no preamble.
    `.trim();

  const userPrompt = `
  === HANDOFF ARTIFACT ===
  Task: ${artifact.task}

  Completed steps:
  ${
    artifact.completedSteps.map((s, i) => `  ${i + 1}. ✓ ${s}`).join("\n") ||
    "  (none yet)"
  }

  Next step to execute:
    ${artifact.remainingSteps[0] ?? "(all steps complete)"}

  Previous output to build on:
  ${artifact.currentOutput || "(no prior output)"}
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
