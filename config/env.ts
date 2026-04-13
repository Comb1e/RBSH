import dotenv from "dotenv";
import { z } from "zod";

// 1. load .env file
dotenv.config();

// 2. Define and validate Schema
const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
    TASK_BUDGET: z.preprocess((val) => {
      if (typeof val === "string") {
        return Number(val.replace(/_/g, ""));
      }
      return val;
    }, z.number().int().positive().default(10000)),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z
      .string()
      .url()
      .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    OPENAI_MODEL: z.string().default("qwen-plus-latest"),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default("claude-4-6-sonnet"),
    AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(5),
    AGENT_TEMPERATURE: z.coerce.number().min(0).max(2).default(0),
    PASSING_THRESHOLD: z.coerce.number().min(0).max(10).default(7),
    ENABLE_STREAMING: z
      .string()
      .transform((v) => v.toLowerCase() === "true")
      .default(false),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  })
  .superRefine((val, ctx) => {
    if (val.LLM_PROVIDER === "openai" && !val.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENAI_API_KEY is necessary",
        path: ["OPENAI_API_KEY"],
      });
    }
    if (val.LLM_PROVIDER === "anthropic" && !val.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ANTHROPIC_API_KEY is necessary",
        path: ["ANTHROPIC_API_KEY"],
      });
    }
  });

// 3. Analyze and export (type safe+startup verification)
export const env = envSchema.parse(process.env);
export type EnvConfig = z.infer<typeof envSchema>;
