import type { LLMProvider, AgentMessage } from "@/types/index.js";
import { TASK_TYPES } from "./index.js";
import type { TaskTypeDef } from "./index.js";

const CLASSIFIER_SYSTEM = [
  "You are a task classifier. Given a user's project description, determine",
  "which task type best fits the work. Return ONLY the slug (e.g.",
  '"math_modeling") or "none" if no specific domain fits — most software',
  "engineering projects without math/modeling content are 'none'.",
  "",
  "Be conservative: only return a domain slug when the description clearly",
  "involves that domain's characteristic methods and goals.",
].join("\n");

async function classifyWithLLM(
  provider: LLMProvider,
  userPrompt: string,
  candidates: TaskTypeDef[]
): Promise<string | null> {
  const descriptions = candidates
    .map((t) => `- ${t.slug}: ${t.description}`)
    .join("\n");

  const messages: AgentMessage[] = [
    { role: "system", content: CLASSIFIER_SYSTEM },
    {
      role: "user",
      content: [
        "Task types:",
        descriptions,
        "",
        "Project description:",
        userPrompt,
        "",
        "Best fit slug (or 'none'):",
      ].join("\n"),
    },
  ];

  const result = await provider.complete(messages, {});
  const response = result.content?.trim().toLowerCase() || "";

  if (!response) {
    console.warn("[WARN] LLM classifier returned empty response");
    return null;
  }

  for (const tt of TASK_TYPES) {
    if (response.includes(tt.slug)) {
      console.log(`[INFO] LLM classifier selected: ${tt.slug}`);
      return tt.slug;
    }
  }

  return null;
}

export async function classifyTaskType(
  provider: LLMProvider,
  userPrompt: string
): Promise<string | null> {
  if (!userPrompt) return null;

  const lower = userPrompt.toLowerCase();

  const matches = TASK_TYPES.filter((tt) =>
    tt.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );

  if (matches.length === 1) {
    console.log(`[INFO] Task type detected via keywords: ${matches[0].slug}`);
    return matches[0].slug;
  }

  if (matches.length === 0) {
    console.log(
      "[INFO] No keyword matches — running LLM classifier on all task types..."
    );
    return classifyWithLLM(provider, userPrompt, TASK_TYPES);
  }

  console.log(
    "[INFO] Multiple task types matched keywords, running LLM classifier..."
  );
  return classifyWithLLM(provider, userPrompt, matches);
}
