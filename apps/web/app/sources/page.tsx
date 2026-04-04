import { getRunnableSources } from '@news-aggregator/core';
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
import { loadPersistedSourceRegistry } from '../../lib/source-registry-store';
import { updateSourceAction } from './actions';

export default async function SourcesPage() {
  const state = await loadPersistedSourceRegistry();
  const runnableSources = getRunnableSources(state.registry);

  return (
    <main className="shell">
      <section className="hero">
        <Badge className="eyebrow">Source Control</Badge>
        <h1>Manage ingestion rollout and source readiness.</h1>
        <p className="lede">
          This page controls which sources participate in the default run set.
          Browser-auth collectors stay deferred until you explicitly opt in.
        </p>
        <div className="hero-actions hero-actions-row">
          <Button asChild className="action-button" variant="secondary">
            <Link href="/">Back to control plane</Link>
          </Button>
          <Badge variant="secondary">
            {runnableSources.length} runnable / {state.registry.sources.length}{' '}
            total
          </Badge>
        </div>
      </section>

      <section className="grid source-summary-grid">
        <Card className="card">
          <CardHeader>
            <CardTitle>Writable Registry</CardTitle>
            <CardDescription>{state.storagePath}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              {state.usingExampleFallback
                ? 'Using the checked-in example registry until the first admin edit is saved.'
                : 'Using the writable registry file for active source configuration.'}
            </p>
          </CardContent>
        </Card>

        <Card className="card">
          <CardHeader>
            <CardTitle>Rollout Policy</CardTitle>
            <CardDescription>
              Public article extraction remains Exa-first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              X stays API-only for now. Reddit browser automation is available
              in config, but it is not part of the default run set.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="source-list">
        {state.registry.sources.map((source) => (
          <Card className="panel source-card" key={source.id}>
            <CardHeader>
              <div className="source-card-header">
                <div>
                  <CardTitle>{source.name}</CardTitle>
                  <CardDescription>{source.id}</CardDescription>
                </div>
                <div className="source-badges">
                  <Badge variant={source.enabled ? 'default' : 'secondary'}>
                    {source.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Badge variant="outline">{source.executionMode}</Badge>
                  <Badge variant="outline">{source.fetchMethod}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="source-meta">
                <span>Topics: {source.topics.join(', ') || 'none'}</span>
                <span>Regions: {source.regions.join(', ') || 'none'}</span>
                <span>Trust: {source.trustWeight.toFixed(2)}</span>
              </div>
              {source.notes ? (
                <p className="source-notes">{source.notes}</p>
              ) : null}

              <form action={updateSourceAction} className="source-form">
                <input name="id" type="hidden" value={source.id} />

                <label className="control-row">
                  <span>Enabled</span>
                  <input
                    defaultChecked={source.enabled}
                    name="enabled"
                    type="checkbox"
                  />
                </label>

                <label className="control-stack">
                  <span>Execution mode</span>
                  <select
                    className="source-select"
                    defaultValue={source.executionMode}
                    name="executionMode"
                  >
                    <option value="active">active</option>
                    <option value="manual-opt-in">manual-opt-in</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>

                <Button className="source-submit" type="submit">
                  Save source state
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
