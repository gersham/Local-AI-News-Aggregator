import { sourceExecutionModeSchema } from '@news-aggregator/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../../lib/persistence-error';
import {
  loadPersistedSourceRegistry,
  updateStoredSourceDefinition,
} from '../../../lib/source-registry-store';

const sourceUpdateSchema = z
  .object({
    additionalQueries: z.array(z.string().min(1)).optional(),
    baseWeight: z.number().min(0).max(1).optional(),
    id: z.string().min(2),
    enabled: z.boolean().optional(),
    exaCategory: z.string().min(1).optional(),
    exaNumResults: z.number().int().min(1).max(100).optional(),
    exaSearchType: z.string().min(1).optional(),
    exaUserLocation: z
      .string()
      .regex(/^[a-z]{2}$/iu)
      .optional(),
    executionMode: sourceExecutionModeSchema.optional(),
    excludeDomains: z.array(z.string().min(1)).optional(),
    includeDomains: z.array(z.string().min(1)).optional(),
    notes: z.string().max(500).optional(),
    query: z.string().min(1).optional(),
    regions: z.array(z.string().min(1)).optional(),
    topics: z.array(z.string().min(1)).optional(),
    trustWeight: z.number().min(0).max(1).optional(),
  })
  .refine(
    (value) =>
      value.additionalQueries !== undefined ||
      value.baseWeight !== undefined ||
      value.enabled !== undefined ||
      value.exaCategory !== undefined ||
      value.exaNumResults !== undefined ||
      value.exaSearchType !== undefined ||
      value.exaUserLocation !== undefined ||
      value.executionMode !== undefined ||
      value.excludeDomains !== undefined ||
      value.includeDomains !== undefined ||
      value.notes !== undefined ||
      value.query !== undefined ||
      value.regions !== undefined ||
      value.topics !== undefined ||
      value.trustWeight !== undefined,
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
      storageTarget: state.storageTarget,
      usingExampleFallback: state.usingExampleFallback,
    },
  };
}

export async function GET() {
  try {
    const state = await loadPersistedSourceRegistry();

    return NextResponse.json(createPayload(state));
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      return NextResponse.json(
        {
          error: getMongoPersistenceSetupMessage(),
        },
        { status: 503 },
      );
    }

    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const input = sourceUpdateSchema.parse(body);
    const state = await updateStoredSourceDefinition({
      id: input.id,
      patch: {
        additionalQueries: input.additionalQueries,
        baseWeight: input.baseWeight,
        enabled: input.enabled,
        exaCategory: input.exaCategory,
        exaNumResults: input.exaNumResults,
        exaSearchType: input.exaSearchType,
        exaUserLocation: input.exaUserLocation?.toLowerCase(),
        executionMode: input.executionMode,
        excludeDomains: input.excludeDomains,
        includeDomains: input.includeDomains,
        notes: input.notes,
        query: input.query,
        regions: input.regions,
        topics: input.topics,
        trustWeight: input.trustWeight,
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

    if (isMongoPersistenceConfigurationError(error)) {
      return NextResponse.json(
        {
          error: getMongoPersistenceSetupMessage(),
        },
        { status: 503 },
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
