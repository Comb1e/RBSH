import * as z from "zod";

// Zod schema for command execution options (public — what the LLM sees)
export const CommandOptionsSchema = z.object({
  command: z.string().min(1, "Command cannot be empty"),
  args: z.array(z.string()).optional().default([]),
  timeout: z.number().int().positive().optional().default(30000),
  maxBuffer: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1024 * 1024 * 10), // 10MB default
  shell: z.boolean().optional().default(false), // safer: no shell by default
  env: z.record(z.string()).optional(),
  input: z.string().optional(),
});

export type CommandOptions = z.infer<typeof CommandOptionsSchema>;

/** Internal options — includes cwd which is set by the harness, not the LLM. */
export interface ExecuteCommandOptions extends CommandOptions {
  cwd?: string;
}
