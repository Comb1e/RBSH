import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

export async function getModifierBaseMessage(
  modificationRequest: string,
  existingPlanLocation: string,
  projectDir?: string
): Promise<AgentMessage[]> {
  const isSchema = existingPlanLocation.includes("schema.md");
  const isPlan = existingPlanLocation.includes("plan.md");

  const roleLabel = isSchema ? "Schema Modifier Agent" : "Plan Modifier Agent";

  let basicSkills: string[] = [];
  if (isPlan) {
    basicSkills = await readFilesFromRecord({
      skills: ["modifier.md", "execute_command.md"],
    });
  }

  const systemPrompt = `
  You are a ${roleLabel}. Your sole responsibility is to take an existing structured document and apply targeted modifications requested by the user — without altering sections that are not affected by the request.

  === EDITING RULES ===
  - Make surgical edits only: change exactly what the command specifies, nothing else.
  - Preserve all Markdown structure (headings, tables, lists, blank lines).
  - Do not add commentary, apologies, or free-text explanations.
  - If a command is ambiguous, apply the most minimal reasonable interpretation.
  ${
    basicSkills.length > 0
      ? `\n  === BASIC SKILLS ===\n  ${basicSkills.join("\n\n")}`
      : ""
  }

  === OUTPUT FORMAT ===
  After writing the modified document, you MUST append a \`<TASK_COMPLETE>\` block.
  The harness detects this tag to confirm your work is done — without it your response
  will be rejected. Format:

  \`\`\`
  (the complete modified document, exactly as it should appear on disk)

  <TASK_COMPLETE>
  Command  : <the modification you were asked to make>
  Changes  : <brief summary of what was changed>
  </TASK_COMPLETE>
  \`\`\`

  Do NOT wrap the document in code fences. The \`<TASK_COMPLETE>\` block must be
  the very last thing in your response.
  `.trim();

  let extraContext = "";
  if (isSchema) {
    extraContext =
      "Note: The original input schema files are in the ./output_schemas/ directory. Use readFile to list and read them for reference when modifying this schema description.";
  } else if (isPlan && projectDir) {
    extraContext = `Note: The project's schema is at \`${projectDir}/schema.md\`. Read it with readFile if you need schema context for this modification.`;
  }

  const userPrompt = `
  Here is the location of the existing document:

  <location>
  ${existingPlanLocation.trim()}
  </location>

  Here is the modification request:

  <modification_request>
  ${modificationRequest.trim()}
  </modification_request>

  ${extraContext}
  Apply the requested modification.
    `.trim();
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
