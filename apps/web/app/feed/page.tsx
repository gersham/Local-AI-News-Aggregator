import { ChevronRight, MapPin, Tag, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { loadFeedSnapshot } from '../../lib/feed-store';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../lib/persistence-error';
import { UpdateFeedButton } from './update-feed-button';

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  try {
    const state = await loadFeedSnapshot();

    return (
      <div className="space-y-8">
        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-primary border-primary/30">
              Feed Preview
            </Badge>
            <Badge variant="secondary">
              {state.snapshot.entries.length} entries
            </Badge>
            <Badge variant={state.usingExampleFallback ? 'outline' : 'default'}>
              {state.usingExampleFallback ? 'Example data' : 'Live data'}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Ranked Story Clusters
            </h1>
            <UpdateFeedButton />
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Stories ranked by relevance, freshness, corroboration, and source
            type.
          </p>
        </section>

        <Separator />

        {/* Feed entries */}
        <div className="space-y-4">
          {state.snapshot.entries.map((entry) => (
            <Link
              key={entry.clusterId}
              href={`/feed/${encodeURIComponent(entry.clusterId)}`}
              className="block group"
            >
              <Card className="transition-colors group-hover:border-primary/30">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-snug">
                        <span className="mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {entry.rank}
                        </span>
                        {entry.headline}
                      </CardTitle>
                      <CardDescription className="break-all">
                        {entry.canonicalUrl}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Badge className="font-mono">
                        {entry.ranking.totalScore.toFixed(2)}
                      </Badge>
                      <Badge variant="outline">
                        {entry.citationCount} cite
                        {entry.citationCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="outline">
                        {entry.sourceCount} src
                        {entry.sourceCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {entry.summary}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {entry.topics.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="size-3" />
                        {entry.topics.join(', ')}
                      </span>
                    )}
                    {entry.regions.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {entry.regions.join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {entry.sourceNames.join(', ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {entry.reasons.map((reason) => (
                      <Badge
                        key={reason}
                        variant="secondary"
                        className="text-xs"
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    if (!isMongoPersistenceConfigurationError(error)) {
      throw error;
    }

    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            Setup Blocked
          </Badge>
          <CardTitle>MongoDB Not Configured</CardTitle>
          <CardDescription>
            The feed page requires MongoDB-backed persistence before it can load
            live state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{getMongoPersistenceSetupMessage()}</p>
          <p>
            Add <code>MONGODB_URI</code> to <code>.env</code>, then restart the
            Next.js server.
          </p>
        </CardContent>
      </Card>
    );
  }
}
