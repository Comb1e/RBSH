import { z } from "zod";

export const replaceInFileSchema = z.object({
  filePath: z
    .string()
    .min(1)
    .refine((p) => !p.includes(".."), "Path must not contain '..' segments")
    .refine((p) => !p.startsWith("/") && !p.match(/^[A-Za-z]:/), "Path must be relative")
    .describe("Relative path to the target file (within the output directory)."),
  old_string: z
    .string()
    .min(1)
    .describe("Exact text to replace. Must appear exactly once in the file. Literal match, not regex."),
  new_string: z
    .string()
    .describe("Replacement text. Can be empty to delete the matched text."),
});

export type ReplaceInFileArgs = z.infer<typeof replaceInFileSchema>;
