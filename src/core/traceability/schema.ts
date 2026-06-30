import { z } from 'zod';
import { CapabilityIdSchema } from '../change-metadata/schema.js';

export const CodeLocationSchema = z.object({
  file: z.string().min(1),
  symbol: z.string().min(1),
  span: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([start, end]) => start <= end, {
      message: 'span start must be less than or equal to span end',
    })
    .optional(),
  line: z.number().int().positive().optional(),
}).strict();

export const TraceabilityMappingSchema = z.object({
  capability: CapabilityIdSchema,
  requirement: z.string().min(1),
  type: z.enum(['provides', 'touch']).default('provides'),
  codeLocations: z.array(CodeLocationSchema).min(1),
}).strict();

export const ChangeTraceabilitySchema = z.object({
  formatVersion: z.literal('1'),
  change: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mappings: z.array(TraceabilityMappingSchema),
}).strict();

export const TraceabilityIndexSchema = z.object({
  formatVersion: z.literal('1'),
  lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  forward: z.record(
    CapabilityIdSchema,
    z.record(
      z.string().min(1),
      z.object({ current: z.array(CodeLocationSchema) }).strict()
    )
  ),
  reverse: z.record(
    z.string().min(1),
    z.record(
      z.string().min(1),
      z.object({ implements: z.array(z.string().min(1)) }).strict()
    )
  ),
}).strict();

export type CodeLocation = z.infer<typeof CodeLocationSchema>;
export type TraceabilityMapping = z.infer<typeof TraceabilityMappingSchema>;
export type ChangeTraceability = z.infer<typeof ChangeTraceabilitySchema>;
export type TraceabilityIndex = z.infer<typeof TraceabilityIndexSchema>;

export function createEmptyTraceabilityIndex(lastUpdated: string): TraceabilityIndex {
  return {
    formatVersion: '1',
    lastUpdated,
    forward: {},
    reverse: {},
  };
}
