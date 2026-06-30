import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import {
  ChangeTraceabilitySchema,
  createEmptyTraceabilityIndex,
  mergeTraceabilityForArchive,
  mergeTraceabilityIndex,
  TraceabilityValidationError,
} from '../../src/core/traceability/index.js';

describe('traceability schemas', () => {
  it('defaults mapping type to provides', () => {
    const result = ChangeTraceabilitySchema.safeParse({
      formatVersion: '1',
      change: 'add-password-timeout',
      createdAt: '2026-06-29',
      mappings: [
        {
          capability: 'auth/session',
          requirement: 'Password timeout',
          codeLocations: [{ file: 'src/auth/session.ts', symbol: 'checkSessionTimeout' }],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mappings[0].type).toBe('provides');
    }
  });

  it('rejects spans where start is after end', () => {
    const result = ChangeTraceabilitySchema.safeParse({
      formatVersion: '1',
      change: 'add-password-timeout',
      createdAt: '2026-06-29',
      mappings: [
        {
          capability: 'auth/session',
          requirement: 'Password timeout',
          codeLocations: [{ file: 'src/auth/session.ts', symbol: 'checkSessionTimeout', span: [4, 2] }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('traceability merge', () => {
  it('replaces provided forward mappings and cleans stale reverse references', () => {
    const index = createEmptyTraceabilityIndex('2026-06-29');
    const first = mergeTraceabilityIndex(index, [
      {
        capability: 'auth/session',
        requirement: 'Password timeout',
        type: 'provides',
        codeLocations: [
          { file: 'src/auth/session.ts', symbol: 'oldTimeout' },
          { file: 'src/auth/session.ts', symbol: 'refresh' },
        ],
      },
    ], '2026-06-29');

    const second = mergeTraceabilityIndex(first, [
      {
        capability: 'auth/session',
        requirement: 'Password timeout',
        type: 'provides',
        codeLocations: [{ file: 'src/auth/session.ts', symbol: 'newTimeout' }],
      },
    ], '2026-06-30');

    expect(second.forward['auth/session']['Password timeout'].current).toEqual([
      { file: 'src/auth/session.ts', symbol: 'newTimeout' },
    ]);
    expect(second.reverse['src/auth/session.ts'].oldTimeout).toBeUndefined();
    expect(second.reverse['src/auth/session.ts'].newTimeout.implements).toEqual([
      'auth/session/Password timeout',
    ]);
  });

  it('adds touch mappings only to reverse index', () => {
    const index = createEmptyTraceabilityIndex('2026-06-29');
    const merged = mergeTraceabilityIndex(index, [
      {
        capability: 'auth/middleware',
        requirement: 'Timeout guard',
        type: 'touch',
        codeLocations: [{ file: 'src/auth/middleware.ts', symbol: 'timeoutGuard' }],
      },
    ], '2026-06-29');

    expect(merged.forward).toEqual({});
    expect(merged.reverse['src/auth/middleware.ts'].timeoutGuard.implements).toEqual([
      'auth/middleware/Timeout guard',
    ]);
  });
});

describe('mergeTraceabilityForArchive', () => {
  let tempDir: string;
  let changeDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-traceability-${randomUUID()}`);
    changeDir = path.join(tempDir, 'openspec', 'changes', 'add-password-timeout');
    await fs.mkdir(path.join(changeDir, 'tasks'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes a cumulative index for a valid traceability file', async () => {
    await fs.writeFile(
      path.join(changeDir, 'tasks', 'traceability.json'),
      JSON.stringify({
        formatVersion: '1',
        change: 'add-password-timeout',
        createdAt: '2026-06-29',
        mappings: [
          {
            capability: 'auth/session',
            requirement: 'Password timeout',
            type: 'provides',
            codeLocations: [{ file: 'src/auth/session.ts', symbol: 'checkSessionTimeout' }],
          },
        ],
      })
    );

    const result = await mergeTraceabilityForArchive({
      changeName: 'add-password-timeout',
      changeDir,
      openspecRoot: tempDir,
      metadata: { schema: 'spec-driven-traceable', provides: ['auth/session'] },
      now: new Date('2026-06-29T00:00:00Z'),
    });

    const content = await fs.readFile(result.indexPath, 'utf-8');
    const index = JSON.parse(content);

    expect(result.mappingCount).toBe(1);
    expect(index.forward['auth/session']['Password timeout'].current).toEqual([
      { file: 'src/auth/session.ts', symbol: 'checkSessionTimeout' },
    ]);
  });

  it('throws a validation error for marker mismatches', async () => {
    await fs.writeFile(
      path.join(changeDir, 'tasks', 'traceability.json'),
      JSON.stringify({
        formatVersion: '1',
        change: 'add-password-timeout',
        createdAt: '2026-06-29',
        mappings: [
          {
            capability: 'auth/session',
            requirement: 'Password timeout',
            type: 'provides',
            codeLocations: [{ file: 'src/auth/session.ts', symbol: 'checkSessionTimeout' }],
          },
        ],
      })
    );

    await expect(
      mergeTraceabilityForArchive({
        changeName: 'add-password-timeout',
        changeDir,
        openspecRoot: tempDir,
        metadata: { schema: 'spec-driven-traceable', provides: [] },
      })
    ).rejects.toBeInstanceOf(TraceabilityValidationError);
  });
});
