import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ExternalLink,
  MapPin,
  Sparkles,
  Tag,
  Timer,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Separator } from '../../../components/ui/separator';
import { loadFeedSnapshot } from '../../../lib/feed-store';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../../lib/persistence-error';

export const dynamic = 'force-dynamic';

export default async function FeedDetailPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;

  try {
    const state = await loadFeedSnapshot();
    const entry = state.snapshot.entries.find(
      (e) => e.clusterId === decodeURIComponent(clusterId),
    );

    if (!entry) {
      notFound();
    }

    return (
      <div className="space-y-6">
        {/* Back navigation */}
        <Button asChild variant="ghost" size="sm">
          <Link href="/feed">
            <ArrowLeft className="size-4" />
            Back to feed
          </Link>
        </Button>

        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-mono text-sm">#{entry.rank}</Badge>
            <Badge className="font-mono">
              Score: {entry.ranking.totalScore.toFixed(3)}
            </Badge>
            <Badge variant="outline">
              {entry.citationCount} citation
              {entry.citationCount !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline">
              {entry.sourceCount} source{entry.sourceCount !== 1 ? 's' : ''}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {entry.headline}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            {new Date(entry.publishedAt).toLocaleString()}
          </div>
          <a
            href={entry.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
          >
            <ExternalLink className="size-4 shrink-0" />
            {entry.canonicalUrl}
          </a>
        </section>

        <Separator />

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {entry.summary}
            </p>
          </CardContent>
        </Card>

        {/* Full body text */}
        {entry.bodyText && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Full Article</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {entry.bodyText}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scoring breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="size-4" />
              Scoring Breakdown
            </CardTitle>
            <CardDescription>
              How this story was ranked in the feed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <ScoreItem
                label="Base"
                value={entry.ranking.baseScore}
                icon={<Sparkles className="size-4" />}
              />
              <ScoreItem
                label="Freshness"
                value={entry.ranking.freshnessScore}
                icon={<Timer className="size-4" />}
              />
              <ScoreItem
                label="Corroboration"
                value={entry.ranking.corroborationScore}
                icon={<Users className="size-4" />}
              />
              <ScoreItem
                label="Source Type"
                value={entry.ranking.sourceTypeScore}
                icon={<Tag className="size-4" />}
              />
              <ScoreItem
                label="Total"
                value={entry.ranking.totalScore}
                icon={<BarChart3 className="size-4" />}
                highlight
              />
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {entry.topics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="size-4" />
                  Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {entry.topics.map((topic) => (
                    <Badge key={topic} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {entry.regions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="size-4" />
                  Regions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {entry.regions.map((region) => (
                    <Badge key={region} variant="secondary">
                      {region}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="size-4" />
                Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {entry.sourceNames.map((name) => (
                  <Badge key={name} variant="outline">
                    {name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ranking Reasons</CardTitle>
            <CardDescription>
              Why this story appears at this position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {entry.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  {reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{getMongoPersistenceSetupMessage()}</p>
        </CardContent>
      </Card>
    );
  }
}

function ScoreItem({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
    >
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div
        className={`text-lg font-mono font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}
      >
        {value.toFixed(3)}
      </div>
    </div>
  );
}
