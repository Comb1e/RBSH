import type { UnifiedAgentPrompt } from "@/types";

export function getPlannerPrompt(task: string): UnifiedAgentPrompt {
  const systemPrompt = `
    You are a planning agent. Break the following task into 3-6 concrete, sequential sub-tasks.
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
