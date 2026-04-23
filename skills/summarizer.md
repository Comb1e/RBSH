---
name: summarizer
description: Summarizer's working standards.
---

## Critical Requirement (VERY IMPORTANT)

- Each file MUST be analyzed independently.
- DO NOT merge APIs, variables, or classes across files.
- DO NOT place all APIs into a global list.
- Each file must have its own isolated scope.
- Relationships MUST remain within the same file (no cross-file linking unless explicitly stated).
- **Local variables inside functions MUST be excluded from the output entirely. Only global variables and class-member variables are relevant.**

---

## Input

You will receive multiple files in the following format:

```json
[
  {
    "relative_path": "/path/to/file1.py",
    "code": "..."
  },
  {
    "relative_path": "/path/to/file2.py",
    "code": "..."
  }
]
```

---

## Objectives (Per File)

For EACH file, extract:

### 1. File Metadata

- file_name
- relative_path
- summary

---

### 2. APIs / Functions

- name
- description
- parameters (name, type, description)
- returns (type, description)
- visibility
- class _(optional — omit this field entirely if the function is not part of a class)_

> **Note:** Do NOT extract or list any local variables declared inside function bodies. Only the function signature and behavior matter here.

---

### 3. Variables / Constants

Only extract variables with the following scopes:

- `global` — module-level variables or constants
- `class_member` — instance or class-level properties

**EXCLUDE all `local` scoped variables** (i.e., variables declared inside a function or method body).

Fields to capture per variable:

- name
- type
- initial_value
- scope (`global` or `class_member` only)
- description

---

### 4. Classes

- name
- description
- properties
- methods

---

### 5. Dependencies

- module
- symbols
- purpose

---

### 6. Relationships (STRICTLY WITHIN FILE)

- function_calls
- variable_usage

> **Note:** `variable_usage` should only reference global or class-member variables. Do NOT include local variables from function bodies.

---

## Output Format

Return ONLY valid JSON. No explanation.

```json
{
  "files": [
    {
      "file": {
        "file_name": "",
        "relative_path": "",
        "summary": ""
      },
      "apis": [],
      "variables": [],
      "classes": [],
      "dependencies": [],
      "relationships": {
        "function_calls": [],
        "variable_usage": []
      }
    }
  ]
}
```

---

## Rules

- Each file must produce ONE object inside "files".
- Never mix content between files.
- If two files have functions with the same name, keep them separate.
- Do NOT infer cross-file calls unless explicitly visible in the same file.
- Use "unknown" for missing types.
- Omit optional fields entirely when they have no value — do not set them to null.
- Empty sections must be [].
- Be concise but precise.
- **NEVER include local variables (scope: "local") anywhere in the output — not in `variables`, not in `relationships.variable_usage`, not anywhere.**

---

## Optional (Advanced Behavior)

If imports reference another file in the input:

- You may note the dependency in "dependencies"
- BUT DO NOT merge or inline its APIs

---
