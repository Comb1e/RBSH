import type { UnifiedAgentPrompt } from "@/types/index.js";

export function getPlannerPrompt(task: string): UnifiedAgentPrompt {
  const systemPrompt = `
    You are a planning agent. Break the following task into concrete, sequential sub-tasks. For simple ones, 2-6 is perfect; for complex ones, more may be needed. Be specific and actionable — avoid vague or high-level steps.
    Return ONLY a JSON array of strings — no prose, no markdown fences.
    `.trim();
  const userPrompt = `
    Task: ${task}
    `.trim();
  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
