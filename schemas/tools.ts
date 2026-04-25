import { z } from "zod";

export const createFileWithDirectoriesSchema = z.object({
  filePath: z
    .string()
    .describe("Absolute or relative path to the target file."),
  content: z.string().describe("Content to write. Use Base64 for binary data."),
  options: z
    .object({
      encoding: z.string().optional().describe("File encoding, e.g., 'utf8'."),
      mode: z.string().optional().describe("File permissions, e.g., '0o644'."),
    })
    .optional()
    .describe("Optional configuration flags."),
});
