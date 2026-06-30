import { promises as fs } from 'fs';
import path from 'path';
import type { ChangeMetadata } from '../change-metadata/schema.js';
import { createEmptyTraceabilityIndex, type TraceabilityIndex } from './schema.js';
import { getTraceabilityIndexDir, getTraceabilityIndexPath } from './paths.js';
import { mergeTraceabilityIndex } from './merge.js';
import {
  readChangeTraceability,
  validateChangeTraceability,
  validateTraceabilityIndex,
  TraceabilityValidationError,
  isTraceabilityValidationError,
} from './validation.js';

export { TraceabilityValidationError, isTraceabilityValidationError } from './validation.js';
export * from './schema.js';
export * from './merge.js';

export interface TraceabilityMergeOptions {
  changeName: string;
  changeDir: string;
  openspecRoot: string;
  metadata: ChangeMetadata;
  now?: Date;
}

export interface TraceabilityMergeResult {
  merged: boolean;
  mappingCount: number;
  indexPath: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function loadIndex(indexPath: string, lastUpdated: string): Promise<TraceabilityIndex> {
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TraceabilityValidationError(
        'traceability_index_invalid',
        `Invalid traceability index JSON: ${message}`,
        'Fix or regenerate openspec/.traceability/index.json.'
      );
    }

    return validateTraceabilityIndex(parsed);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return createEmptyTraceabilityIndex(lastUpdated);
    }
    if (isTraceabilityValidationError(error)) {
      throw error;
    }
    throw error;
  }
}

export async function mergeTraceabilityForArchive(
  options: TraceabilityMergeOptions
): Promise<TraceabilityMergeResult> {
  const lastUpdated = formatDate(options.now ?? new Date());
  const traceability = await readChangeTraceability(options.changeDir);
  validateChangeTraceability(traceability, options.changeName, options.metadata);

  const indexPath = getTraceabilityIndexPath(options.openspecRoot);
  const index = await loadIndex(indexPath, lastUpdated);
  const merged = mergeTraceabilityIndex(index, traceability.mappings, lastUpdated);
  validateTraceabilityIndex(merged);

  await fs.mkdir(getTraceabilityIndexDir(options.openspecRoot), { recursive: true });
  const tmpPath = path.join(path.dirname(indexPath), 'index.json.tmp');
  await fs.writeFile(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');
  await fs.rename(tmpPath, indexPath);

  return {
    merged: true,
    mappingCount: traceability.mappings.length,
    indexPath,
  };
}
