import OpenAI from "openai";
import { ToolDefinition } from "@/types/index.js";
import { createFileWithDirectoriesSchema } from "@/schemas/index.js";
import { createFileWithDirectories } from "./scripts/create.js";

export const generatorToolRegistry: Record<string, ToolDefinition> = {
  createFileWithDirectories: {
    name: "createFileWithDirectories",
    description:
      "Creates a file at the specified path, automatically creating any missing parent directories.",
    schema: createFileWithDirectoriesSchema,
    execute: async (args) => {
      const finalContent = args.content.startsWith("base64:")
        ? Buffer.from(args.content.split(":")[1], "base64")
        : args.content;

      return await createFileWithDirectories(
        args.filePath,
        finalContent as any,
        args.options
      );
    },
  },
};

export const generatorTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "createFileWithDirectories",
      description:
        "Creates a file at the specified path, automatically creating any missing parent directories.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description:
              "Absolute or relative path to the target file. Must be a valid, non-empty string.",
          },
          content: {
            type: "string",
            description:
              "Content to write to the file. Use plain text for text files, or a Base64-encoded string for binary data (Buffer/Uint8Array).",
          },
          options: {
            type: "object",
            description:
              "Optional configuration flags for file creation (e.g., encoding, permissions).",
            properties: {
              encoding: {
                type: "string",
                description:
                  "File encoding, e.g., 'utf8', 'base64'. Defaults to 'utf8'.",
              },
              mode: {
                type: "string",
                description: "File permissions in octal format, e.g., '0o644'.",
              },
            },
            additionalProperties: true,
          },
        },
        required: ["filePath", "content"],
      },
    },
  },
];

export function doGeneratorToolCall(): void {
  // This function is a placeholder to satisfy the tool interface.
  // The actual implementation is handled by the OpenAI tools system.
  throw new Error(
    "This function should not be called directly. It is meant to be invoked by the OpenAI tools system."
  );
}
