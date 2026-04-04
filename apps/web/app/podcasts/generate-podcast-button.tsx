'use client';

import { Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../../components/ui/button';

export function GeneratePodcastButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);

    try {
      const response = await fetch('/api/podcast/generate', { method: 'POST' });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        console.error('Podcast generation failed:', body);
      }
    } catch (error) {
      console.error('Podcast generation request failed:', error);
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      <Mic className={`size-4 ${loading ? 'animate-pulse' : ''}`} />
      {loading ? 'Generating...' : 'Generate Podcast'}
    </Button>
  );
}
