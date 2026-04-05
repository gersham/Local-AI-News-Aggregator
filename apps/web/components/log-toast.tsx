'use client';

import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type LogEntry = {
  entryId: string;
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

const severityStyles: Record<
  string,
  { icon: typeof Info; border: string; text: string }
> = {
  info: {
    icon: Info,
    border: 'border-blue-500/30',
    text: 'text-blue-400',
  },
  warn: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  error: {
    icon: AlertCircle,
    border: 'border-red-500/30',
    text: 'text-red-400',
  },
};

export function LogToast() {
  const [toast, setToast] = useState<LogEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const lastSeenId = useRef<string>('');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const response = await fetch('/api/logs?limit=1');
        const data = await response.json();
        const entry = data.entries?.[0] as LogEntry | undefined;

        if (
          entry &&
          entry.entryId !== lastSeenId.current &&
          entry.severity !== 'debug'
        ) {
          lastSeenId.current = entry.entryId;
          setToast(entry);
          setVisible(true);

          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setVisible(false), 5000);
        }
      } catch {
        // silently retry
      }
    }

    const interval = setInterval(poll, 1000);
    return () => {
      clearInterval(interval);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!toast || !visible) return null;

  const style = severityStyles[toast.severity] ?? severityStyles.info;
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in',
        'rounded-lg border bg-card p-3 shadow-lg',
        style.border,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('size-4 mt-0.5 shrink-0', style.text)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{toast.source}</span>
            <span>{new Date(toast.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-foreground mt-0.5 line-clamp-2">
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
