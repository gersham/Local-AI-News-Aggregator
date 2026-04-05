import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { loadActivityLogs } from '../../lib/activity-log-store';
import {
  getMongoPersistenceSetupMessage,
  isMongoPersistenceConfigurationError,
} from '../../lib/persistence-error';
import { LogViewer } from './log-viewer';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  try {
    const state = await loadActivityLogs({ limit: 200 });

    return (
      <div className="space-y-6">
        <section className="space-y-2">
          <Badge variant="outline" className="text-primary border-primary/30">
            System
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground">
            Recent system activity across all components.
          </p>
        </section>

        <LogViewer initialEntries={state.entries} />
      </div>
    );
  } catch (error) {
    if (isMongoPersistenceConfigurationError(error)) {
      return (
        <div className="space-y-4">
          <Badge variant="outline">Activity Log</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {getMongoPersistenceSetupMessage()}
            </CardContent>
          </Card>
        </div>
      );
    }

    throw error;
  }
}
