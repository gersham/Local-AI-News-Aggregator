import { sourceExecutionModeSchema } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  loadPersistedSourceRegistry,
  updateStoredSourceDefinition,
} from '../../../lib/source-registry-store';

const sourceUpdateSchema = z
  .object({
    id: z.string().min(2),
    enabled: z.boolean().optional(),
    executionMode: sourceExecutionModeSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (value) =>
      value.enabled !== undefined ||
      value.executionMode !== undefined ||
      value.notes !== undefined,
    {
      message: 'At least one source field must be updated.',
      path: ['id'],
    },
  );

function createPayload(
  state: Awaited<ReturnType<typeof loadPersistedSourceRegistry>>,
) {
  return {
    registry: state.registry,
    meta: {
      examplePath: state.examplePath,
      storagePath: state.storagePath,
      usingExampleFallback: state.usingExampleFallback,
    },
  };
}

export async function GET() {
  const state = await loadPersistedSourceRegistry();

  return NextResponse.json(createPayload(state));
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const input = sourceUpdateSchema.parse(body);
    const state = await updateStoredSourceDefinition({
      id: input.id,
      patch: {
        enabled: input.enabled,
        executionMode: input.executionMode,
        notes: input.notes,
      },
    });

    return NextResponse.json(createPayload(state));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid source update payload.',
          details: z.treeifyError(error),
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes('was not found')) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: 'Unexpected source update failure.',
      },
      { status: 500 },
    );
  }
}
