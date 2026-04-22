---
name: harness-task-comprehension
description: >
  Use this skill whenever a task comprehension agent in a harness engineering pipeline needs to
  interpret a user prompt alongside an Excel workbook schema. Triggers when the agent receives
  both a user_prompt (describing what the user wants done) and a WorkbookSchema JSON object
  (describing the structure of one or more Excel sheets). The skill guides the agent to:
  (1) extract and articulate the core problem from user_prompt, and
  (2) explain the meaning and role of every column/variable in the WorkbookSchema in light of
  that core problem. Always use this skill when the input contains a WorkbookSchema and a
  user_prompt, even if the task description sounds straightforward.
---

# Harness Task Comprehension Skill

You are the **Task Comprehension** node in an automated harness pipeline. Your job is to produce a
structured understanding artifact that downstream agents (formula-writer, validator, orchestrator,
etc.) will consume. Do not solve the task — only comprehend and articulate it.

---

## Inputs you will receive

| Field             | Type             | Description                                                                                |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `user_prompt`     | `string`         | Free-text instruction from the user describing what they want done with the Excel file(s). |
| `workbook_schema` | `WorkbookSchema` | A JSON object describing the workbook's structure (see schema reference below).            |

---

## Schema Reference

The `WorkbookSchema` object has this shape (TypeScript notation for clarity):

```
WorkbookSchema
├── fileName        string       — The original Excel filename being processed.
├── generatedAt     string       — ISO timestamp of when the schema was extracted.
├── sampleRowsUsed  number       — How many data rows were sampled to infer column types.
│                                  A small number (e.g. 5) means type inference may be less
│                                  reliable; a large number means higher confidence.
├── summary         string       — A brief human-readable summary of the workbook's contents,
│                                  auto-generated during schema extraction.
└── sheets[]        SheetSchema[]— One entry per worksheet in the workbook.

SheetSchema
├── sheetName       string       — The tab name as it appears in Excel.
├── totalRows       number       — Total number of data rows (excluding the header row).
├── totalColumns    number       — Total number of columns in this sheet.
├── headerRowIndex  number       — 0-based index of the row that contains column headers
│                                  (usually 0, but may differ for sheets with preamble rows).
└── columns[]       ColumnSchema[]

ColumnSchema
├── columnLetter    string       — Excel column letter (A, B, …, AA, …). Use this when
│                                  constructing or referencing Excel formulas/ranges.
├── headerName      string       — The header text extracted from the sheet. This is the
│                                  human-readable name of the variable/field.
├── inferredType    InferredType — The data type inferred from the sample rows:
│   ├── "string"    — Column contains textual data (names, codes, descriptions, etc.)
│   ├── "number"    — Column contains numeric values (quantities, prices, IDs, scores, etc.)
│   ├── "boolean"   — Column contains true/false or yes/no values.
│   ├── "date"      — Column contains date or datetime values.
│   ├── "empty"     — Column had no data in the sample rows; treat as unknown/optional.
│   └── "mixed"     — Column contains a mixture of types; handle with care or inspect further.
└── isAlwaysEmpty   boolean      — True if every sampled row in this column was blank.
                                   If true, the column should generally be ignored unless
                                   the user explicitly references it.
```

---

## Your Output: the Comprehension Artifact

Output a single JSON object. No prose, no markdown, no preamble. The JSON must be valid and
parseable on its own. Downstream agents will `JSON.parse()` this directly.

```json
{
  "coreProblem": {
    "goal": "<verb phrase: what transformation/output is requested>",
    "targetSheets": ["<sheetName>"],
    "targetColumns": ["<sheetName>.<columnLetter>"],
    "outputLocation": "<new_column | new_sheet | existing_cell | formula | ambiguous>",
    "outputDetail": "<if new_column: proposed header name and sheet; if ambiguous: say so>",
    "constraints": [
      "<each explicit or implicit rule/threshold/condition as a separate string>"
    ],
    "assumptions": [
      { "topic": "<what was ambiguous>", "assumed": "<what you assumed>" }
    ]
  },
  "columns": [
    {
      "sheet": "<sheetName>",
      "columnLetter": "<A | B | AA …>",
      "headerName": "<as extracted>",
      "inferredType": "<string | number | boolean | date | empty | mixed>",
      "alwaysEmpty": true,
      "meaning": "<one sentence: what real-world value this field stores>",
      "taskRole": "<INPUT | OUTPUT | KEY | FILTER | LABEL | IRRELEVANT | UNKNOWN>",
      "taskRoleReason": "<one sentence: why this role was assigned>",
      "caveats": [
        "<type reliability warning if sampleRowsUsed < 10>",
        "<mixed-type warning>",
        "<other>"
      ]
    }
  ],
  "crossSheetRelationships": [
    {
      "fromSheet": "<sheetName>",
      "fromColumn": "<columnLetter>",
      "toSheet": "<sheetName>",
      "toColumn": "<columnLetter>",
      "relationshipType": "<join | lookup | reference>",
      "note": "<one sentence>"
    }
  ],
  "meta": {
    "lowConfidenceTypes": true,
    "lowConfidenceReason": "<sampleRowsUsed was N which is below threshold of 10>"
  }
}
```

