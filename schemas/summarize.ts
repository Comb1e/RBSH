import { parse } from "path";
import { z } from "zod";

const ParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

// Schema for Primitive / Simple Type
const PrimitiveBoolReturnSchema = z.object({
  type: z.literal("bool"),
  description: z.string(),
});

const PrimitiveNumberReturnSchema = z.object({
  type: z.literal("number"),
  description: z.string(),
});

const PrimitiveStringReturnSchema = z.object({
  type: z.literal("string"),
  description: z.string(),
});

// Schema for Dict / Object with known keys
const FieldSchema = z.object({
  key: z.string(),
  type: z.string(), // e.g., "pd.DataFrame"
  description: z.string(),
});

const DictReturnSchema = z.object({
  type: z.literal("dict"),
  description: z.string(),
  fields: z.array(FieldSchema),
});

// Schema for List / Array with known element structure
const ItemSchema = z.object({
  type: z.string(), // e.g., "dict", "int"
  description: z.string(),
  // Note: If items can also be complex objects with fields, you might need recursive zoning
  // For now, keeping it simple as per your example
});

const ListReturnSchema = z.object({
  type: z.literal("list"),
  description: z.string(),
  items: ItemSchema,
});

// Schema for Tuple with known positions
const ElementSchema = z.object({
  index: z.number(),
  type: z.string(), // e.g., "np.ndarray"
  description: z.string(),
});

const TupleReturnSchema = z.object({
  type: z.literal("tuple"),
  description: z.string(),
  elements: z.array(ElementSchema),
});

// Combine them using discriminatedUnion on the 'type' field
export const ReturnsSchema = z.discriminatedUnion("type", [
  PrimitiveBoolReturnSchema,
  PrimitiveNumberReturnSchema,
  PrimitiveStringReturnSchema,
  DictReturnSchema,
  ListReturnSchema,
  TupleReturnSchema,
]);

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
  const results: ToolAnalysisResult[] = [];

  const parsedArray = JSON.parse(input);
  if (Array.isArray(parsedArray)) {
    for (const item of parsedArray) {
      const validItem = ToolAnalysisResultSchema.safeParse(item);
      if (validItem.success) {
        results.push(validItem.data);
      } else {
        console.warn("Failed to validate array item:", validItem.error);
      }
    }
    return results;
  }
  const item = ToolAnalysisResultSchema.safeParse(parsedArray);
  console.log("\n", item);
  if (item.success) {
    results.push(item.data);
  }
  return results;
}
