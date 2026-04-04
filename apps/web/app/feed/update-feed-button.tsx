'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../../components/ui/button';

export function UpdateFeedButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);

    try {
      const response = await fetch('/api/ingest', { method: 'POST' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error('Ingest failed:', body);
      }
    } catch (error) {
      console.error('Ingest request failed:', error);
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Updating...' : 'Update Feed'}
    </Button>
  );
}
