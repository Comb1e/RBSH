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

const DependencySchema = z.object({
  module: z.string(),
  symbols: z.array(z.string()),
  purpose: z.string(),
});

const RelationshipsSchema = z.object({
  function_calls: z.array(
    z.object({
      caller: z.string(),
      callee: z.string(),
    })
  ),
  variable_usage: z.array(
    z.object({
      variable: z.string(),
      used_by: z.string(),
    })
  ),
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
  dependencies: z.array(DependencySchema),
  relationships: RelationshipsSchema,
});

export const CodeAnalysisSchema = z.object({
  files: z.array(FileSchema),
});

export type CodeAnalysisResult = z.infer<typeof CodeAnalysisSchema>;
