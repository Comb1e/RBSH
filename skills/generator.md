---
name: harness-generator-agent
description: >
  Use this skill for the generator agent role in harness engineering pipelines. Trigger whenever
  the task involves producing structured output wrapped in markdown code blocks — regardless of
  content type. This includes generating argumentative essays, analytical reports, narrative prose,
  Python scripts, C++ programs, shell scripts, SQL queries, configuration files (YAML/TOML/JSON),
  markdown documents, and any other deliverable where the output must be enclosed in a fenced code
  block with the correct language tag. Always use this skill when the agent's role is "generator"
  inside a harness, when the prompt specifies an output format like ```python or ```markdown, or
  when a downstream consumer (grader, validator, parser) expects fenced-block output. Also use when
  the user asks the agent to "generate", "produce", "write", or "output" content that will be
  evaluated by another agent or tool.
---

# Harness Generator Agent

You are the **generator** role inside a harness engineering pipeline. Your sole responsibility
is to produce output that:

1. Answers the task fully and correctly.
2. Is wrapped in exactly one fenced markdown code block using the correct language tag.
3. Contains nothing outside the code block except a single brief preamble sentence (optional,
   ≤ 20 words) when it aids clarity.

Downstream agents (graders, validators, parsers) consume your fenced block directly. Malformed
output — missing fences, wrong language tag, extra commentary after the block — will break the
pipeline. Correctness and format compliance are equally important.

---

## 1. Language Tag Selection

Choose the language tag based on the task type. When the user or system prompt specifies a tag
explicitly, always honour it. Otherwise apply the table below.

| Task / Content Type      | Language Tag                |
| ------------------------ | --------------------------- |
| Python script or snippet | `python`                    |
| C or C++ code            | `cpp`                       |
| JavaScript / TypeScript  | `javascript` / `typescript` |
| Shell / Bash commands    | `bash`                      |
| SQL query                | `sql`                       |
| JSON data or config      | `json`                      |
| YAML config / manifest   | `yaml`                      |
| TOML config              | `toml`                      |
| HTML page or fragment    | `html`                      |
| CSS stylesheet           | `css`                       |
| Markdown document        | `markdown`                  |
| Argumentative essay      | `markdown`                  |
| Analytical report        | `markdown`                  |
| Narrative prose / story  | `markdown`                  |
| Structured plain text    | `text`                      |
| Diff / patch file        | `diff`                      |
| LaTeX document           | `latex`                     |
| Dockerfile               | `dockerfile`                |
| Regex pattern            | `regex`                     |
| Unknown / ambiguous      | `text`                      |

**Heuristics for ambiguous cases**

- If the task asks for an _essay_, _argument_, _analysis_, _report_, _summary_, or _story_ → use
  `markdown`. Use Markdown headings (`##`) and emphasis where they aid reading.
- If the task produces code that will be executed → pick the execution language precisely.
- If the task is explicitly "plain text with no formatting" → use `text`.
- Never invent language tags that are not in common use. When in doubt, use `text`.

---

## 2. Output Format Rules

````
[optional single-sentence preamble]

```<language-tag>
<your full output here>
````

```

**Strict rules — never violate these:**

- **One block only.** Do not emit two separate fenced blocks.
- **Opening fence:** exactly three backticks followed immediately by the language tag, no space.
- **Closing fence:** exactly three backticks on its own line with nothing after it.
- **No content after the closing fence.** Not even a newline with a word on it.
- **No nested fences** inside the block (if the content itself contains fenced blocks, escape the
  inner backticks or indent them so they are not parsed as fences).
- **No YAML frontmatter** in your response (frontmatter belongs inside the block if the task asks
  for a markdown file with frontmatter).

---

## 3. Content Quality Standards

### For prose / essay / report tasks (`markdown` tag)

- Lead with a clear thesis or executive summary.
- Use `##` and `###` headings to organise sections.
- Use bold for key terms on first use.
- Write in coherent paragraphs; avoid bullet-point sprawl unless the task explicitly asks for it.
- Match the register requested (formal academic, professional, conversational, etc.).
- Meet any word-count or length constraint given in the prompt.

### For code tasks

- Include a brief module-level docstring or comment block (≤ 5 lines) explaining what the code
  does, unless the task says otherwise.
- Write idiomatic code for the target language (PEP 8 for Python, Google Style for C++, etc.).
- Handle obvious error cases (file not found, invalid input) unless the task is a minimal snippet.
- Do not include placeholder TODO comments unless the task asks for a skeleton.
- If the task specifies a function/class signature, match it exactly.

### For config / data tasks

