## 1. <!-- Task Group Name -->

- [ ] 1.1 <!-- Task description -->
- [ ] 1.2 <!-- Task description -->

## 2. Traceability

- [ ] 2.1 Create `tasks/traceability.json` with the EXACT format from `traceability.md` template:
  - `mappings` is an array, NOT grouped by type
  - Each mapping has `capability`, `requirement`, `type`, `codeLocations`
  - `codeLocations` is an array of `{file, symbol}` (NOT flat `files: string[]`)
  - Capability IDs use `area` or `area/sub-area` hierarchical format
  - No extra fields like `schema`, `artifacts`, `implementation`
  - Only `provides` and `touch` types — NO `requires` mappings in traceability
