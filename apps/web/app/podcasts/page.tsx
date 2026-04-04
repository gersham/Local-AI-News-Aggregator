import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../lib/persistence-error';
import {
  getPodcastAudioDownloadPath,
  loadPodcastRuns,
} from '../../lib/podcast-store';
import { GeneratePodcastButton } from './generate-podcast-button';
import { PodcastCard } from './podcast-card';

export const dynamic = 'force-dynamic';

export default async function PodcastsPage() {
  try {
    const state = await loadPodcastRuns({
      limit: 50,
    });

    return (
      <div className="space-y-6">
        <section className="space-y-2">
          <Badge variant="outline">Podcast Archive</Badge>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">Podcasts</h1>
            <GeneratePodcastButton />
          </div>
          <p className="text-muted-foreground">
            Historical briefing runs stored in MongoDB, newest first.
          </p>
        </section>

        <div className="space-y-4">
          {state.runs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                No podcasts have been generated yet.
              </CardContent>
            </Card>
          ) : (
            state.runs.map((run) => (
              <PodcastCard
                key={run.runId}
                run={run}
                audioUrl={getPodcastAudioDownloadPath(run.runId)}
              />
            ))
          )}
        </div>
      </div>
    );
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      return (
        <div className="space-y-4">
          <Badge variant="outline">Podcast Archive</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Podcasts</h1>
          <p className="text-muted-foreground">
            {getMongoPersistenceSetupMessage()}
          </p>
        </div>
      );
    }

    throw error;
  }
}
