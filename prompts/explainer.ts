import type { AgentMessage } from "@/types/index.js";

export async function getExplainerPrompt(
  inputSchemas: string,
  taskDescription: string
): Promise<AgentMessage[]> {
  const systemPrompt = `
=== INSTRUCTIONS ===
You are explaining the input data to a developer who will implement the project.
Write a clear, structured Markdown document that explains every sheet, column,
and relationship in the input data. Use the comprehension methodology from the
skill to classify sheets, assign column roles, and trace relationships.

Do NOT solve the problem. Do NOT write code. Only explain what the data means.

If you are not given a project name, generate an appropriate snake_case project
name based on the user's task description and the input data. Output it on the
very first line as: <PROJECT_NAME>the_project_name</PROJECT_NAME>

=== PROJECT CONTEXT ===
${taskDescription || "(no task description provided)"}
  `.trim();

  const userPrompt = `
=== Input Schemas ===
${inputSchemas}

Output a single Markdown document with these sections:

## Data Overview
Brief summary of what the input data represents.

## Sheets
For each sheet:
  - **Sheet name** — role (FACT/DIMENSION/CONFIG/etc.)
  - **Columns**: table with | Column | Type | Meaning | Role | Caveats |
  - **Column groups** (if any): pattern, range, meaning

## Cross-Sheet Relationships
Table with | From | To | Type | Note |

## Key Takeaways
Bullet list of the 3-5 most important things a developer must know about this data.
  `.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
