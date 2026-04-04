import { getRunnableSources } from '@news-aggregator/core';
import { Badge } from '../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../lib/persistence-error';
import { loadPersistedSourceRegistry } from '../../lib/source-registry-store';
import { SourceManager } from './source-manager';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  try {
    const state = await loadPersistedSourceRegistry();
    const runnableSources = getRunnableSources(state.registry);

    return (
      <div className="space-y-6">
        {/* Header */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-primary border-primary/30">
              Source Control
            </Badge>
            <Badge variant="secondary">
              {runnableSources.length} runnable /{' '}
              {state.registry.sources.length} total
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Sources</h1>
          <p className="max-w-2xl text-muted-foreground">
            Control which sources participate in the default run set.
            Browser-auth collectors stay deferred until explicitly enabled.
          </p>
        </section>

        <Separator />

        {/* Master-detail layout */}
        <SourceManager sources={state.registry.sources} />
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
            The source control page requires MongoDB-backed persistence before
            it can load or edit live state.
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