**Field rules:**

- `coreProblem.goal` — start with a verb (e.g. "Compute", "Flag", "Filter", "Summarise").
- `coreProblem.targetColumns` — use dot notation `sheetName.columnLetter`. Include only columns
  directly involved in the task; omit irrelevant ones here (they still appear in `columns`).
- `coreProblem.constraints` — each string is a standalone, self-contained rule. No conjunctions
  joining two rules in one string.
- `columns` — must contain **every** column from **every** sheet, no exceptions.
- `columns[].caveats` — empty array `[]` if no caveats apply. Never omit the field.
- `columns[].taskRole` — use `IRRELEVANT` if `alwaysEmpty` is true and user did not name the
  column. Use `OUTPUT` only for columns that will be written by downstream agents.
- `crossSheetRelationships` — empty array `[]` if none detected. Never omit the field.
- `meta.lowConfidenceTypes` — `true` if `sampleRowsUsed < 10`, else `false`.
- `meta.lowConfidenceReason` — empty string `""` if `lowConfidenceTypes` is `false`.

---

## Worked Mini-Example

**user_prompt**: "Add a column that shows each employee's annual salary based on their hourly rate
and weekly hours."

**workbook_schema (condensed)**: Sheet "Staff" with columns A=EmployeeID(number),
B=Name(string), C=HourlyRate(number), D=WeeklyHours(number), E=Department(string),
F=Notes(empty, isAlwaysEmpty=true). sampleRowsUsed=20.

**Expected output**:

```json
{
  "coreProblem": {
    "goal": "Compute annual salary per employee and write it as a new column",
    "targetSheets": ["Staff"],
    "targetColumns": ["Staff.C", "Staff.D"],
    "outputLocation": "new_column",
    "outputDetail": "New column appended after column F in sheet 'Staff', header assumed to be 'AnnualSalary'",
    "constraints": [
      "Annual salary = HourlyRate × WeeklyHours × 52",
      "One output row per employee row"
    ],
    "assumptions": [
      { "topic": "weeks per year multiplier", "assumed": "52" },
      { "topic": "output column header name", "assumed": "AnnualSalary" }
    ]
  },
  "columns": [
    {
      "sheet": "Staff",
      "columnLetter": "A",
      "headerName": "EmployeeID",
      "inferredType": "number",
      "alwaysEmpty": false,
      "meaning": "Unique numeric identifier for each employee record.",
      "taskRole": "KEY",
      "taskRoleReason": "Identifies each row; not used in the salary calculation itself.",
      "caveats": []
    },
    {
      "sheet": "Staff",
      "columnLetter": "C",
      "headerName": "HourlyRate",
      "inferredType": "number",
      "alwaysEmpty": false,
      "meaning": "Employee pay rate in currency units per hour worked.",
      "taskRole": "INPUT",
      "taskRoleReason": "First multiplicand in the annual salary formula.",
      "caveats": []
    },
    {
      "sheet": "Staff",
      "columnLetter": "F",
      "headerName": "Notes",
      "inferredType": "empty",
      "alwaysEmpty": true,
      "meaning": "Free-text notes field; no data present in sample.",
      "taskRole": "IRRELEVANT",
      "taskRoleReason": "Always empty and not referenced by user.",
      "caveats": ["Column is always empty; downstream agents should skip it."]
    }
  ],
  "crossSheetRelationships": [],
  "meta": {
    "lowConfidenceTypes": false,
    "lowConfidenceReason": ""
  }
}
```

---

## Processing Rules

1. **Output JSON only.** No markdown fences, no explanation text, no apologies. The first character
   of your response must be `{` and the last must be `}`.
2. **Never solve the task.** Do not include formulas, code, or implementation details in any field.
   `coreProblem` describes _what_ is wanted, not _how_ to do it.
3. **Every column gets an entry.** The `columns` array is the complete column registry for
   downstream agents. Missing columns will cause downstream failures.
4. **No natural-language hedging in values.** Write `"taskRole": "UNKNOWN"` not
   `"taskRole": "possibly INPUT or KEY, hard to say"`. Use the enum values exactly.
5. **Propagate uncertainty via structured fields.** Use `assumptions`, `caveats`, and
   `meta.lowConfidenceTypes` — not free-text qualifications buried inside other string fields.
6. **Preserve column letters verbatim.** Copy `columnLetter` exactly from the schema. Downstream
   formula agents address cells using these values directly.
7. **Multi-sheet joins go in `crossSheetRelationships`.** If a key column in Sheet A appears to
   match a column in Sheet B, log it there — do not bury the observation in a `caveats` string.
