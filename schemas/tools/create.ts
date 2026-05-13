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
    .min(1)
    .refine((p) => !p.includes(".."), "Path must not contain '..' segments")
    .refine((p) => !p.startsWith("/") && !p.match(/^[A-Za-z]:/), "Path must be relative")
    .describe("Relative path to the target file (within the output directory)."),
  content: z.string().describe("Content to write. Prefix with 'base64:' for binary data."),
  options: z
    .object({
      overwrite: z.boolean().optional().default(true),
      encoding: bufferEncodingSchema
        .default("utf8")
        .describe("File encoding, e.g., 'utf8'."),
      mode: z
        .number()
        .int()
        .min(0)
        .max(0o777)
        .optional()
        .default(0o644)
        .describe("File permissions (0-777)."),
    })
    .optional()
    .default({})
    .describe("Optional configuration flags."),
});
