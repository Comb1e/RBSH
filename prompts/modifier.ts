import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const plannerBase = {
  skills: ["modifier.md"],
};

export async function getModifierBaseMessage(
  modificationRequest: string,
  existingPlanLocation: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(plannerBase);

  const systemPrompt = `
  You are a Plan Modifier Agent. Your sole responsibility is to take an existing structured project plan and apply targeted modifications requested by the user — without altering sections that are not affected by the request.

  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}
  `.trim();

  const userPrompt = `
  Here is the location of the existing plan:

  <location>
  ${existingPlanLocation.trim()}
  </location>

  Here is the modification request:

  <modification_request>
  ${modificationRequest.trim()}
  </modification_request>

  Apply the requested modification.
    `.trim();
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    { role: "user", content: userPrompt },
  ];
}
