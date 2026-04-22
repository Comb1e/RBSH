import { z } from "zod";

const ParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
});

const ApiSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.array(ParameterSchema),
  returns: z.object({
    type: z.string(),
    description: z.string(),
  }),
  visibility: z.string(),
  class: z.string().nullable(),
});

const VariableSchema = z.object({
  name: z.string(),
  type: z.string(),
  initial_value: z.string(),
  scope: z.string(),
  description: z.string(),
});

const ClassSchema = z.object({
  name: z.string(),
  description: z.string(),
  properties: z.array(z.string()),
  methods: z.array(z.string()),
});

const FileSchema = z.object({
  file: z.object({
    file_name: z.string(),
    relative_path: z.string(),
    summary: z.string(),
  }),
  apis: z.array(ApiSchema),
  variables: z.array(VariableSchema),
  classes: z.array(ClassSchema),
});

export const CodeAnalysisSchema = z.object({
  files: z.array(FileSchema),
});

export type CodeAnalysisResult = z.infer<typeof CodeAnalysisSchema>;