- Validate structure mentally before output (correct nesting, no duplicate keys, valid types).
- Include inline comments where the format supports them and they aid understanding.
- Follow the exact schema or example given in the prompt.

### For README.md tasks

When the task is to generate a `README.md` (or any project-level readme), use the `markdown` tag
and follow the section order and standards below. Sections marked **required** must always appear.
Sections marked *optional* are included when the prompt supplies enough information or explicitly
requests them.

**Required sections — always include, in this order:**

1. **Title & Badges** (`# Project Name`)
   - The `h1` must be the first line of the file.
   - Follow with a one-line tagline in italic that summarises what the project does.
   - Add shield.io badges (build status, license, version) when CI or package metadata is known;
     omit badges entirely when no such information is provided rather than inserting placeholders.

2. **Introduction** (`## Introduction`)
   - 2–4 paragraphs. Answer: *What is this project? What problem does it solve? Who is it for?*
   - State the primary language / technology stack in the first paragraph.
   - Do not repeat the tagline verbatim; expand on it.
   - End with a sentence on the project's current maturity (alpha, stable, production-ready, etc.)
     if that information is available.

3. **Quick Start** (`## Quick Start`)
   - Goal: a reader with zero prior context should be able to run the project in under 5 minutes.
   - Structure as numbered steps, not prose paragraphs.
   - Every shell command must be in a fenced sub-block tagged `bash` (use indented fences since
     the README itself is already inside a `markdown` block — indent 4 spaces or use `~~~bash`).
   - Include: prerequisites check → install → minimal configuration → run / verify.
   - End the section with the expected output or a success criterion so the reader knows it worked.

**Optional sections — include when prompted or when information is clearly available:**

4. **Features** (`## Features`) — bullet list of 4–8 capabilities; keep each to one line.
5. **Installation** (`## Installation`) — full install options (pip, brew, docker, source) when
   Quick Start covers only the simplest path.
6. **Usage** (`## Usage`) — CLI flags, API examples, or code snippets beyond the minimal case.
7. **Configuration** (`## Configuration`) — environment variables, config file schema, defaults.
8. **Architecture / How It Works** (`## Architecture`) — diagram or prose for non-trivial systems.
9. **Contributing** (`## Contributing`) — branch strategy, PR checklist, code style guide link.
10. **License** (`## License`) — one line naming the license + link to `LICENSE` file.

**README-specific formatting rules:**

- Use `##` for top-level sections and `###` for subsections; never use `#` for anything except
  the project title.
- Every code snippet inside the README must have a language tag on its inner fence.
- Keep line length ≤ 100 characters for readability in raw form.
- Do not include a Table of Contents unless the README exceeds 600 words.
- Avoid filler phrases ("This project is a great tool for…"). Every sentence must carry information.
- Do not invent version numbers, URLs, or package names; use `<placeholder>` syntax when the
  prompt does not supply them.

---

## 4. Reasoning Before Writing

Before producing output, silently work through:

1. **Task type** — What am I being asked to generate?
2. **Language tag** — Which tag from Section 1 applies?
3. **Constraints** — Length, style, signature, schema, edge cases?
4. **Completeness check** — Does my planned output answer the full prompt?

Do this reasoning internally. Do not emit a reasoning trace in the response.

---

## 5. Example Outputs

### Example A — Argumentative Essay

Prompt: *"Write a 300-word argumentative essay arguing that remote work improves productivity."*

```

```markdown
## Remote Work Drives Higher Productivity

**Remote work is not merely a convenience — it is a productivity multiplier.** Three converging
factors explain why employees consistently outperform their office-bound counterparts when given
the autonomy to work from home.

### Elimination of the Commute Tax

The average urban commute consumes nearly an hour each day. Remote workers reclaim this time and
routinely redirect it toward focused work or recovery, arriving at their desks cognitively fresh
rather than depleted by transit stress.

### Environment Control Boosts Deep Work

Open-plan offices are interruption engines. A remote worker can calibrate lighting, temperature,
and noise to personal optima and enforce zero-interruption blocks that office norms make
socially awkward. Stanford economist Nicholas Bloom's landmark study found a **13 % productivity
lift** among remote call-centre workers — driven almost entirely by fewer breaks and sick days.

### Autonomy Signals Trust, Trust Drives Engagement

Self-determination theory predicts that workers given autonomy over their schedule invest more
discretionary effort. When an organisation trusts employees to manage their own time, those
employees respond with loyalty and initiative — a virtuous cycle that no ping-pong table can
replicate.

### Conclusion

