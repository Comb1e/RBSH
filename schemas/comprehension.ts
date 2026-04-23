import { z } from "zod";

// 1. Define the Zod Schema
const CoreProblemSchema = z.object({
  goal: z
    .string()
    .describe("verb phrase: what transformation/output is requested"),
  outputDetail: z.string(),
  constraints: z.array(z.string()),
  userRequirements: z
    .array(
      z.object({
        key: z.string().describe("requirement name"),
        value: z.string().describe("requirement value"),
      })
    )
    .default([]),
  assumptions: z.array(
    z.object({
      topic: z.string(),
      assumed: z.string(),
    })
  ),
});

const ColumnSchema = z.object({
  columnLetter: z
    .string()
    .regex(/^[A-Z]+$/i, "Must be valid Excel column letters (e.g., A, AA)"),
  headerName: z.string().describe("as extracted from the header row"),
  inferredType: z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "empty",
    "mixed",
  ]),
  meaning: z
    .string()
    .describe("one sentence: what real-world value this field stores"),
  taskRole: z.enum([
    "INPUT",
    "OUTPUT",
    "KEY",
    "FILTER",
    "LABEL",
    "IRRELEVANT",
    "UNKNOWN",
    "CONFIG",
  ]),
  taskRoleReason: z
    .string()
    .describe("one sentence: why this role was assigned"),
  caveats: z.array(z.string()).describe("warning if any — empty array if none"),
});

const ColumnGroupSchema = z.object({
  pattern: z
    .string()
    .describe(
      "header pattern with {i} as placeholder, e.g. 'Bus{i}', 'Week_{i}'"
    ),
  columnRange: z
    .string()
    .describe("first column letter:last column letter, e.g. 'C:E'"),
  count: z
    .number()
    .int()
    .positive()
    .describe("number of columns in this group"),
  inferredType: z
    .enum(["string", "number", "boolean", "date", "empty", "mixed"])
    .describe("shared inferredType"),
  meaning: z
    .string()
    .describe(
      "one sentence describing what all columns in the group represent, using {i} as placeholder for the index"
    ),
  taskRole: z
    .enum([
      "INPUT",
      "OUTPUT",
      "KEY",
      "FILTER",
      "LABEL",
      "IRRELEVANT",
      "UNKNOWN",
      "CONFIG",
    ])
    .describe("shared taskRole"),
  taskRoleReason: z
    .string()
    .describe("one sentence: why this role applies to the whole group"),
  caveats: z
    .array(z.string())
    .describe("shared warning if any — empty array if none"),
});

const SheetSchema = z.object({
  sheetName: z.string(),
  sheetRole: z.enum([
    "FACT",
    "DIMENSION",
    "CONFIG",
    "LOOKUP",
    "OUTPUT",
    "STAGING",
    "UNKNOWN",
  ]),
  columns: z.array(ColumnSchema),
  columnGroups: z.array(ColumnGroupSchema).optional().default([]),
});

const CrossSheetRelationshipSchema = z.object({
  fromSheet: z.string(),
  fromColumn: z.string(),
  toSheet: z.string(),
  toColumn: z.string(),
  relationshipType: z.enum(["join", "lookup", "reference"]),
  note: z.string(),
});

const ExtractionResultSchema = z.object({
  coreProblem: CoreProblemSchema,
  sheets: z.array(SheetSchema),
  crossSheetRelationships: z.array(CrossSheetRelationshipSchema),
});

// Infer the TypeScript type from the schema
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Parses a JSON string containing spreadsheet analysis data into a typed object.
 * @param jsonString - The raw JSON string to parse.
 * @returns The parsed and validated ExtractionResult object.
 * @throws {z.ZodError} If the JSON is invalid or does not match the schema.
 */
export function extractSpreadsheetAnalysis(
  jsonString: string
): ExtractionResult {
  try {
    // First, parse the JSON string into a generic object
    const rawData = JSON.parse(jsonString);

    // Then, validate and transform it using Zod
    return ExtractionResultSchema.parse(rawData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    // Re-throw Zod errors or any other unexpected errors
    throw error;
  }
}
