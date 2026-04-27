import { z } from "zod";

const bufferEncodingSchema = z.enum([
  "ascii",
  "utf8",
  "utf-8",
  "utf16le",
  "ucs2",
  "ucs-2",
  "base64",
  "base64url",
  "latin1",
  "binary",
  "hex",
]);

export const createFileWithDirectoriesSchema = z.object({
  filePath: z
    .string()
    .describe("Absolute or relative path to the target file."),
  content: z.string().describe("Content to write. Use Base64 for binary data."),
  options: z
    .object({
      overwrite: z.boolean().optional(),
      encoding: bufferEncodingSchema
        .default("utf8")
        .describe("File encoding, e.g., 'utf8'."),
      mode: z.number().optional().describe("File permissions, e.g., '0o644'."),
    })
    .optional()
    .describe("Optional configuration flags."),
});
