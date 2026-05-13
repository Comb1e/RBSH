════════════════════════════════════════
OUTPUT FORMAT — FOLLOW THIS EXACTLY
════════════════════════════════════════

Your entire response MUST be enclosed in <PLAN_DOCUMENT> … </PLAN_DOCUMENT> tags.
Inside those tags you must produce:

1. A <FILENAME> tag containing ONLY a kebab-case filename ending in ".md".
   Example: <FILENAME>real-time-chat-app-plan.md</FILENAME>

2. A <MARKDOWN> tag containing the full Markdown document with these EXACT
   top-level sections in this EXACT order (use the heading text verbatim):

   # Project Plan: {Project Title}

   ## 1. Project Overview

   ## 2. Technical Stack

   ## 3. Module Division

   ## 4. Development Timeline

════════════════════════════════════════
SCHEMA COMPREHENSION — DO THIS FIRST
════════════════════════════════════════

Before writing a single line of the plan, thoroughly analyze the Input Schema
provided in the prompt. The schema describes Excel sheets, their columns,
inferred types, and cross-sheet relationships. Your plan must be grounded in
this data — every module, technology choice, and timeline phase must reflect
the actual data structures you are given.

STEP 1 — Inventory the sheets
─────────────────────────────
Read every sheet block in the schema. For each sheet, note:
  • sheetName — the canonical name (use this verbatim in the plan)
  • Columns — headerName, inferredType, and whether isAlwaysEmpty
  • The sheet's apparent role (FACT, DIMENSION, CONFIG, LOOKUP, OUTPUT)
  • Column groups — repeated columns following a pattern (e.g. Bus1…Bus25)

If a sheet has zero columns or all columns are isAlwaysEmpty, note that
explicitly — modules dealing with that sheet must handle emptiness.

STEP 2 — Understand each column
────────────────────────────────
For every non-empty column, determine:
  • What real-world quantity it represents (from headerName and context)
  • Whether it's an identifier (KEY), a measurement (INPUT), a filter
    criterion (FILTER), a label (LABEL), or unused (IRRELEVANT)
  • Any caveats: mixed types, missing data, ambiguous meaning

STEP 3 — Trace cross-sheet relationships
─────────────────────────────────────────
  • Columns with the same or similar headerName across sheets are likely
    join keys — note which sheets they connect
  • A column that is a subset of another sheet's column needs LEFT JOIN
  • Parent-child sheet relationships define data flow direction

STEP 4 — Let comprehension drive the plan
──────────────────────────────────────────
Every section of the plan must be informed by the schema analysis:

  Project Overview: Mention actual sheet names. State what data the
  project operates on. The key features should reference real columns.

  Technical Stack: Choose technologies appropriate for the data scale
  (number of sheets × rows), types (dates, numbers, strings), and
  complexity (cross-sheet relationships, column groups).

  Module Division: Each module should correspond to a distinct data
  processing stage grounded in the schema. Module names should reference
  the sheets they operate on. The "Depends On" field must reflect the
  cross-sheet relationship flow identified in Step 3.

  Development Timeline: Order phases based on data dependencies.
  Modules that produce intermediate data come before consumers.

If the schema is empty or no input files have been loaded, state this
in the Project Overview and plan generically. Do not invent sheet names.

SECTION REQUIREMENTS
────────────────────
• "## 1. Project Overview" - A concise paragraph describing the project goals and target users. - A bullet list of the top 5–8 key features.

• "## 2. Technical Stack" - A Markdown table with EXACTLY these columns (header row required):
| Category | Technology | Version/Notes | Justification | - Cover at minimum: Frontend, Backend, Database, Auth, DevOps/CI-CD, Testing.

• "## 3. Module Division" - One ### sub-heading per module. - Each module block must contain exactly these labelled items:
**Responsibility**: one sentence
**Key Components**: bulleted list of files / classes / sub-systems
**Depends On**: comma-separated module names, or "None" - Include at minimum 4 modules.

• "## 4. Development Timeline" - A Markdown table with columns: | Phase | Scope | Deliverables |

HARD RULES
──────────
• Do NOT output any text outside <PLAN_DOCUMENT> … </PLAN_DOCUMENT>.
• Do NOT wrap the Markdown in a code-fence inside <MARKDOWN>.
• Every section header listed above is REQUIRED — never omit one.
• If you genuinely cannot populate a section, write a brief placeholder
  and explain why — but never remove the header.
• Ground every claim in the actual input schema. Do not invent sheet
  names, column names, or relationships that are not present.

COUNTER-EXAMPLE — do NOT do this:
Here is the plan: <PLAN_DOCUMENT>…</PLAN_DOCUMENT>
(extra text before/after the envelope is forbidden)
