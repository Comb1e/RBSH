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

COUNTER-EXAMPLE — do NOT do this:
Here is the plan: <PLAN_DOCUMENT>…</PLAN_DOCUMENT>
(extra text before/after the envelope is forbidden)
