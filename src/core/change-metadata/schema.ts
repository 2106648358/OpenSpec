import { z } from 'zod';
import { isKebabId } from '../id.js';

export { isKebabId } from '../id.js';

const KebabIdentifierSchema = (label: string): z.ZodString =>
  z.string().superRefine((value, ctx) => {
    if (!isKebabId(value)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be kebab-case with lowercase letters, numbers, and single hyphen separators`,
      });
    }
  });

export const CapabilityIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/, {
  message: 'capability id must be lowercase area or area/sub-area',
});

export const InitiativeLinkSchema = z.object({
  store: KebabIdentifierSchema('Store id'),
  id: KebabIdentifierSchema('Initiative id'),
}).strict();

export type InitiativeLink = z.infer<typeof InitiativeLinkSchema>;

// Per-change metadata schema. The schema field is validated against available
// workflow schemas when metadata is read or written.
export const ChangeMetadataSchema = z.object({
  schema: z.string().min(1, { message: 'schema is required' }),
  created: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'created must be YYYY-MM-DD format',
    })
    .optional(),
  goal: z.string().min(1).optional(),
  affected_areas: z.array(z.string().min(1)).optional(),
  initiative: InitiativeLinkSchema.optional(),
  provides: z.array(CapabilityIdSchema).optional(),
  requires: z.array(CapabilityIdSchema).optional(),
  touches: z.array(CapabilityIdSchema).optional(),
  dependsOn: z.array(KebabIdentifierSchema('Change id')).optional(),
});

export type ChangeMetadata = z.infer<typeof ChangeMetadataSchema>;
