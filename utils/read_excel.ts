/**
 * excel-to-llm-schema.ts
 *
 * Reads an Excel workbook and returns a structured schema that is easy for an
 * LLM to understand. Exposes a typed public API so it can be imported by other
 * modules, while still being runnable as a standalone CLI script.
 *
 * Public API
 * ----------
 *   parseExcelSchema(source, options?)  – main entry point (file path or Buffer)
 *   parseExcelSchemaToFile(...)         – convenience wrapper that also writes JSON
 *
 * CLI usage
 * ---------
 *   npx ts-node excel-to-llm-schema.ts <input.xlsx> [output.json] [--sample <n>]
 *
 * Install dependencies
 * --------------------
 *   npm install xlsx
 *   npm install --save-dev typescript ts-node @types/node
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import {
  ColumnSchema,
  InferredType,
  ParseOptions,
  SheetSchema,
  WorkbookSchema,
} from "@/types/index.js";

// ─── Private helpers ──────────────────────────────────────────────────────────

function columnIndexToLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function inferCellType(value: unknown): Exclude<InferredType, "mixed"> {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value instanceof Date) return "date";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(value)) return "date";
    return "string";
  }
  return "string";
}

function mergeTypes(
  types: Array<Exclude<InferredType, "mixed">>
): InferredType {
  const nonEmpty = types.filter((t) => t !== "empty");
  if (nonEmpty.length === 0) return "empty";
  const unique = new Set(nonEmpty);
  if (unique.size === 1) return nonEmpty[0];
  return "mixed";
}

function truncateValue(value: unknown, maxLength: number): unknown {
  if (typeof value === "string" && value.length > maxLength) {
    return value.slice(0, maxLength) + "…";
  }
  return value;
}

function buildSheetSchema(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  sampleSize: number,
  maxValueLength: number
): SheetSchema {
  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as unknown[][];

  if (aoa.length === 0) {
    return {
      sheetName,
      totalRows: 0,
      totalColumns: 0,
      headerRowIndex: 0,
      columns: [],
    };
  }

  // Find the first non-empty row to use as the header
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(aoa.length, 10); r++) {
    if (aoa[r].some((cell) => cell !== null && cell !== "")) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = aoa[headerRowIndex];
  const dataRows = aoa.slice(headerRowIndex + 1);

  // Find the last non-empty header to avoid phantom columns
  let lastFilledCol = -1;
  for (let c = headerRow.length - 1; c >= 0; c--) {
    if (headerRow[c] !== null && headerRow[c] !== "") {
      lastFilledCol = c;
      break;
    }
  }
  const colCount = lastFilledCol + 1;
  const sampledRows = dataRows.slice(0, sampleSize);

  const columns: ColumnSchema[] = [];
  for (let c = 0; c < colCount; c++) {
    const raw = headerRow[c];
    const headerName =
      raw !== null && raw !== undefined && raw !== ""
        ? String(raw).trim()
        : `(unnamed_col_${columnIndexToLetter(c)})`;

    const cellValues = sampledRows
      .map((row) => (row ? row[c] : null))
      .filter((v) => v !== null && v !== undefined && v !== "");

    const types = sampledRows.map((row) => inferCellType(row ? row[c] : null));

    columns.push({
      columnLetter: columnIndexToLetter(c),
      headerName,
      inferredType: mergeTypes(types),
      isAlwaysEmpty: cellValues.length === 0,
    });
  }

  return {
    sheetName,
    totalRows: aoa.length,
    totalColumns: colCount,
    headerRowIndex,
    columns,
  };
}

function buildSummary(fileName: string, sheets: SheetSchema[]): string {
  const lines = sheets.map((s) => {
    if (s.totalColumns === 0) return `  • "${s.sheetName}" – empty sheet`;
    const cols = s.columns
      .map((c) => `"${c.headerName}" (${c.inferredType})`)
      .join(", ");
    return `  • "${s.sheetName}" – ${s.totalRows - 1} data rows × ${
      s.totalColumns
    } columns: ${cols}`;
  });
  return `File: ${fileName}\nSheets (${sheets.length}):\n${lines.join("\n")}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse an Excel file and return its schema as a structured object.
 *
 * @param source  Absolute or relative path to the .xlsx/.xls file, **or** a
 *                `Buffer` / `Uint8Array` containing the raw file bytes.
 * @param options Optional tuning parameters (see {@link ParseOptions}).
 * @returns       A {@link WorkbookSchema} describing every sheet's structure.
 *
 * @example
 * // From a file path
 * import { parseExcelSchema } from "./excel-to-llm-schema";
 * const schema = parseExcelSchema("./data/report.xlsx", { sampleSize: 20 });
 * console.log(schema.summary);
 *
 * @example
 * // From an uploaded buffer (e.g. Express multipart upload)
 * import { parseExcelSchema } from "./excel-to-llm-schema";
 * app.post("/upload", (req, res) => {
 *   const schema = parseExcelSchema(req.file.buffer, { sampleSize: 5 });
 *   res.json(schema);
 * });
 */
