// ── CLI argument types ──────────────────────────────────────────────────────

export type Command = "plan" | "execute" | "explain";

export interface CliArgs {
  command: Command;
  projectName?: string;
  addFiles: string[];
}
