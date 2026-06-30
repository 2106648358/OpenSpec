import { promises as fs } from 'fs';
import type { ChangeMetadata } from '../change-metadata/schema.js';
import { ChangeTraceabilitySchema, TraceabilityIndexSchema, type ChangeTraceability, type TraceabilityIndex } from './schema.js';
import { getChangeTraceabilityPath, isSafeRelativeFilePath } from './paths.js';

export type TraceabilityErrorCode =
  | 'traceability_missing'
  | 'traceability_invalid_json'
  | 'traceability_schema_invalid'
  | 'traceability_change_mismatch'
  | 'traceability_duplicate_mapping'
  | 'traceability_marker_mismatch'
  | 'traceability_index_invalid';

export class TraceabilityValidationError extends Error {
  constructor(
    public readonly code: TraceabilityErrorCode,
    message: string,
    public readonly fix?: string
  ) {
    super(message);
    this.name = 'TraceabilityValidationError';
  }
}

export function isTraceabilityValidationError(error: unknown): error is TraceabilityValidationError {
  return error instanceof TraceabilityValidationError;
}

export async function readChangeTraceability(changeDir: string): Promise<ChangeTraceability> {
  const traceabilityPath = getChangeTraceabilityPath(changeDir);
  let content: string;

  try {
    content = await fs.readFile(traceabilityPath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new TraceabilityValidationError(
        'traceability_missing',
        "Traceability file is required for schema 'spec-driven-traceable'.",
        'Create tasks/traceability.json or use a non-traceable schema.'
      );
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TraceabilityValidationError(
      'traceability_invalid_json',
      `Invalid traceability JSON: ${message}`,
      'Fix tasks/traceability.json so it is valid JSON.'
    );
  }

  const result = ChangeTraceabilitySchema.safeParse(parsed);
  if (!result.success) {
    throw new TraceabilityValidationError(
      'traceability_schema_invalid',
      `Invalid traceability schema: ${result.error.message}`,
      'Update tasks/traceability.json to match the traceability format.'
    );
  }

  return result.data;
}

export function validateChangeTraceability(
  traceability: ChangeTraceability,
  changeName: string,
  metadata: ChangeMetadata
): void {
  if (traceability.change !== changeName) {
    throw new TraceabilityValidationError(
      'traceability_change_mismatch',
      `Traceability change '${traceability.change}' does not match archived change '${changeName}'.`,
      'Set the traceability change field to the archived change name.'
    );
  }

  const seen = new Set<string>();
  const provides = new Set(metadata.provides ?? []);
  const touches = new Set(metadata.touches ?? []);

  for (const mapping of traceability.mappings) {
    const key = `${mapping.capability}\0${mapping.requirement}\0${mapping.type}`;
    if (seen.has(key)) {
      throw new TraceabilityValidationError(
        'traceability_duplicate_mapping',
        `Duplicate traceability mapping for '${mapping.capability}/${mapping.requirement}' with type '${mapping.type}'.`,
        'Merge duplicate mappings into one entry.'
      );
    }
    seen.add(key);

    if (mapping.type === 'provides' && !provides.has(mapping.capability)) {
      throw new TraceabilityValidationError(
        'traceability_marker_mismatch',
        `Mapping '${mapping.capability}' uses type 'provides' but is not listed in metadata provides.`,
        'Add the capability to provides or change the mapping type.'
      );
    }

    if (mapping.type === 'touch' && !touches.has(mapping.capability)) {
      throw new TraceabilityValidationError(
        'traceability_marker_mismatch',
        `Mapping '${mapping.capability}' uses type 'touch' but is not listed in metadata touches.`,
        'Add the capability to touches or change the mapping type.'
      );
    }

    for (const location of mapping.codeLocations) {
      if (!isSafeRelativeFilePath(location.file)) {
        throw new TraceabilityValidationError(
          'traceability_schema_invalid',
          `Traceability code location file '${location.file}' must be a safe relative path.`,
          'Use a project-relative path that does not leave the project root.'
        );
      }
    }
  }
}

export function validateTraceabilityIndex(index: unknown): TraceabilityIndex {
  const result = TraceabilityIndexSchema.safeParse(index);
  if (!result.success) {
    throw new TraceabilityValidationError(
      'traceability_index_invalid',
      `Invalid traceability index: ${result.error.message}`,
      'Fix or regenerate openspec/.traceability/index.json.'
    );
  }

  return result.data;
}
