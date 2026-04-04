'use client';

import type { SourceDefinition } from '@news-aggregator/core';
import {
  Eye,
  Globe,
  Mail,
  Monitor,
  Newspaper,
  Rss,
  Search,
  Sparkles,
  Star,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../lib/utils';
import {
  addSourceAction,
  deleteSourceAction,
  updateSourceAction,
} from './actions';

function formatListField(values: string[]) {
  return values.join('\n');
}

function getSourceTypeIcon(type: string) {
  switch (type) {
    case 'social':
      return Users;
    case 'news-site':
      return Newspaper;
    case 'watchlist':
      return Eye;
    case 'newsletter':
      return Mail;
    case 'custom':
      return Wrench;
    default:
      return Star;
  }
}

function getFetchMethodIcon(method: string) {
  switch (method) {
    case 'x-search':
      return Search;
    case 'exa-search':
      return Sparkles;
    case 'http':
      return Globe;
    case 'rss':
      return Rss;
    case 'browser-scrape':
      return Monitor;
    default:
      return Globe;
  }
}

export function SourceManager({ sources }: { sources: SourceDefinition[] }) {
  const [selectedId, setSelectedId] = useState<string>(sources[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const selectedSource = sources.find((s) => s.id === selectedId);

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* Master list - left side */}
      <div className="w-64 shrink-0">
        <Card className="sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sources</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="flex flex-col">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(source.id);
                    setCreating(false);
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors border-l-2',
                    selectedId === source.id
                      ? 'border-l-primary bg-secondary/50 text-foreground'
                      : 'border-l-transparent text-muted-foreground hover:bg-secondary/30 hover:text-foreground',
                  )}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {(() => {
                      const Icon = getSourceTypeIcon(source.type);
                      return (
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="truncate font-medium">{source.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {source.fetchMethod}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-block size-2 shrink-0 rounded-full',
                      source.enabled
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/40',
                    )}
                    title={source.enabled ? 'Enabled' : 'Disabled'}
                  />
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCreating(true);
                  setSelectedId('');
                }}
              >
                + Add Source
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail panel - right side */}
      <div className="flex-1 min-w-0">
        {creating ? (
          <NewSourceForm
            onCancel={() => {
              setCreating(false);
              setSelectedId(sources[0]?.id ?? '');
            }}
          />
        ) : selectedSource ? (
          <SourceDetail source={selectedSource} />
        ) : (
          <Card className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Select a source to edit</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SourceDetail({ source }: { source: SourceDefinition }) {
  const hasQuery =
    source.fetchMethod === 'x-search' || source.fetchMethod === 'exa-search';
  const hasExa = source.fetchMethod === 'exa-search';
  const hasDomainFilters =
    source.fetchMethod === 'exa-search' || source.fetchMethod === 'http';
  const hasSeedUrls =
    source.fetchMethod === 'http' || source.fetchMethod === 'browser-scrape';
  const hasRssUrl = source.fetchMethod === 'rss';

  return (
    <Card key={source.id}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{source.name}</CardTitle>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {source.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                source.executionMode === 'disabled'
                  ? 'secondary'
                  : source.executionMode === 'active'
                    ? 'default'
                    : 'outline'
              }
            >
              {source.executionMode}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {(() => {
                const Icon = getFetchMethodIcon(source.fetchMethod);
                return <Icon className="size-3" />;
              })()}
              {source.fetchMethod}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
          <span>Topics: {source.topics.join(', ') || 'none'}</span>
          <span>Regions: {source.regions.join(', ') || 'none'}</span>
          <span>Trust: {source.trustWeight.toFixed(2)}</span>
        </div>
        {source.notes && (
          <p className="text-sm text-muted-foreground mb-4">{source.notes}</p>
        )}

        <Separator className="my-4" />

        <form action={updateSourceAction} className="space-y-4">
          <input name="id" type="hidden" value={source.id} />

          {/* Status — sets both executionMode and enabled */}
          <div className="space-y-2">
            <Label htmlFor={`mode-${source.id}`}>Status</Label>
            <select
              id={`mode-${source.id}`}
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue={source.executionMode}
              name="executionMode"
            >
              <option value="active">Active — runs automatically</option>
              <option value="manual-opt-in">
                Manual — configured but skipped
              </option>
              <option value="disabled">Disabled — fully off</option>
            </select>
          </div>

          {/* RSS URL - rss only */}
          {hasRssUrl && (
            <div className="space-y-2">
              <Label htmlFor={`rss-${source.id}`}>RSS Feed URL</Label>
              <Input
                id={`rss-${source.id}`}
                defaultValue={source.rssUrl ?? ''}
                name="rssUrl"
                type="url"
                placeholder="https://example.com/feed.xml"
              />
            </div>
          )}

          {/* Seed URLs - http and browser-scrape */}
          {hasSeedUrls && (
            <div className="space-y-2">
              <Label htmlFor={`seeds-${source.id}`}>
                {source.fetchMethod === 'http' ? 'Target URLs' : 'Seed URLs'}
              </Label>
              <Textarea
                id={`seeds-${source.id}`}
                defaultValue={formatListField(source.seedUrls)}
                name="seedUrls"
                rows={3}
                placeholder="https://example.com/page&#10;https://example.com/other"
              />
              <p className="text-xs text-muted-foreground">One URL per line</p>
            </div>
          )}

          {/* Query - only for search-based methods */}
          {hasQuery && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`query-${source.id}`}>Primary Query</Label>
                <Textarea
                  id={`query-${source.id}`}
                  defaultValue={source.query ?? ''}
                  name="query"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`addq-${source.id}`}>Additional Queries</Label>
                <Textarea
                  id={`addq-${source.id}`}
                  defaultValue={formatListField(source.additionalQueries)}
                  name="additionalQueries"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Topics & Regions - common to all */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`topics-${source.id}`}>Topics</Label>
              <Textarea
                id={`topics-${source.id}`}
                defaultValue={formatListField(source.topics)}
                name="topics"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`regions-${source.id}`}>Regions</Label>
              <Textarea
                id={`regions-${source.id}`}
                defaultValue={formatListField(source.regions)}
                name="regions"
                rows={2}
              />
            </div>
          </div>

          {/* Domain filters - exa-search and http */}
          {hasDomainFilters && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`incdom-${source.id}`}>Include Domains</Label>
                <Textarea
                  id={`incdom-${source.id}`}
                  defaultValue={formatListField(source.includeDomains)}
                  name="includeDomains"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`excdom-${source.id}`}>Exclude Domains</Label>
                <Textarea
                  id={`excdom-${source.id}`}
                  defaultValue={formatListField(source.excludeDomains)}
                  name="excludeDomains"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Weights - common to all */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`bw-${source.id}`}>Base Weight</Label>
              <Input
                id={`bw-${source.id}`}
                defaultValue={source.baseWeight}
                max={1}
                min={0}
                name="baseWeight"
                step={0.01}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tw-${source.id}`}>Trust Weight</Label>
              <Input
                id={`tw-${source.id}`}
                defaultValue={source.trustWeight}
                max={1}
                min={0}
                name="trustWeight"
                step={0.01}
                type="number"
              />
            </div>
          </div>

          {/* Exa settings - exa-search only */}
          {hasExa && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor={`ecat-${source.id}`}>Exa Category</Label>
                <Input
                  id={`ecat-${source.id}`}
                  defaultValue={source.exaCategory ?? ''}
                  name="exaCategory"
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`estype-${source.id}`}>Exa Search Type</Label>
                <Input
                  id={`estype-${source.id}`}
                  defaultValue={source.exaSearchType ?? ''}
                  name="exaSearchType"
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`enum-${source.id}`}>Exa Results</Label>
                <Input
                  id={`enum-${source.id}`}
                  defaultValue={source.exaNumResults ?? ''}
                  max={100}
                  min={1}
                  name="exaNumResults"
                  step={1}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`eloc-${source.id}`}>Exa Location</Label>
                <Input
                  id={`eloc-${source.id}`}
                  defaultValue={source.exaUserLocation ?? ''}
                  maxLength={2}
                  name="exaUserLocation"
                  type="text"
                />
              </div>
            </div>
          )}

          {/* Notes - common to all */}
          <div className="space-y-2">
            <Label htmlFor={`notes-${source.id}`}>Notes</Label>
            <Textarea
              id={`notes-${source.id}`}
              defaultValue={source.notes ?? ''}
              name="notes"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full sm:w-auto">
            Save Configuration
          </Button>
        </form>

        <Separator className="my-4" />
        <form action={deleteSourceAction}>
          <input name="id" type="hidden" value={source.id} />
          <Button
            type="submit"
            variant="destructive"
            className="w-full sm:w-auto"
          >
            Delete Source
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NewSourceForm({ onCancel }: { onCancel: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Source</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a new source with default settings. You can configure it after
          creation.
        </p>
      </CardHeader>
      <CardContent>
        <form action={addSourceAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-id">Source ID</Label>
            <Input
              id="new-id"
              name="id"
              type="text"
              required
              placeholder="my-source-name"
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name">Display Name</Label>
            <Input
              id="new-name"
              name="name"
              type="text"
              required
              placeholder="My Source"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-type">Source Type</Label>
            <select
              id="new-type"
              name="type"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="news-site">news-site</option>
              <option value="social">social</option>
              <option value="watchlist">watchlist</option>
              <option value="newsletter">newsletter</option>
              <option value="custom">custom</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-method">Fetch Method</Label>
            <select
              id="new-method"
              name="fetchMethod"
              required
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="exa-search">exa-search</option>
              <option value="x-search">x-search</option>
              <option value="http">http</option>
              <option value="rss">rss</option>
              <option value="browser-scrape">browser-scrape</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button type="submit">Create Source</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