export function parseExcelSchema(
  source: string | Buffer | Uint8Array,
  options: ParseOptions = {}
): WorkbookSchema {
  const sampleSize = options.sampleSize ?? 10;
  const maxValueLength = options.maxValueLength ?? 80;

  let workbook: XLSX.WorkBook;
  let fileName: string;

  if (typeof source === "string") {
    if (!fs.existsSync(source)) {
      throw new Error(`File not found: ${source}`);
    }
    const data = fs.readFileSync(source);
    workbook = XLSX.read(data, { type: "buffer" });
    fileName = path.basename(source);
  } else {
    workbook = XLSX.read(source, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
    });
    fileName = "workbook.xlsx";
  }

  const sheets = workbook.SheetNames.map((name) =>
    buildSheetSchema(workbook.Sheets[name], name, sampleSize, maxValueLength)
  );

  return {
    fileName,
    generatedAt: new Date().toISOString(),
    sampleRowsUsed: sampleSize,
    sheets,
    summary: buildSummary(fileName, sheets),
  };
}

/**
 * Parse an Excel file and write its schema to a JSON file on disk.
 *
 * @param inputPath   Path to the source `.xlsx` file.
 * @param outputPath  Destination `.json` path. Defaults to
 *                    `<inputName>-schema.json` in the same directory.
 * @param options     Optional tuning parameters (see {@link ParseOptions}).
 * @returns           The same {@link WorkbookSchema} that was written to disk.
 *
 * @example
 * import { parseExcelSchemaToFile } from "./excel-to-llm-schema";
 * const schema = parseExcelSchemaToFile("./sales.xlsx", "./output/sales-schema.json");
 * console.log(`Wrote ${schema.sheets.length} sheet(s) to disk`);
 */
export function parseExcelSchemaToFile(
  inputPath: string,
  outputPath?: string,
  options: ParseOptions = {}
): WorkbookSchema {
  const resolvedOutput =
    outputPath ??
    path.join(
      path.dirname(inputPath),
      path.basename(inputPath, path.extname(inputPath)) + "-schema.json"
    );

  const schema = parseExcelSchema(inputPath, options);
  fs.writeFileSync(resolvedOutput, JSON.stringify(schema, null, 2), "utf8");
  return schema;
}

// ─── CLI (only runs when executed directly) ───────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Usage:
  npx ts-node excel-to-llm-schema.ts <input.xlsx> [output.json] [--sample <n>]

Options:
  --sample <n>   Rows to sample per sheet for type inference (default: 10)

Examples:
  npx ts-node excel-to-llm-schema.ts data.xlsx
  npx ts-node excel-to-llm-schema.ts data.xlsx schema.json --sample 20
`);
    process.exit(0);
  }

  let sampleSize = 10;
  const sampleIdx = args.indexOf("--sample");
  if (sampleIdx !== -1 && args[sampleIdx + 1]) {
    sampleSize = parseInt(args[sampleIdx + 1], 10) || 10;
    args.splice(sampleIdx, 2);
  }

  const inputFile = args[0];
  const outputFile = args[1];

  try {
    const schema = parseExcelSchemaToFile(inputFile, outputFile, {
      sampleSize,
    });
    const written = outputFile ?? inputFile.replace(/\.[^.]+$/, "-schema.json");
    console.log(`Written: ${written}`);
    console.log("\nSummary:\n" + schema.summary);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
