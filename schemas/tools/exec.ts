import * as z from "zod";

// Zod schema for command execution options
export const CommandOptionsSchema = z.object({
  command: z.string().min(1, "Command cannot be empty"),
  cwd: z.string().optional().default(process.cwd()),
  timeout: z.number().positive().optional().default(30000), // 30 seconds default
  maxBuffer: z
    .number()
    .positive()
    .optional()
    .default(1024 * 1024 * 10), // 10MB default
  shell: z.boolean().optional().default(true),
  env: z.record(z.string()).optional(),
  input: z.string().optional().default(""), // stdin input
});

export type CommandOptions = z.infer<typeof CommandOptionsSchema>;