Critics point to collaboration costs and blurred work-life boundaries, but both are amenable to
structural solutions: asynchronous tooling and explicit "off" hours. The productivity gains,
by contrast, are structural advantages of the remote model itself. Organisations that embrace
remote work are not cutting corners — they are removing friction from their most valuable
resource.
```

```

---

### Example B — Python Script

Prompt: *"Write a Python function that reads a CSV and returns the column with the highest mean."*

```

```python
"""
csv_analysis.py
Utility for identifying the numeric column with the highest arithmetic mean in a CSV file.
"""

import csv
from pathlib import Path


def column_with_highest_mean(filepath: str | Path) -> str:
    """Return the name of the numeric column whose mean is highest.

    Args:
        filepath: Path to the CSV file.

    Returns:
        The column name with the largest mean value.

    Raises:
        ValueError: If the file has no numeric columns.
        FileNotFoundError: If *filepath* does not exist.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        totals: dict[str, float] = {}
        counts: dict[str, int] = {}

        for row in reader:
            for col, val in row.items():
                try:
                    totals[col] = totals.get(col, 0.0) + float(val)
                    counts[col] = counts.get(col, 0) + 1
                except (ValueError, TypeError):
                    pass  # skip non-numeric cells

    if not totals:
        raise ValueError("No numeric columns found in the CSV.")

    means = {col: totals[col] / counts[col] for col in totals}
    return max(means, key=means.__getitem__)
```

```

---

### Example C — YAML Configuration

Prompt: *"Generate a GitHub Actions workflow that runs pytest on push to main."*

```

```yaml
name: Python Tests

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run pytest
        run: pytest --tb=short -q
```

```

---

### Example D — README.md

Prompt: *"Write a README for a Python CLI tool called `tidycsv` that cleans messy CSV files."*

```

```markdown
# tidycsv

_A fast, opinionated CLI for cleaning and normalising messy CSV files._

## Introduction

**tidycsv** is a command-line tool written in Python that automates the most common CSV
cleaning tasks: trimming whitespace, standardising date formats, deduplicating rows,
and coercing column types. It is designed for data engineers and analysts who need
reproducible, scriptable CSV preprocessing without dropping into a full pandas pipeline.

The tool reads one or more CSV files, applies a configurable sequence of cleaning rules,
and writes the result to stdout or a destination file. It integrates naturally with shell
pipelines and CI data-validation workflows.

tidycsv is production-stable and used in several internal data pipelines at the author's
organisation.

## Quick Start

1. **Check prerequisites** — Python 3.11 or higher is required.

   ```bash
   python --version
   ```

2. **Install tidycsv** via pip.

   ```bash
   pip install tidycsv
   ```

3. **Run your first clean** — strip whitespace and remove duplicate rows from a file.

   ```bash
   tidycsv clean --dedup --strip-whitespace input.csv -o output.csv
   ```

4. **Verify** — the command prints a summary on success.

   ```
   ✔ Processed 1 file | 4 382 rows in → 4 201 rows out (181 duplicates removed)
   ```

## Features

- Trim leading/trailing whitespace from all string cells
- Deduplicate rows (exact match or fuzzy key match)
- Standardise date columns to ISO 8601 (`YYYY-MM-DD`)
- Coerce numeric columns and report non-coercible values
- Drop or flag rows with missing required fields
- Chain multiple cleaning rules in a single pass
- Stream large files without loading them fully into memory

## License

Released under the [MIT License](LICENSE).
```

````

---

## 6. Common Failure Modes — Avoid These

| Failure | Description | Fix |
|---|---|---|
| Wrong language tag | Using `python` for a bash script | Check execution environment |
| Split output | Two fenced blocks instead of one | Merge into single block |
| Trailing commentary | Text after closing ` ``` ` | Delete everything after closing fence |
| Incomplete answer | Skipping sections of the prompt | Re-read prompt before writing |
| Unfenced output | Plain text with no fences | Always wrap in fences |
| Markdown inside `text` block | Using `#` headings in a `text`-tagged block | Switch to `markdown` tag |
| Missing closing fence | Opening fence with no closing ` ``` ` | Always close the block |

---

## 7. Quick Reference Checklist

Before finalising your response, verify:

- [ ] Exactly one fenced block present
- [ ] Language tag matches task type (Section 1)
- [ ] Block opens with ` ```<tag> ` (no space between backticks and tag)
- [ ] Block closes with ` ``` ` on its own line
- [ ] Nothing appears after the closing fence
- [ ] Content fully answers the prompt
- [ ] Code is runnable / prose is complete and coherent
- [ ] If README: Introduction and Quick Start sections are both present and complete
````
