import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

// 1. load .env file
dotenv.config();

// 2. Define and validate Schema
const envSchema = z
  .object({
    LLM_PROVIDER: z.enum(["openai"]).default("openai"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z
      .string()
      .url()
      .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    OPENAI_MODEL: z.string().default("qwen-plus-latest"),
    AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(5),
    PLANNER_MAX_ITERATIONS: z.coerce.number().int().positive().default(3),
    GENERATOR_MAX_ITERATIONS: z.coerce.number().int().positive().default(5),
    EVALUATOR_MAX_ITERATIONS: z.coerce.number().int().positive().default(3),
    AGENT_TEMPERATURE: z.coerce.number().min(0).max(2).default(0),
    ENABLE_STREAMING: z
      .string()
      .transform((v) => v.toLowerCase() === "true")
      .default("false"),
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
  });

// 3. Analyze and export (type safe+startup verification)
export const env = envSchema.parse(process.env);
export type EnvConfig = z.infer<typeof envSchema>;

const __filename = fileURLToPath(import.meta.url);
const __configdirname = path.dirname(__filename);
export const __dirname = path.dirname(__configdirname);
