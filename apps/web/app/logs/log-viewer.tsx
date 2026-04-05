'use client';

import { AlertCircle, AlertTriangle, Bug, Info, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';

type LogEntry = {
  entryId: string;
  timestamp: string;
  severity: string;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
};

const severityConfig: Record<
  string,
  { icon: typeof Info; color: string; badge: string }
> = {
  debug: { icon: Bug, color: 'text-muted-foreground', badge: 'secondary' },
  info: { icon: Info, color: 'text-blue-400', badge: 'default' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', badge: 'outline' },
  error: { icon: AlertCircle, color: 'text-red-400', badge: 'destructive' },
};

export function LogViewer({ initialEntries }: { initialEntries: LogEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [clearing, setClearing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestTimestampRef = useRef<string>(initialEntries[0]?.timestamp ?? '');

  useEffect(() => {
    async function poll() {
      try {
        const since = latestTimestampRef.current;
        const params = since ? `?since=${encodeURIComponent(since)}` : '';
        const response = await fetch(`/api/logs${params}`);

        // 304 = no new entries since cursor, nothing to do
        if (response.status === 304) return;
        if (!response.ok) return;

        const data = await response.json();
        const newEntries = (data.entries ?? []) as LogEntry[];

        if (newEntries.length > 0) {
          latestTimestampRef.current = newEntries[0].timestamp;

          setEntries((prev) => {
            const existingIds = new Set(prev.map((e) => e.entryId));
            const unique = newEntries.filter(
              (e) => !existingIds.has(e.entryId),
            );
            if (unique.length === 0) return prev;
            return [...unique, ...prev].slice(0, 500);
          });
        }
      } catch {
        // silently retry next interval
      }
    }

    intervalRef.current = setInterval(poll, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const sources = Array.from(new Set(entries.map((e) => e.source))).sort();

  const filtered = entries.filter((entry) => {
    if (filter !== 'all' && entry.severity !== filter) return false;
    if (sourceFilter !== 'all' && entry.source !== sourceFilter) return false;
    return true;
  });

  async function handleClear() {
    if (!confirm('Clear all activity logs?')) return;
    setClearing(true);
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setEntries([]);
      setSelectedEntry(null);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    } finally {
      setClearing(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All severities</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="flex h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Badge variant="secondary">{filtered.length} entries</Badge>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleClear}
            disabled={clearing}
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Detail panel */}
      {selectedEntry &&
        (() => {
          const config =
            severityConfig[selectedEntry.severity] ?? severityConfig.info;
          const Icon = config.icon;
          return (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`size-4 shrink-0 ${config.color}`} />
                    <Badge variant="outline">{selectedEntry.source}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedEntry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedEntry(null)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-foreground mt-2">
                  {selectedEntry.message}
                </p>
              </CardHeader>
              {selectedEntry.metadata &&
                Object.keys(selectedEntry.metadata).length > 0 && (
                  <CardContent>
                    <pre className="text-xs text-muted-foreground bg-secondary/30 rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </CardContent>
                )}
            </Card>
          );
        })()}

      {/* Log entries */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No log entries found.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((entry) => {
              const config =
                severityConfig[entry.severity] ?? severityConfig.info;
              const Icon = config.icon;
              const isSelected = selectedEntry?.entryId === entry.entryId;

              return (
                <button
                  type="button"
                  key={entry.entryId}
                  onClick={() => setSelectedEntry(isSelected ? null : entry)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-secondary/20 ${isSelected ? 'bg-secondary/40' : ''}`}
                >
                  <Icon className={`size-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {entry.source}
                      </Badge>
                    </div>
                    <p className="text-foreground mt-0.5 truncate">
                      {entry.message}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
