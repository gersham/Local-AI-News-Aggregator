'use client';

import { ChevronDown, Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';

type PodcastRun = {
  runId: string;
  date: string;
  generatedAt: string;
  durationSec?: number;
  transcript?: string;
  transcriptPath?: string;
  audioPath?: string;
};

export function PodcastCard({
  run,
  audioUrl,
}: {
  run: PodcastRun;
  audioUrl: string;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm('Delete this podcast?')) return;
    setDeleting(true);

    try {
      await fetch(`/api/podcasts/${run.runId}/delete`, { method: 'POST' });
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{run.date}</Badge>
              {run.durationSec && (
                <Badge variant="secondary">
                  {Math.floor(run.durationSec / 60)}:
                  {String(run.durationSec % 60).padStart(2, '0')}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base">
              {new Date(run.generatedAt).toLocaleString()}
            </CardTitle>
          </div>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete podcast"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio player */}
        {run.audioPath && (
          <div className="space-y-2">
            {/* biome-ignore lint/a11y/useMediaCaption: audio-only podcast briefing, no captions available */}
            <audio controls preload="none" className="w-full" src={audioUrl}>
              Your browser does not support audio playback.
            </audio>
            <div className="flex gap-3">
              <a
                href={audioUrl}
                download
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download className="size-3" />
                Download MP3
              </a>
            </div>
          </div>
        )}

        {/* Transcript */}
        {run.transcript && (
          <>
            <Separator />
            <div>
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <ChevronDown
                  className={`size-4 transition-transform ${showTranscript ? 'rotate-180' : ''}`}
                />
                {showTranscript ? 'Hide Transcript' : 'View Transcript'}
              </button>
              {showTranscript && (
                <div className="mt-3 rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {run.transcript}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
