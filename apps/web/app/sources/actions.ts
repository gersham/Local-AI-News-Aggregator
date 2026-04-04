'use server';

import { sourceExecutionModeSchema } from '@news-aggregator/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateStoredSourceDefinition } from '../../lib/source-registry-store';

const sourceActionSchema = z.object({
  id: z.string().min(2),
  enabled: z.boolean(),
  executionMode: sourceExecutionModeSchema,
});

export async function updateSourceAction(formData: FormData) {
  const input = sourceActionSchema.parse({
    id: formData.get('id'),
    enabled: formData.get('enabled') === 'on',
    executionMode: formData.get('executionMode'),
  });

  await updateStoredSourceDefinition({
    id: input.id,
    patch: {
      enabled: input.enabled,
      executionMode: input.executionMode,
    },
  });

  revalidatePath('/');
  revalidatePath('/sources');
}
