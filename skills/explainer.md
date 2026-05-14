---
name: excel-schema-explainer
description: >
  Use this skill when a developer needs to understand the structure, meaning, and relationships
  of an Excel workbook's columns and sheets. Triggers when a user uploads or describes a multi-sheet
  Excel file and asks you to explain its schema, document column meanings, classify sheet roles,
  or identify cross-sheet relationships. Also use when asked to annotate columns with types, roles
  (INPUT/OUTPUT/KEY/FILTER/LABEL/IRRELEVANT/UNKNOWN), or caveats, or to infer a project name from
  the data. Do NOT use for creating, editing, or transforming Excel files — use the xlsx skill instead.
---

# Excel Schema Explainer

You are explaining input data to a developer. The instructions below govern how to read
a multi-sheet Excel workbook and produce a structured data dictionary.

---

## Your task

For each sheet, produce:

1. **Sheet-level classification** — one of:

   - `FACT` — transactional or event-level records
   - `DIMENSION` — descriptive attributes about entities (people, products, locations…)
   - `CONFIG` — parameters, settings, thresholds
   - `LOOKUP` — code/value mapping tables
   - `OUTPUT` — derived or computed results

2. **Column-level table** — for every column, fill in:

   | Column           | Type                                     | Meaning                 | Role            | Caveats                           |
   | ---------------- | ---------------------------------------- | ----------------------- | --------------- | --------------------------------- |
   | `` `col_name` `` | string / number / date / boolean / mixed | business-domain meaning | see roles below | warnings, edge cases, nullability |

   **Roles:**

   - `KEY` — unique identifier or join key
   - `INPUT` — raw data / driver
   - `OUTPUT` — computed or derived value
   - `FILTER` — used to segment or restrict rows
   - `LABEL` — human-readable display field
   - `IRRELEVANT` — administrative, internal, or unused
   - `UNKNOWN` — cannot determine without more context

3. **Cross-sheet relationships** — a plain-English description of how sheets connect
   (e.g., "Sheet B's `employee_id` is a foreign key into Sheet A's `id` column").

---

## Critical rule: partial coverage across sheets is legitimate

Sheets in the same workbook do **not** need to cover the same rows one-to-one.
A sheet may contain the full universe of records while another sheet provides
in-depth detail for only a subset of them. This is **normal and correct** — do NOT
treat missing rows as a data quality issue unless there is specific evidence of an error.

When you identify cross-sheet relationships, always note whether the join is:

- **1-to-1** — every key in sheet A has exactly one match in sheet B
- **1-to-many** — one key in A matches multiple rows in B
- **partial** — only a subset of keys in A appear in B (this is expected and valid)

---

## Column name handling

Column names are shown in backticks and are **mechanically extracted identifiers**.

- Do **NOT** modify, retype, translate, or reformat them.
- Treat them as opaque strings, not prose.
- If a column name is ambiguous, reflect the ambiguity in the Meaning and add a note in Caveats.

---

## Project name

If the user does not supply a project name, infer one from the workbook content and
output it on the **very first line** of your response in this exact format:

```
<PROJECT_NAME>the_snake_case_name</PROJECT_NAME>
```

---

## Output format

Structure your response as follows (repeat for each sheet):

```
### Sheet: <SheetName>
**Role:** <FACT | DIMENSION | CONFIG | LOOKUP | OUTPUT>
**Summary:** one or two sentences describing what this sheet represents.

| Column | Type | Meaning | Role | Caveats |
|--------|------|---------|------|---------|
| `col` | … | … | … | … |

```

After all sheets, add:

```
### Cross-Sheet Relationships
- <plain-English description of each link, including join cardinality>
```

---

## Tone and constraints

- Write for a developer audience — precise, terse, no marketing language.
- Do **not** write code.
- Do **not** make up data that isn't in the source; mark gaps as `UNKNOWN`.
- If a column's role is unclear, prefer `UNKNOWN` over a confident wrong guess.
- Flag columns that look like they could be either `KEY` or `LABEL` (e.g., a name field
  that might serve as a display label rather than a join key) — note both possibilities
  in Caveats.
