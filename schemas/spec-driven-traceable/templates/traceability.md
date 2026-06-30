# Traceability — MUST be EXACTLY this format

Create `tasks/traceability.json` as a JSON file with the structure below.

## Required structure

```json
{
  "formatVersion": "1",
  "change": "<change-name-matching-folder>",
  "createdAt": "YYYY-MM-DD",
  "mappings": [
    {
      "capability": "<area> or <area>/<sub-area>",
      "requirement": "<requirement name from spec>",
      "type": "provides",
      "codeLocations": [
        { "file": "src/Example.ts", "symbol": "exampleSymbol" }
      ]
    }
  ]
}
```

## Rules

1. **`mappings` MUST be an array** — each entry is one capability+requirement pair. Do NOT group by type.
2. **`type` is either `"provides"` or `"touch"`** — MUST match `.openspec.yaml`:
   - `provides` → capability listed in `provides:` in `.openspec.yaml`
   - `touch` → capability listed in `touches:` in `.openspec.yaml`
   - Do NOT add mappings for capabilities listed in `requires:` (those are dependency-only)
3. **`codeLocations` is an array of `{file, symbol}` objects** — NOT a flat `files: string[]`. Each entry must have:
   - `file`: relative path from project root
   - `symbol`: the enclosing **function or method name** (NOT class name, NOT file name)
   - `line`: (optional) line number for disambiguation
   - Correct: `"preHandle"`, `"checkSessionTimeout"`, `"SessionManager.refresh"`
   - Wrong: `"ErpWebAuthInterceptor"`, `"auth-interceptor.java"`
4. **Capability IDs use hierarchical format**: `area` or `area/sub-area` (lowercase, hyphen-separated), matching `openspec/specs/<area>/` directory structure.
5. **No extra fields** — do NOT add `schema`, `artifacts`, `implementation`, `description`, `tasks` or any other fields not shown above.

## Example

```json
{
  "formatVersion": "1",
  "change": "add-password-timeout",
  "createdAt": "2026-06-29",
  "mappings": [
    {
      "capability": "auth/session",
      "requirement": "密码登录超时",
      "type": "provides",
      "codeLocations": [
        { "file": "src/auth/session.ts", "symbol": "checkSessionTimeout" },
        { "file": "src/auth/session.ts", "symbol": "SessionManager.refresh" }
      ]
    },
    {
      "capability": "auth/middleware",
      "requirement": "会话超时守卫",
      "type": "touch",
      "codeLocations": [
        { "file": "src/auth/middleware.ts", "symbol": "timeoutGuard" }
      ]
    }
  ]
}
```
