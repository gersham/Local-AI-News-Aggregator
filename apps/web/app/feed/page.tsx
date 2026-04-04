import Link from 'next/link';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { loadFeedSnapshot } from '../../lib/feed-store';

export default async function FeedPage() {
  const state = await loadFeedSnapshot();

  return (
    <main className="shell">
      <section className="hero">
        <Badge className="eyebrow">Feed Preview</Badge>
        <h1>Ranked story clusters with explainable scoring.</h1>
        <p className="lede">
          This is the first feed materialization pass. It ranks normalized story
          clusters by baseline relevance, freshness, corroboration, and source
          type.
        </p>
        <div className="hero-actions hero-actions-row">
          <Button asChild className="action-button" variant="secondary">
            <Link href="/">Back to control plane</Link>
          </Button>
          <Badge variant="secondary">
            {state.snapshot.entries.length} entries
          </Badge>
          <Badge variant={state.usingExampleFallback ? 'outline' : 'default'}>
            {state.usingExampleFallback
              ? 'Example snapshot'
              : 'Writable snapshot'}
          </Badge>
        </div>
      </section>

      <section className="source-list">
        {state.snapshot.entries.map((entry) => (
          <Card className="panel source-card" key={entry.clusterId}>
            <CardHeader>
              <div className="source-card-header">
                <div>
                  <CardTitle>
                    #{entry.rank} {entry.headline}
                  </CardTitle>
                  <CardDescription>{entry.canonicalUrl}</CardDescription>
                </div>
                <div className="source-badges">
                  <Badge>{entry.ranking.totalScore.toFixed(2)}</Badge>
                  <Badge variant="outline">
                    {entry.citationCount} citations
                  </Badge>
                  <Badge variant="outline">{entry.sourceCount} sources</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="source-notes">{entry.summary}</p>
              <div className="source-meta">
                <span>Topics: {entry.topics.join(', ')}</span>
                <span>Regions: {entry.regions.join(', ')}</span>
                <span>Sources: {entry.sourceNames.join(', ')}</span>
              </div>
              <div className="source-badges">
                {entry.reasons.map((reason) => (
                  <Badge key={reason} variant="secondary">
                    {reason}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
