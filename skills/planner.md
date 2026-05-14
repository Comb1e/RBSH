════════════════════════════════════════
OUTPUT FORMAT — FOLLOW THIS EXACTLY
════════════════════════════════════════

Your entire response MUST be enclosed in <PLAN_DOCUMENT> … </PLAN_DOCUMENT> tags.
Inside those tags you must produce:

1. A <MARKDOWN> tag containing the full Markdown document with these EXACT
   top-level sections in this EXACT order (use the heading text verbatim):

   # Project Plan: {Project Title}

   ## 1. Project Overview

   ## 2. Technical Stack

   ## 3. Module Division

   ## 4. Development Timeline

   ## 5. Implementation Order

════════════════════════════════════════
SCHEMA COMPREHENSION — DO THIS FIRST
════════════════════════════════════════

Before writing a single line of the plan, apply the comprehension methodology
(see comprehension skill) to thoroughly analyze the Input Schema. Classify
each sheet by role (FACT/DIMENSION/CONFIG/LOOKUP/OUTPUT), assign task roles
to every column (INPUT/OUTPUT/KEY/FILTER/LABEL/IRRELEVANT/UNKNOWN), detect
cross-sheet relationships, identify column groups, and note all caveats.

Then let that comprehension drive every plan section:
  • Project Overview — reference actual sheet names and key columns
  • Technical Stack — match data scale and types
  • Module Division — one module per data processing stage; Depends On
    must mirror the cross-sheet relationship flow
  • Development Timeline — order phases by data dependencies
  • Implementation Order — derive file list from Key Components, ordered
    by dependency (utility files first, entry point near end, README last)

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
One module must be the unified entry point (e.g. `main.py`, `main.ts`) that ties all
other modules together (see Project Requirements).

• "## 4. Development Timeline" - A Markdown table with columns: | Phase | Scope | Deliverables |
The final phase MUST include `README.md` as a deliverable.

• "## 5. Implementation Order" - A numbered list of concrete files to create,
  in dependency order. Each entry is:
  `<number>. \`relative/path/filename\` — one-sentence description of what this file does`
  Rules:
  - Every file listed in any module's Key Components must appear here.
  - The unified entry point and README.md must follow the ordering rules in Project Requirements.
  - The second-to-last item must be a final output or summary file (e.g.
    `output/final_report.md`) that consolidates results. The harness
    displays this as FINAL OUTPUT on the console.
  - Dependency order is strict: if file B imports file A, A must come before B.
  - Minimum 4 items. If the project is trivial, list at least the entry point,
    one supporting module, a final output, and README.md.

HARD RULES
──────────
• Do NOT output any text outside <PLAN_DOCUMENT> … </PLAN_DOCUMENT>.
• Do NOT wrap the Markdown in a code-fence inside <MARKDOWN>.
• Every section header listed above is REQUIRED — never omit one.
• If you genuinely cannot populate a section, write a brief placeholder
  and explain why — but never remove the header.
• Ground every claim in the actual input schema. Do not invent sheet
  names, column names, or relationships that are not present.
• The Implementation Order is the definitive execution sequence for the
  harness. Every file to be created must appear here. Order is binding.

PROJECT REQUIREMENTS
────────────────────
These apply to every project regardless of domain:

1. UNIFIED ENTRY POINT — Every project must have a single calling program
   (e.g. `main.py`, `main.ts`, `app.js`) that serves as the sole entry
   point. This program imports and orchestrates all other modules. There
   must be exactly one such entry point; do not scatter invocation across
   multiple standalone scripts.

2. README — Every project must include a `README.md` at the project root.
   The README must contain at minimum: project title and one-line
   description, quick-start instructions (how to install dependencies and
   run the entry point), and a brief description of the input/output.
   The README phase must appear as the final item in the Development
   Timeline.

COUNTER-EXAMPLE — do NOT do this:
Here is the plan: <PLAN_DOCUMENT>…</PLAN_DOCUMENT>
(extra text before/after the envelope is forbidden)
