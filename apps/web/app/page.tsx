import { starterTopics, systemCapabilityHeadings } from '@news-aggregator/core';
import { Database, Newspaper, Radio } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../lib/persistence-error';
import { loadLatestPodcastRun } from '../lib/podcast-store';
import { DashboardPodcastControls } from './dashboard-podcast-controls';

export default async function HomePage() {
  let latestPodcastRun: Awaited<ReturnType<typeof loadLatestPodcastRun>>;
  let podcastSetupMessage: string | undefined;

  try {
    latestPodcastRun = await loadLatestPodcastRun();
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      podcastSetupMessage = getMongoPersistenceSetupMessage();
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section className="space-y-4">
        <Badge variant="outline" className="text-primary border-primary/30">
          Control Plane
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Personal Newsroom
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Feed rendering, source control, and morning briefing playback. Manage
          your ingestion pipeline from here.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button asChild>
            <Link href="/feed">
              <Newspaper className="size-4" />
              View Feed
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sources">
              <Database className="size-4" />
              Manage Sources
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/podcasts">
              <Radio className="size-4" />
              Podcast History
            </Link>
          </Button>
        </div>
      </section>

      <Separator />

      {/* Capabilities grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">System Capabilities</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systemCapabilityHeadings.map((capability) => (
            <Card key={capability.title}>
              <CardHeader>
                <CardTitle className="text-sm">{capability.title}</CardTitle>
                <CardDescription>{capability.summary}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Starter Topics</CardTitle>
            <CardDescription>
              Seed list for feed coverage and briefing selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {starterTopics.map((topic, index) => (
              <div key={topic.slug}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium">{topic.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {topic.scope}
                  </span>
                </div>
                {index < starterTopics.length - 1 && (
                  <Separator className="mt-3" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Podcast Generation</CardTitle>
            <CardDescription>
              Run the ingest and briefing workflow without Sonos playback.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {podcastSetupMessage ? (
              <p className="text-sm text-muted-foreground">
                {podcastSetupMessage}
              </p>
            ) : (
              <DashboardPodcastControls
                initialRun={
                  latestPodcastRun
                    ? {
                        audioPath: latestPodcastRun.audioPath,
                        date: latestPodcastRun.date,
                        generatedAt: latestPodcastRun.generatedAt,
                        runId: latestPodcastRun.runId,
                      }
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
