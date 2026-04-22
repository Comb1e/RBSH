import { z } from "zod";

// 1. Define the Zod Schema
const CoreProblemSchema = z.object({
  goal: z
    .string()
    .describe("verb phrase: what transformation/output is requested"),
  targetSheets: z.array(z.string()),
  targetColumns: z.array(
    z
      .string()
      .regex(/^[^.]+\.[A-Z]+$/i, "Must be in format 'SheetName.ColumnLetter'")
  ),
  outputLocation: z.enum([
    "new_column",
    "new_sheet",
    "existing_cell",
    "formula",
    "ambiguous",
  ]),
  outputDetail: z.string(),
  constraints: z.array(z.string()),
  assumptions: z.array(
    z.object({
      topic: z.string(),
      assumed: z.string(),
    })
  ),
});

const ColumnSchema = z.object({
  sheet: z.string(),
  columnLetter: z
    .string()
    .regex(/^[A-Z]+$/i, "Must be a valid column letter(s)"),
  headerName: z.string(),
  inferredType: z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "empty",
    "mixed",
  ]),
  alwaysEmpty: z.boolean(),
  meaning: z.string(),
  taskRole: z.enum([
    "INPUT",
    "OUTPUT",
    "KEY",
    "FILTER",
    "LABEL",
    "IRRELEVANT",
    "UNKNOWN",
  ]),
  taskRoleReason: z.string(),
  caveats: z.array(z.string()),
});

const CrossSheetRelationshipSchema = z.object({
  fromSheet: z.string(),
  fromColumn: z.string().regex(/^[A-Z]+$/i),
  toSheet: z.string(),
  toColumn: z.string().regex(/^[A-Z]+$/i),
  relationshipType: z.enum(["join", "lookup", "reference"]),
  note: z.string(),
});

const MetaSchema = z.object({
  lowConfidenceTypes: z.boolean(),
  lowConfidenceReason: z.string(),
});

const ExtractionResultSchema = z.object({
  coreProblem: CoreProblemSchema,
  columns: z.array(ColumnSchema),
  crossSheetRelationships: z.array(CrossSheetRelationshipSchema),
  meta: MetaSchema,
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
