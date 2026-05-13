import { z } from "zod";

const ParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

// Schema for Dict / Object with known keys
const FieldSchema = z.object({
  key: z.string(),
  type: z.string(), // e.g., "pd.DataFrame"
  description: z.string(),
});

// Schema for List / Array with known element structure
const ItemSchema = z.object({
  type: z.string(), // e.g., "dict", "int"
  description: z.string(),
  // Note: If items can also be complex objects with fields, you might need recursive zoning
  // For now, keeping it simple as per your example
});

const ElementSchema = z.object({
  index: z.number(),
  type: z.string(), // e.g., "np.ndarray"
  description: z.string(),
  fields: z.array(FieldSchema).optional(),
});

// Combine them using discriminatedUnion on the 'type' field
export const ReturnsSchema = z.object({
  type: z.string(),
  description: z.string(),
  elements: z.array(ElementSchema).optional(),
  items: ItemSchema.optional(),
});

const ApiSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.array(ParameterSchema),
  returns: ReturnsSchema,
  visibility: z.string(),
  class: z.string().nullable().optional(),
});

const VariableSchema = z.object({
  name: z.string(),
  type: z.string(),
  initial_value: z.string(),
  scope: z.string(),
  description: z.string(),
});

const ClassSchema = z.object({
  name: z.string(),
  description: z.string(),
  properties: z.array(z.string()),
  methods: z.array(z.string()),
});

const FileSchema = z.object({
  file: z.object({
    file_name: z.string(),
    relative_path: z.string(),
    summary: z.string(),
  }),
  apis: z.array(ApiSchema),
  variables: z.array(VariableSchema),
  classes: z.array(ClassSchema),
});

const TextSummarySchema = z.object({
  overview: z.string().describe("A brief overall summary of the text."),
  key_points: z
    .array(z.string())
    .describe("A list of key points extracted from the text."),
  conclusion: z.string().describe("The final conclusion or takeaway."),
});

export const ToolAnalysisResultSchema = z.object({
  tool: z.string(),
  purpose: z.string(),
  request: z.string(),
  result: z.string().optional(),
  code_summary: z.array(FileSchema).optional(),
  text_summary: TextSummarySchema.optional(),
});

export type ToolAnalysisResult = z.infer<typeof ToolAnalysisResultSchema>;

export function parseMultipleToolResults(input: string): ToolAnalysisResult[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Strategy 1: Valid JSON array [{...}, {...}] — the canonical format
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const results: ToolAnalysisResult[] = [];
      for (const item of parsed) {
        const valid = ToolAnalysisResultSchema.safeParse(item);
        if (valid.success) {
          results.push(valid.data);
        } else {
          console.warn(
            "[WARN] SUMMARIZATION array item failed validation:",
            valid.error.issues.slice(0, 3)
          );
        }
      }
      if (results.length > 0) return results;
    } else {
      // Single JSON object
      const valid = ToolAnalysisResultSchema.safeParse(parsed);
      if (valid.success) return [valid.data];
    }
  } catch {
    // Not valid JSON — fall through to other strategies
  }

  // Strategy 2: NDJSON (one complete JSON object per line)
  try {
    const lines = trimmed.split("\n").filter((l) => l.trim());
    const results: ToolAnalysisResult[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const valid = ToolAnalysisResultSchema.safeParse(obj);
        if (valid.success) results.push(valid.data);
      } catch {
        // skip unparseable lines
      }
    }
    if (results.length > 0) return results;
  } catch {
    // ignore
  }

  // Strategy 3: Concatenated objects {..}{..} (old broken format)
  // Split on "}\n{" or "}{" boundaries and try each chunk
  try {
    const chunks = trimmed.split(/}\s*\{/);
    const results: ToolAnalysisResult[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      if (i > 0) chunk = "{" + chunk;
      if (i < chunks.length - 1) chunk = chunk + "}";
      try {
        const obj = JSON.parse(chunk);
        const valid = ToolAnalysisResultSchema.safeParse(obj);
        if (valid.success) results.push(valid.data);
      } catch {
        // skip unparseable chunks
      }
    }
    if (results.length > 0) return results;
  } catch {
    // ignore
  }

  console.warn(
    "[WARN] Could not parse any SUMMARIZATION objects from input (first 200 chars):",
    trimmed.slice(0, 200)
  );
  return [];
}
