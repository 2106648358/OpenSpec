# Capability Markers and Spec-Code Traceability Tasks

## 1. Schema and Templates

- [x] 1.1 Create `schemas/spec-driven-traceable/schema.yaml` by copying the `spec-driven` artifact flow and adding a `traceability` artifact that generates `tasks/traceability.json`.
- [x] 1.2 Create `schemas/spec-driven-traceable/templates/` with proposal, specs, design, tasks, spec, and traceability templates aligned with the new schema.
- [x] 1.3 Update the traceable tasks template so agents produce `tasks/traceability.json` after implementation work is complete.
- [x] 1.4 Verify `openspec schema list` and schema loading paths can discover `spec-driven-traceable` without changes to existing `spec-driven` behavior.

## 2. Capability Metadata

- [x] 2.1 Add a reusable `CapabilityIdSchema` in `src/core/change-metadata/schema.ts` with `area` and `area/sub-area` validation.
- [x] 2.2 Extend `ChangeMetadataSchema` with optional `provides`, `requires`, `touches`, and `dependsOn` fields.
- [x] 2.3 Validate `dependsOn` values with the existing kebab-case change ID rules.
- [x] 2.4 Add unit tests for valid and invalid capability marker metadata.

## 3. Traceability Data Model

- [x] 3.1 Create `src/core/traceability/schema.ts` with Zod schemas for code locations, per-change traceability, mappings, and cumulative index files.
- [x] 3.2 Export TypeScript types for `CodeLocation`, `TraceabilityMapping`, `ChangeTraceability`, and `TraceabilityIndex`.
- [x] 3.3 Implement schema rules for `formatVersion`, `createdAt`, `span`, `line`, mapping `type`, and non-empty `codeLocations`.
- [x] 3.4 Add unit tests for schema defaults, invalid JSON shapes, span ordering, and required fields.

## 4. Traceability Validation

- [x] 4.1 Create `src/core/traceability/paths.ts` to resolve `tasks/traceability.json` and `openspec/.traceability/index.json` paths.
- [x] 4.2 Create `src/core/traceability/validation.ts` with `TraceabilityValidationError` and stable error codes.
- [x] 4.3 Validate that traceability `change` matches the active change name during archive.
- [x] 4.4 Validate duplicate mapping keys using `(capability, requirement, type)`.
- [x] 4.5 Validate mapping type consistency against `.openspec.yaml` `provides` and `touches` markers.
- [x] 4.6 Validate code location file paths are relative and stay inside the project root.
- [x] 4.7 Add unit tests for missing files, marker mismatches, duplicate mappings, and unsafe paths.

## 5. Traceability Merge Engine

- [x] 5.1 Create `src/core/traceability/merge.ts` with pure merge functions for forward and reverse indexes.
- [x] 5.2 Implement `provides` merge behavior to fully replace `forward[capability][requirement].current`.
- [x] 5.3 Implement reverse reference cleanup for replaced `provides` mappings.
- [x] 5.4 Implement `touch` merge behavior that appends reverse references without changing forward current.
- [x] 5.5 Dedupe code locations by `file + symbol + line` while preserving the first span value.
- [x] 5.6 Sort output keys and `implements` arrays for stable `index.json` diffs.
- [x] 5.7 Add unit tests for replacement, cleanup, touch-only references, duplicate locations, and stable ordering.

## 6. Traceability Public API

- [x] 6.1 Create `src/core/traceability/index.ts` and export `mergeTraceabilityForArchive`.
- [x] 6.2 Implement index loading with empty-index creation when `.traceability/index.json` does not exist.
- [x] 6.3 Validate existing index structure before merge and merged index structure before write.
- [x] 6.4 Write index updates via a temporary file and atomic rename.
- [x] 6.5 Return `TraceabilityMergeResult` with `merged`, `mappingCount`, and `indexPath`.

## 7. Archive Integration

- [x] 7.1 Read change metadata in `src/core/archive.ts` before the final move to archive.
- [x] 7.2 Run traceability merge only when metadata schema is `spec-driven-traceable`.
- [x] 7.3 Require `tasks/traceability.json` for `spec-driven-traceable` changes.
- [x] 7.4 Keep traceability merge active when `--skip-specs` is used.
- [x] 7.5 Keep structural traceability validation active when `--no-validate` is used.
- [x] 7.6 Extend archive JSON output with traceability merge details.
- [x] 7.7 Convert traceability errors into archive diagnostics in human and JSON modes.
- [x] 7.8 Ensure archive aborts before moving the change directory when traceability merge fails.

## 8. Integration Tests

- [x] 8.1 Add fixtures for a `spec-driven-traceable` change with `provides` mappings.
- [x] 8.2 Test archive creates `openspec/.traceability/index.json` for the first traceable change.
- [x] 8.3 Test a later traceable change replaces the same requirement's forward current mapping.
- [x] 8.4 Test `touch` mappings append reverse references and leave forward current unchanged.
- [x] 8.5 Test `archive --json` reports traceability validation failures through the `status` array.
- [x] 8.6 Test non-traceable `spec-driven` archive behavior remains unchanged.

## 9. Documentation

- [x] 9.1 Update user-facing docs to describe choosing `spec-driven-traceable` for changes that need spec-code traceability.
- [x] 9.2 Document `.openspec.yaml` capability marker fields and examples.
- [x] 9.3 Document `tasks/traceability.json` format and generation expectations.
- [x] 9.4 Document archive-time index merge behavior and `.traceability/index.json` ownership.

## 10. Verification

- [x] 10.1 Run `pnpm run lint` and fix reported issues.
- [x] 10.2 Run `pnpm run test` and fix failing tests.
- [x] 10.3 Run `pnpm run build` and verify the CLI compiles.
- [x] 10.4 Manually archive a traceable fixture change and inspect the generated index.
- [x] 10.5 Manually archive a non-traceable fixture change and verify existing behavior is preserved.
