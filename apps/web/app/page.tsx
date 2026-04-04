import { starterTopics, systemCapabilityHeadings } from '@news-aggregator/core';
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

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <Badge className="eyebrow">Scaffold Status</Badge>
        <h1>Personal Newsroom Control Plane</h1>
        <p className="lede">
          The repository is ready for credential collection, verification, and
          test-first feature development. Feed rendering, source control, and
          morning briefing playback will land in subsequent slices.
        </p>
        <div className="hero-actions hero-actions-row">
          <Button asChild className="action-button" variant="secondary">
            <Link href="/feed">Open feed preview</Link>
          </Button>
          <Button asChild className="action-button" variant="secondary">
            <Link href="/sources">Open source controls</Link>
          </Button>
        </div>
      </section>

      <section className="grid">
        {systemCapabilityHeadings.map((capability) => (
          <Card className="card" key={capability.title}>
            <CardHeader>
              <CardTitle>{capability.title}</CardTitle>
              <CardDescription>{capability.summary}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="split">
        <Card className="panel">
          <CardHeader>
            <CardTitle>Starter Topics</CardTitle>
            <CardDescription>
              The current seed list for feed coverage and briefing selection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="topic-list">
              {starterTopics.map((topic, index) => (
                <li key={topic.slug}>
                  <div>
                    <span>{topic.label}</span>
                    <small>{topic.scope}</small>
                  </div>
                  {index < starterTopics.length - 1 ? <Separator /> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="panel panel-accent">
          <CardHeader>
            <CardTitle>Verification Gate</CardTitle>
            <CardDescription>
              The initial runtime access checks are complete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol>
              <li>Copy `.env.example` to `.env`.</li>
              <li>Fill in provider keys and local playback values.</li>
              <li>Run `pnpm verify:tools`.</li>
              <li>Run `pnpm verify:services`.</li>
              <li>Stop and resolve blockers before TDD begins.</li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
