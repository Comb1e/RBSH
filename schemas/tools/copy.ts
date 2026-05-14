import { z } from "zod";

export const CopyFileArgsSchema = z.object({
  sourcePath: z
    .string()
    .min(1)
    .refine((p) => !p.includes(".."), "Path must not contain '..' segments")
    .refine(
      (p) => !p.startsWith("/") && !p.match(/^[A-Za-z]:/),
      "Path must be relative"
    )
    .describe("Relative path to the source file or directory within input_raw/"),
  destPath: z
    .string()
    .min(1)
    .refine((p) => !p.includes(".."), "Path must not contain '..' segments")
    .refine(
      (p) => !p.startsWith("/") && !p.match(/^[A-Za-z]:/),
      "Path must be relative"
    )
    .describe("Relative destination path within the output directory"),
  overwrite: z.boolean().optional().default(true),
});

export type CopyFileArgs = z.infer<typeof CopyFileArgsSchema>;
