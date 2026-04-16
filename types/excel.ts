export interface WorkbookSchema {
  /** Base file name (without directory) */
  fileName: string;
  /** ISO-8601 timestamp of when this schema was generated */
  generatedAt: string;
  /** How many data rows were sampled per sheet */
  sampleRowsUsed: number;
  sheets: SheetSchema[];
  /**
   * Plain-English summary describing every sheet and its columns.
   * Designed to be embedded directly into an LLM system prompt.
   */
  summary: string;
}

export interface ParseOptions {
  /**
   * Number of data rows (after the header) to sample per sheet.
   * Used for type inference and collecting example values.
   * @default 10
   */
  sampleSize?: number;
  /**
   * Maximum character length for individual sample values.
   * Longer strings are truncated with "…".
   * @default 80
   */
  maxValueLength?: number;
}

export interface ColumnSchema {
  /** Excel column letter (A, B, C, …, AA, AB, …) */
  columnLetter: string;
  /** Header text read from the header row */
  headerName: string;
  /** Data type inferred from sampled cell values */
  inferredType: InferredType;
  /** Up to 5 representative non-empty values from the sampled rows */
  sampleValues: unknown[];
  /** True when every sampled cell in this column is empty */
  isAlwaysEmpty: boolean;
}

export interface SheetSchema {
  sheetName: string;
  /** Total row count including the header row */
  totalRows: number;
  /** Number of columns that have a non-empty header */
  totalColumns: number;
  /** 0-based index of the row treated as the header */
  headerRowIndex: number;
  columns: ColumnSchema[];
}

export type InferredType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "empty"
  | "mixed";
