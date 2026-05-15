import { z } from "zod";

export const ListDirArgsSchema = z.object({
  dirPath: z
    .string()
    .min(1, "Directory path must not be empty")
    .refine((p) => !p.includes(".."), "Path must not contain '..' segments")
    .describe(
      "Relative path to the directory (e.g. './src' or '.' for project root). No leading slash, no '..'."
    ),
});

export type ListDirArgs = z.infer<typeof ListDirArgsSchema>;
