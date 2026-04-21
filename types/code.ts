/**
 * Code block structure
 */
export interface CodeBlock {
  language: string;
  content: string;
}

export interface PathExtractionResult {
  folder: string;
  file: string;
}

export interface CodeUnifiedInfo {
  path: string;
  code: string;
}
