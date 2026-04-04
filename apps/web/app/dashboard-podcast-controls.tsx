'use client';

import { Loader2, Radio, SquareArrowOutUpRight } from 'lucide-react';
import { useActionState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { generatePodcastAction } from './podcast-actions';

const initialState = {
  run: undefined,
  status: 'idle' as 'idle' | 'success',
};

export function DashboardPodcastControls(props: {
  initialRun?: {
    audioPath?: string;
    date: string;
    generatedAt: string;
    runId: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(generatePodcastAction, {
    ...initialState,
    run: props.initialRun,
    status: props.initialRun ? 'success' : 'idle',
  });

  return (
    <div className="space-y-3">
      <form action={formAction}>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Radio className="size-4" />
          )}
          Generate Podcast
        </Button>
      </form>
      {state.run ? (
        <div className="rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Latest podcast</Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(state.run.generatedAt).toLocaleString()}
            </span>
          </div>
          {state.run.audioPath ? (
            <a
              href="/podcasts"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View in podcast history
              <SquareArrowOutUpRight className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
