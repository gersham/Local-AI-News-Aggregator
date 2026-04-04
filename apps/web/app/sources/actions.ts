'use server';

import {
  type SourceDefinition,
  sourceExecutionModeSchema,
  sourceFetchMethodSchema,
  sourceTypeSchema,
} from '@news-aggregator/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  addNewSourceDefinition,
  deleteSourceDefinition,
  updateStoredSourceDefinition,
} from '../../lib/source-registry-store';

function parseListField(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(/\r?\n|,/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseOptionalStringField(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : undefined;
}

const sourceActionSchema = z.object({
  additionalQueries: z.array(z.string().min(1)),
  baseWeight: z.coerce.number().min(0).max(1),
  id: z.string().min(2),
  exaCategory: z.string().optional(),
  exaNumResults: z.coerce.number().int().min(1).max(100).optional(),
  exaSearchType: z.string().optional(),
  exaUserLocation: z
    .string()
    .regex(/^[a-z]{2}$/iu)
    .optional(),
  executionMode: sourceExecutionModeSchema,
  excludeDomains: z.array(z.string().min(1)),
  includeDomains: z.array(z.string().min(1)),
  notes: z.string().max(500).optional(),
  query: z.string().optional(),
  regions: z.array(z.string().min(1)),
  rssUrl: z.string().url().optional(),
  seedUrls: z.array(z.string().min(1)),
  topics: z.array(z.string().min(1)),
  trustWeight: z.coerce.number().min(0).max(1),
});

export async function updateSourceAction(formData: FormData) {
  const input = sourceActionSchema.parse({
    additionalQueries: parseListField(formData.get('additionalQueries')),
    baseWeight: formData.get('baseWeight'),
    id: formData.get('id'),
    exaCategory: parseOptionalStringField(formData.get('exaCategory')),
    exaNumResults: parseOptionalStringField(formData.get('exaNumResults')),
    exaSearchType: parseOptionalStringField(formData.get('exaSearchType')),
    exaUserLocation: parseOptionalStringField(formData.get('exaUserLocation')),
    executionMode: formData.get('executionMode'),
    excludeDomains: parseListField(formData.get('excludeDomains')),
    includeDomains: parseListField(formData.get('includeDomains')),
    notes: parseOptionalStringField(formData.get('notes')),
    query: parseOptionalStringField(formData.get('query')),
    regions: parseListField(formData.get('regions')),
    rssUrl: parseOptionalStringField(formData.get('rssUrl')),
    seedUrls: parseListField(formData.get('seedUrls')),
    topics: parseListField(formData.get('topics')),
    trustWeight: formData.get('trustWeight'),
  });

  await updateStoredSourceDefinition({
    id: input.id,
    patch: {
      additionalQueries: input.additionalQueries,
      baseWeight: input.baseWeight,
      enabled: input.executionMode !== ('disabled' as const),
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
      rssUrl: input.rssUrl,
      seedUrls: input.seedUrls,
      topics: input.topics,
      trustWeight: input.trustWeight,
    },
  });

  revalidatePath('/');
  revalidatePath('/sources');
}

const newSourceSchema = z.object({
  id: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/u, 'ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(2),
  type: sourceTypeSchema,
  fetchMethod: sourceFetchMethodSchema,
});

export async function addSourceAction(formData: FormData) {
  const input = newSourceSchema.parse({
    id: formData.get('id'),
    name: formData.get('name'),
    type: formData.get('type'),
    fetchMethod: formData.get('fetchMethod'),
  });

  const newSource: SourceDefinition = {
    id: input.id,
    name: input.name,
    type: input.type,
    fetchMethod: input.fetchMethod,
    enabled: false,
    executionMode: 'manual-opt-in',
    requiresAuthentication: false,
    schedule: '0 */6 * * *',
    topics: [],
    regions: [],
    seedUrls: [],
    additionalQueries: [],
    includeDomains: [],
    excludeDomains: [],
    baseWeight: 0.5,
    trustWeight: 0.5,
  };

  await addNewSourceDefinition(newSource);

  revalidatePath('/');
  revalidatePath('/sources');
}

const deleteSourceSchema = z.object({
  id: z.string().min(2),
});

export async function deleteSourceAction(formData: FormData) {
  const input = deleteSourceSchema.parse({
    id: formData.get('id'),
  });

  await deleteSourceDefinition(input.id);

  revalidatePath('/');
  revalidatePath('/sources');
}
