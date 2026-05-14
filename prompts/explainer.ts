import { readFilesFromRecord } from "@/utils/index.js";
import type { AgentMessage } from "@/types/index.js";

interface SheetInfo {
  sheetName: string;
  columns: {
    headerName: string;
    inferredType: string;
    isAlwaysEmpty: boolean;
  }[];
}

export function buildColumnScaffolding(schemasJson: string): {
  scaffolding: string;
  knownColumns: Set<string>;
} {
  const knownColumns = new Set<string>();

  try {
    const outer: unknown = JSON.parse(schemasJson);
    if (!Array.isArray(outer)) {
      return { scaffolding: schemasJson, knownColumns };
    }

    const sheets: SheetInfo[] = [];

    for (const item of outer) {
      if (typeof item !== "string") continue;
      try {
        const obj: unknown = JSON.parse(item);
        if (obj && typeof obj === "object" && "sheets" in obj) {
          const schema = obj as { sheets?: unknown[] };
          if (Array.isArray(schema.sheets)) {
            for (const s of schema.sheets) {
              const sheet = s as {
                sheetName?: string;
                columns?: {
                  headerName?: string;
                  inferredType?: string;
                  isAlwaysEmpty?: boolean;
                }[];
              };
              if (sheet.sheetName && Array.isArray(sheet.columns)) {
                knownColumns.add(sheet.sheetName);
                const columns = sheet.columns.map((c) => {
                  const name = c.headerName || "(unnamed)";
                  knownColumns.add(name);
                  return {
                    headerName: name,
                    inferredType: c.inferredType || "unknown",
                    isAlwaysEmpty: !!c.isAlwaysEmpty,
                  };
                });
                sheets.push({ sheetName: sheet.sheetName, columns });
              }
            }
          }
        }
      } catch {
        /* skip unparseable items */
      }
    }

    if (sheets.length === 0) {
      return { scaffolding: schemasJson, knownColumns };
    }

    // Build Markdown scaffolding
    const lines: string[] = [];
    for (const sheet of sheets) {
      lines.push(`### Sheet: \`${sheet.sheetName}\``);
      lines.push("");
      lines.push("| Column | Type | Meaning | Role | Caveats |");
      lines.push("|--------|------|---------|------|---------|");

      for (const col of sheet.columns) {
        const typeHint = col.isAlwaysEmpty ? "empty" : col.inferredType;
        lines.push(`| \`${col.headerName}\` | ${typeHint} | | | |`);
      }
      lines.push("");
    }

    return { scaffolding: lines.join("\n"), knownColumns };
  } catch {
    return { scaffolding: schemasJson, knownColumns };
  }
}

const explainerInstructions = {
  skills: ["generator.md", "coding.md", "user_preferences.md"],
};

export async function getExplainerPrompt(
  inputSchemas: string,
  taskDescription: string
): Promise<AgentMessage[]> {
  const { scaffolding } = buildColumnScaffolding(inputSchemas);

  const basicInstructions = await readFilesFromRecord(explainerInstructions);

  const systemPrompt = `
=== INSTRUCTIONS ===
${basicInstructions}

=== PROJECT CONTEXT ===
${taskDescription || "(no task description provided)"}
  `.trim();

  const userPrompt = `
=== Input Schemas ===
${scaffolding}

For each sheet above:
1. Classify the sheet's role (add it next to the sheet name, e.g. "### Sheet: nodes (FACT)")
2. Fill in Meaning, Role, and Caveats for every column row
3. Refine the Type column where the inferred type is wrong or too vague

At the end, add:
## Cross-Sheet Relationships
Table with | From (sheet.column) | To (sheet.column) | Type | Note |

## Key Takeaways
3-5 bullet points a developer must know about this data. Include the paths to
input data files (they will be copied to \`input_data/\` in the project directory).
  `.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
