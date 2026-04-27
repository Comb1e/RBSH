import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. INPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
export const ReadFileArgsSchema = z.object({
  action: z.enum(["read_file", "list_dir"]).optional().default("read_file"),
  filePath: z.string().min(1, "File path must not be empty"),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 2. STANDARDIZED OUTPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
export const ReadFileResultSchema = z.discriminatedUnion("success", [
  // ✅ Success: File Content
  z.object({
    success: z.literal("read_file_success"),
    type: z.literal("file"),
    path: z.string(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    content: z.string(),
    linesReturned: z.number().int().nonnegative(),
    warning: z.string().optional(),
    note: z.string().optional(),
  }),
  // ✅ Success: Directory Listing
  z.object({
    success: z.literal("list_dir_success"),
    type: z.literal("directory"),
    path: z.string(),
    entries: z.array(
      z.object({
        name: z.string(),
        type: z.enum(["directory", "file"]),
      })
    ),
  }),
  // ❌ Error
  z.object({
    success: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
    stack: z.string().optional(),
  }),
]);

export type ReadFileResult = z.infer<typeof ReadFileResultSchema>;
